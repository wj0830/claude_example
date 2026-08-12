// 서버가 보내는 NDJSON 스트림을 파싱하는 순수 함수들.
// 부수효과(fetch 등)가 없어 단위 테스트가 가능하다.

export type StreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; code: string }
  | { type: 'error'; message: string };

/** NDJSON 한 줄을 이벤트 객체로 파싱한다. 빈 줄이면 null. */
export function parseStreamLine(line: string): StreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  return JSON.parse(trimmed) as StreamEvent;
}

/** 스트림에서 누적된 버퍼를 완결된 줄들과 아직 끝나지 않은 나머지로 분리한다. */
export function splitNDJSONBuffer(buffer: string): { lines: string[]; remainder: string } {
  const parts = buffer.split('\n');
  const remainder = parts.pop() ?? '';
  return { lines: parts, remainder };
}
