import { stripCodeFences, ensureRenderCall } from './generator';
import { withModelFallback } from './fallback';
import {
  encodeStreamEvent,
  splitSSEEvents,
  extractSSEDataPayloads,
  extractAnthropicDelta,
  extractGoogleDelta,
} from './streamProtocol';

// 우선순위 순서. 앞 모델이 실패하면 다음 모델로 폴백한다.
const GOOGLE_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.5-flash'];

const SYSTEM_PROMPT = `You are a React component generator. Generate a single React component based on the user's description.

Rules:
- Use inline styles only (no CSS imports, no CSS modules)
- Do NOT use import statements — React is already available in scope as a global
- Define the component as a function, then call render(<ComponentName />) at the end
- Make the component visually appealing with proper styling
- Use React hooks if needed (e.g., React.useState, React.useEffect)
- The component must be completely self-contained
- Respond with ONLY the code block — no explanations, no markdown fences
- Use descriptive variable names and clean formatting
- For colors, prefer modern palettes (gradients, shadows, etc.)
- Ensure the component is interactive where appropriate (hover states, click handlers, etc.)
- Do NOT use TypeScript syntax — no type annotations, no interfaces, no generics, no "as" casts. Write plain JavaScript only.

Example output format:
const GradientButton = () => {
  const [hovered, setHovered] = React.useState(false);

  return (
    <button
      style={{
        background: hovered
          ? 'linear-gradient(135deg, #667eea, #764ba2)'
          : 'linear-gradient(135deg, #764ba2, #667eea)',
        color: 'white',
        border: 'none',
        padding: '12px 24px',
        borderRadius: '8px',
        fontSize: '16px',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        transform: hovered ? 'scale(1.05)' : 'scale(1)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      Click me
    </button>
  );
};

render(<GradientButton />);`;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

type Provider = 'anthropic' | 'google';

const ENV_KEYS: Record<Provider, string | undefined> = {
  anthropic: process.env.ANTHROPIC_API_KEY,
  google: process.env.GOOGLE_API_KEY,
};

function resolveApiKey(provider: Provider, clientKey?: string): string | null {
  return clientKey || ENV_KEYS[provider] || null;
}

// 업스트림과의 연결을 연다. 여기서 던지는 에러(비-2xx 응답)만 모델 폴백 대상이 된다 —
// 아직 클라이언트로 아무것도 흘려보내지 않은 시점이라 안전하게 재시도할 수 있다.
async function connectAnthropicStream(prompt: string, apiKey: string): Promise<Response> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
      stream: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  return response;
}

async function connectGoogleModelStream(prompt: string, apiKey: string, model: string): Promise<Response> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 8192 },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  return response;
}

async function connectGoogleStream(prompt: string, apiKey: string): Promise<Response> {
  return withModelFallback(GOOGLE_MODELS, (model) => connectGoogleModelStream(prompt, apiKey, model));
}

type DeltaExtractor = (data: unknown) => { texts: string[]; finishReason?: string };

const anthropicDeltaExtractor: DeltaExtractor = (data) => {
  const text = extractAnthropicDelta(data);
  return { texts: text !== null ? [text] : [] };
};

// 연결된 SSE 응답 바디를 읽어 텍스트 델타를 onDelta로 전달하고, 마지막 finishReason을 반환한다.
async function relaySSEToDeltas(
  response: Response,
  toDelta: DeltaExtractor,
  onDelta: (text: string) => void,
): Promise<string | undefined> {
  const reader = response.body?.getReader();
  if (!reader) return undefined;

  const decoder = new TextDecoder();
  let buffer = '';
  let finishReason: string | undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const { events, remainder } = splitSSEEvents(buffer);
    buffer = remainder;

    for (const eventBlock of events) {
      for (const payload of extractSSEDataPayloads(eventBlock)) {
        let data: unknown;
        try {
          data = JSON.parse(payload);
        } catch {
          continue;
        }

        const result = toDelta(data);
        for (const text of result.texts) onDelta(text);
        if (result.finishReason) finishReason = result.finishReason;
      }
    }
  }

  return finishReason;
}

const server = Bun.serve({
  port: 3002,
  async fetch(req) {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(req.url);

    if (req.method === 'GET' && url.pathname === '/api/config') {
      return Response.json(
        {
          envKeys: {
            anthropic: !!ENV_KEYS.anthropic,
            google: !!ENV_KEYS.google,
          },
        },
        { headers: CORS_HEADERS }
      );
    }

    if (req.method === 'POST' && url.pathname === '/api/generate') {
      try {
        const { prompt, apiKey, provider = 'anthropic' } = (await req.json()) as {
          prompt: string;
          apiKey?: string;
          provider?: Provider;
        };

        const resolvedKey = resolveApiKey(provider, apiKey);

        if (!resolvedKey) {
          return Response.json(
            { error: `API key is required. Set ${provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'GOOGLE_API_KEY'} in .env or enter it manually.` },
            { status: 400, headers: CORS_HEADERS }
          );
        }

        if (!prompt) {
          return Response.json(
            { error: 'Prompt is required' },
            { status: 400, headers: CORS_HEADERS }
          );
        }

        // 업스트림 연결은 여기서 확정한다 — 실패하면(비-2xx) 기존과 동일하게
        // 503/429 매핑을 거친 JSON 에러 응답을 돌려준다. 연결에 성공한 뒤에는
        // 클라이언트로 스트리밍이 시작되므로 더 이상 폴백하지 않는다.
        const upstream =
          provider === 'google'
            ? await connectGoogleStream(prompt, resolvedKey)
            : await connectAnthropicStream(prompt, resolvedKey);

        const deltaExtractor = provider === 'google' ? extractGoogleDelta : anthropicDeltaExtractor;

        const stream = new ReadableStream({
          async start(controller) {
            const encoder = new TextEncoder();
            let accumulated = '';

            try {
              const finishReason = await relaySSEToDeltas(upstream, deltaExtractor, (text) => {
                accumulated += text;
                controller.enqueue(encoder.encode(encodeStreamEvent({ type: 'delta', text })));
              });

              if (provider === 'google' && finishReason === 'MAX_TOKENS') {
                controller.enqueue(
                  encoder.encode(
                    encodeStreamEvent({
                      type: 'error',
                      message: '생성된 코드가 너무 길어 잘렸습니다. 더 간단한 컴포넌트를 요청해주세요.',
                    })
                  )
                );
              } else {
                const code = ensureRenderCall(stripCodeFences(accumulated));
                controller.enqueue(encoder.encode(encodeStreamEvent({ type: 'done', code })));
              }
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Unknown error';
              controller.enqueue(encoder.encode(encodeStreamEvent({ type: 'error', message })));
            } finally {
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/x-ndjson' },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';

        if (message.includes('503')) {
          return Response.json(
            { error: 'API 서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요.' },
            { status: 503, headers: CORS_HEADERS }
          );
        }

        if (message.includes('429')) {
          return Response.json(
            { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
            { status: 429, headers: CORS_HEADERS }
          );
        }

        return Response.json(
          { error: message },
          { status: 500, headers: CORS_HEADERS }
        );
      }
    }

    return Response.json(
      { error: 'Not found' },
      { status: 404, headers: CORS_HEADERS }
    );
  },
});

console.log(`API server running at http://localhost:${server.port}`);
