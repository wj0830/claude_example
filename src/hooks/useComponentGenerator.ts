import { useState, useCallback, useEffect } from 'react';
import type { GeneratedComponent, Provider } from '../types';
import { loadComponents, saveComponents, filterPersistable } from '../utils/componentStorage';
import { parseStreamLine, splitNDJSONBuffer } from '../utils/streamProtocol';

interface UseComponentGeneratorReturn {
  components: GeneratedComponent[];
  isLoading: boolean;
  error: string | null;
  generate: (prompt: string, apiKey: string | undefined, provider: Provider) => Promise<void>;
  removeComponent: (id: string) => void;
  clearAll: () => void;
}

export function useComponentGenerator(): UseComponentGeneratorReturn {
  const [components, setComponents] = useState<GeneratedComponent[]>(() => loadComponents());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    saveComponents(filterPersistable(components));
  }, [components]);

  const generate = useCallback(async (prompt: string, apiKey: string | undefined, provider: Provider) => {
    setIsLoading(true);
    setError(null);

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setComponents((prev) => [
      { id, prompt, code: '', createdAt: new Date(), status: 'streaming' },
      ...prev,
    ]);

    let accumulated = '';
    let settled = false;

    const updateComponent = (patch: Partial<GeneratedComponent>) => {
      setComponents((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    };

    // 스트림 중간에 실패하면 그때까지 받은 부분 코드는 남기되(status: 'error'),
    // 한 글자도 받지 못했다면 빈 카드를 남기지 않고 플레이스홀더를 제거한다.
    const finalizeAsError = (message: string) => {
      settled = true;
      setError(message);
      setComponents((prev) =>
        accumulated
          ? prev.map((c) => (c.id === id ? { ...c, status: 'error' } : c))
          : prev.filter((c) => c.id !== id)
      );
    };

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, ...(apiKey && { apiKey }), provider }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate component');
      }

      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error('스트리밍 응답을 읽을 수 없습니다.');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const { lines, remainder } = splitNDJSONBuffer(buffer);
        buffer = remainder;

        for (const line of lines) {
          const event = parseStreamLine(line);
          if (!event) continue;

          if (event.type === 'delta') {
            accumulated += event.text;
            updateComponent({ code: accumulated });
          } else if (event.type === 'done') {
            settled = true;
            updateComponent({ code: event.code, status: 'complete' });
          } else if (event.type === 'error') {
            finalizeAsError(event.message);
          }
        }
      }

      if (!settled) {
        finalizeAsError('스트림이 예기치 않게 종료되었습니다.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      finalizeAsError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const removeComponent = useCallback((id: string) => {
    setComponents((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setComponents([]);
  }, []);

  return { components, isLoading, error, generate, removeComponent, clearAll };
}
