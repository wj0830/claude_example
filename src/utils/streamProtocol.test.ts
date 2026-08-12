import { describe, it, expect } from 'vitest';
import { parseStreamLine, splitNDJSONBuffer } from './streamProtocol';

describe('parseStreamLine', () => {
  it('빈 줄은 null을 반환한다', () => {
    expect(parseStreamLine('')).toBeNull();
    expect(parseStreamLine('   ')).toBeNull();
  });

  it('delta 이벤트 줄을 객체로 파싱한다', () => {
    expect(parseStreamLine('{"type":"delta","text":"const A"}')).toEqual({
      type: 'delta',
      text: 'const A',
    });
  });

  it('done 이벤트 줄을 객체로 파싱한다', () => {
    expect(parseStreamLine('{"type":"done","code":"render(<A />);"}')).toEqual({
      type: 'done',
      code: 'render(<A />);',
    });
  });

  it('error 이벤트 줄을 객체로 파싱한다', () => {
    expect(parseStreamLine('{"type":"error","message":"실패"}')).toEqual({
      type: 'error',
      message: '실패',
    });
  });
});

describe('splitNDJSONBuffer', () => {
  it('완결된 줄들과 마지막 미완성 줄(remainder)을 분리한다', () => {
    const buffer = '{"a":1}\n{"a":2}\n{"a":3';
    const { lines, remainder } = splitNDJSONBuffer(buffer);

    expect(lines).toEqual(['{"a":1}', '{"a":2}']);
    expect(remainder).toBe('{"a":3');
  });

  it('개행이 없으면 전체가 remainder다', () => {
    const { lines, remainder } = splitNDJSONBuffer('{"a":1}');
    expect(lines).toEqual([]);
    expect(remainder).toBe('{"a":1}');
  });
});
