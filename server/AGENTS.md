# AGENTS.md (server/)

## Module Context

Bun 기반 API 프록시 서버. Anthropic/Google 두 AI 프로바이더에 컴포넌트 생성 요청을 전달하고, react-live가 실행할 수 있는 형태로 응답을 정규화한다. 루트 규칙은 [AGENTS.md](../AGENTS.md) 참조.

## Tech Stack & Constraints

- 별도 웹 프레임워크 없이 `Bun.serve` 단일 핸들러로 라우팅한다 (`server/index.ts:138-220`). Express/Hono 등을 추가하지 않는다.
- 외부 API 호출은 네이티브 `fetch`만 사용한다 (`server/index.ts:69`, `server/index.ts:101`) — axios 등 HTTP 클라이언트 라이브러리를 도입하지 않는다.

## Implementation Patterns

- 부수효과가 없는 로직(코드 정규화, 폴백 전략)은 `generator.ts`/`fallback.ts`처럼 순수 함수로 분리하고, `index.ts`는 HTTP 요청 파싱과 응답 조립만 담당한다.
- 새 프로바이더를 추가할 때는 `Provider` 유니온 타입(`server/index.ts:57`)과 `ENV_KEYS`(`server/index.ts:59-62`)에 함께 등록한다.

## Testing Strategy

- 테스트 명령: `bun run test` (프로젝트 루트에서 실행, `vitest.config`의 `include`가 `server/**/*.test.ts`를 포함).
- 테스트 파일은 대상 모듈과 같은 폴더에 `*.test.ts`로 둔다 (`generator.test.ts`, `fallback.test.ts`).
- `index.ts`(HTTP 핸들러)는 관례상 테스트하지 않는다 — 새 검증/변환 로직은 `index.ts`에 직접 넣지 말고 테스트 가능한 순수 함수로 뽑아낸다.

## Local Golden Rules

- **Security Boundary — 클라이언트 API 키를 로깅/에코하지 않는다.** `resolveApiKey`(`server/index.ts:64-66`)는 `clientKey || ENV_KEYS[provider] || null` 순으로 키를 결정한다. 에러 응답(`server/index.ts:191-211`)이나 로그에 `apiKey` 원문을 포함시키지 않는 현재 관례를 유지한다.
- **Double Defense — 코드펜스 제거는 이중 방어의 일부다.** SYSTEM_PROMPT는 "마크다운 펜스 없이 코드 블록만" 응답하라고 지시하지만(`server/index.ts:16`), 실제 모델 응답에는 ```` ``` ```` 펜스가 섞여 나올 수 있어 `stripCodeFences`(`server/generator.ts:5-10`)가 후처리한다. 프롬프트 문구를 다듬더라도 `stripCodeFences` 호출(`server/index.ts:188`)을 제거하지 않는다.
- **Asymmetry — Google 응답만 `MAX_TOKENS` 종료 사유를 별도 처리한다.** `callGoogleModel`(`server/index.ts:98-132`)은 `finishReason === 'MAX_TOKENS'`일 때 사용자에게 "코드가 너무 길어 잘렸다"는 한국어 안내를 던진다(`server/index.ts:123-125`). `callAnthropic`(`server/index.ts:68-96`)에는 대응하는 처리가 없다 — Anthropic 응답 포맷에 `stop_reason: "max_tokens"`가 와도 현재는 별도 안내 없이 그대로 반환된다는 점을 인지하고, 두 경로를 억지로 대칭시키려 하지 않는다.
- **Hard Constraint — 에러 매핑은 문자열 포함 검사에 의존한다.** `503`/`429` 처리(`server/index.ts:194-206`)는 `err.message.includes('503'|'429')`로 판단한다. 업스트림 API의 에러 메시지 포맷이 바뀌면(HTTP 상태 코드가 메시지 문자열에 그대로 안 들어가면) 이 매핑이 조용히 깨진다 — 에러 처리를 바꿀 때는 이 문자열 검사 지점도 함께 갱신한다.
