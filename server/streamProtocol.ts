// AI 프로바이더의 스트리밍 응답을 클라이언트용 NDJSON 이벤트로 변환하는 순수 함수들.
// 부수효과(fetch, Bun.serve 등)가 없어 단위 테스트가 가능하다.

export type StreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; code: string }
  | { type: 'error'; message: string };

/** 클라이언트로 보낼 이벤트를 개행으로 끝나는 JSON 한 줄로 직렬화한다(NDJSON). */
export function encodeStreamEvent(event: StreamEvent): string {
  return `${JSON.stringify(event)}\n`;
}

/** NDJSON 한 줄을 이벤트 객체로 되돌린다. 빈 줄이면 null. */
export function parseStreamLine(line: string): StreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  return JSON.parse(trimmed) as StreamEvent;
}

/**
 * 업스트림 SSE 버퍼를 빈 줄(\n\n)로 구분된 완결 이벤트 블록들과
 * 아직 끝나지 않은 나머지(remainder)로 분리한다.
 */
export function splitSSEEvents(buffer: string): { events: string[]; remainder: string } {
  const parts = buffer.split('\n\n');
  const remainder = parts.pop() ?? '';
  return { events: parts, remainder };
}

/** 하나의 SSE 이벤트 블록에서 `data:` 줄의 JSON 페이로드 문자열만 추출한다. */
export function extractSSEDataPayloads(eventBlock: string): string[] {
  return eventBlock
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .filter((payload) => payload.length > 0);
}

/** Anthropic content_block_delta 페이로드에서 텍스트 델타를 추출한다. 해당 없으면 null. */
export function extractAnthropicDelta(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null;

  const event = data as { type?: string; delta?: { type?: string; text?: string } };
  if (event.type !== 'content_block_delta') return null;
  if (event.delta?.type !== 'text_delta' || typeof event.delta.text !== 'string') return null;

  return event.delta.text;
}

/** Google streamGenerateContent 청크에서 텍스트 파츠와 finishReason을 추출한다. */
export function extractGoogleDelta(data: unknown): { texts: string[]; finishReason?: string } {
  const candidate = (
    data as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
      }>;
    }
  )?.candidates?.[0];

  const texts =
    candidate?.content?.parts
      ?.map((part) => part.text)
      .filter((text): text is string => typeof text === 'string') ?? [];

  return { texts, finishReason: candidate?.finishReason };
}
