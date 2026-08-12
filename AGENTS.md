# AGENTS.md

## Operational Commands

- Package manager: `bun` 고정. `npm`/`yarn`/`pnpm` 사용 금지 (`bun.lock`만 존재).
- 의존성 설치: `bun install`
- 개발 서버 (API + Vite 동시 실행): `bun run dev`
- API 서버만 실행 (watch 모드): `bun run server`
- 빌드: `bun run build` (`tsc -b && vite build`)
- 린트: `bun run lint`
- 테스트 1회 실행: `bun run test` (vitest run)
- 테스트 watch: `bun run test:watch`
- API 서버는 포트 3002 고정 (`server/index.ts:173`), Vite dev 서버가 `/api`를 여기로 프록시한다 (`vite.config.ts:9-14`). 포트를 바꾸면 두 곳 모두 수정해야 한다.

## Golden Rules

- **Security Boundary — 서버 env 키는 값이 아닌 boolean만 노출한다.** `/api/config` 핸들러(`server/index.ts:147-157`)는 `ANTHROPIC_API_KEY`/`GOOGLE_API_KEY`의 존재 여부(`!!ENV_KEYS.anthropic`)만 클라이언트에 반환하고, 실제 키 값은 절대 응답에 포함하지 않는다. 이 엔드포인트나 관련 응답 스키마를 수정할 때 실제 키 문자열이 섞여 나가지 않도록 한다.
- **Double Defense — `render()` 호출 누락에 대한 이중 방어.** SYSTEM_PROMPT는 모델에게 "call render(<ComponentName />) at the end"를 명시적으로 지시하지만(`server/index.ts:13`), 모델이 이를 지키지 않을 경우를 대비해 `ensureRenderCall`(`server/generator.ts:16-24`)이 코드에 `render()` 호출이 없으면 자동으로 주입한다. 프롬프트 문구를 수정하더라도 `ensureRenderCall` 로직은 제거하지 않는다 — 한쪽만 남기면 LLM이 지시를 어겼을 때 미리보기가 빈 화면이 된다.
- **Hard Constraint — react-live `noInline` 코드 형식.** `src/components/LivePreview.tsx:14`는 `LiveProvider ... noInline`으로 렌더링하므로, 생성된 코드는 (1) import 문이 전혀 없고 (2) TypeScript 문법(타입 주석, 인터페이스, `as` 캐스트)이 없으며 (3) 마지막에 명시적 `render(...)` 호출이 있어야 한다(`server/index.ts:9-20`의 SYSTEM_PROMPT 규칙과 동일). 이 세 조건 중 하나라도 깨지면 미리보기가 렌더링되지 않는다.
- **Asymmetry — Google 경로만 모델 폴백을 사용한다.** `connectGoogleStream`은 `GOOGLE_MODELS` 목록(`server/index.ts:11`)을 순회하는 `withModelFallback`(`server/fallback.ts`)을 쓰지만, `connectAnthropicStream`(`server/index.ts:77-99`)은 단일 모델(`claude-haiku-4-5-20251001`)만 호출하고 폴백이 없다. 이는 실수가 아니라 Gemini 모델 교체 주기/한도 대응을 위한 의도된 비대칭이므로, Anthropic 쪽에 동일한 폴백 구조를 "일관성을 위해" 추가하지 않는다. **스트리밍 도입 후 폴백 범위가 축소됐다**: 업스트림 연결(비-2xx 응답) 실패에만 폴백이 적용되고, 클라이언트로 델타를 흘려보내기 시작한 뒤에는 어떤 이유로든(예: `MAX_TOKENS`) 다시 폴백하지 않는다 — 이미 보낸 부분 코드와 재시도한 새 스트림이 뒤섞이기 때문이다.
- **Hard Constraint — 서버↔클라이언트 스트리밍 프로토콜(NDJSON)은 두 곳에서 각각 구현된다.** 서버는 `server/streamProtocol.ts`의 `encodeStreamEvent`로, 클라이언트는 `src/utils/streamProtocol.ts`의 `parseStreamLine`으로 `{type:'delta'|'done'|'error', ...}` 형태의 NDJSON 한 줄을 주고받는다(`server/index.ts:227-262`, `src/hooks/useComponentGenerator.ts`). 두 파일은 별도 빌드 그래프(서버는 Bun, 클라이언트는 Vite)에 속해 공유 모듈로 묶여있지 않으므로, 이벤트 타입/필드를 바꿀 때는 반드시 양쪽을 함께 수정해야 한다.
- **Test Boundary — 순수 함수만 단위 테스트 대상이다.** `server/generator.ts`, `server/fallback.ts`, `server/streamProtocol.ts`(SSE 파싱/NDJSON 인코딩), `src/utils/streamProtocol.ts`(NDJSON 디코딩)는 부수효과가 없는 순수 함수라 각각 테스트가 있다. `Bun.serve` 핸들러 본체인 `server/index.ts`와 fetch/스트림 읽기를 수행하는 `src/hooks/useComponentGenerator.ts`는 IO를 직접 다루는 배선 코드라 테스트가 없다. 새 로직을 추가할 때는 가능한 한 순수 함수로 뽑아 이 패턴을 따르고 테스트를 함께 추가한다.

## Project Context

프롬프트를 입력하면 AI(Anthropic Claude 또는 Google Gemini)가 React 컴포넌트를 생성하고, react-live로 즉시 미리보기와 코드를 함께 보여주는 도구.

Tech Stack: React 19, TypeScript, Vite, Bun, react-live, Vitest, Testing Library, ESLint (flat config).

## Standards & References

- TypeScript strict 모드 (`tsconfig.app.json`): `strict`, `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly` 활성화. 미사용 변수/매개변수를 남기지 않는다.
- ESLint 설정은 `eslint.config.js` 참조 (`react-hooks`, `react-refresh` 규칙 포함).
- 커밋 메시지: Conventional Commits 형식 + 한국어 설명 (`git log` 참조, 예: `chore: 프로젝트 초기 스캐폴드 추가`).
- 실행 방법/기능 소개는 `README.md` 참조 — 여기서 반복하지 않는다.
- **Maintenance Policy:** 코드를 수정하면서 이 문서의 Golden Rule이 더 이상 사실과 맞지 않는다고 판단되면, 그 사실을 사용자에게 알리고 문서 업데이트를 제안한다.

## Context Map

- **[API 프록시 서버 수정 (Bun/AI 연동)](./server/AGENTS.md)** — `server/` 아래 프로바이더 호출, 프롬프트, 에러 처리 로직을 다룰 때.
