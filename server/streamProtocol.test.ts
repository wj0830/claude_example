import { describe, it, expect } from 'vitest';
import {
  encodeStreamEvent,
  parseStreamLine,
  splitSSEEvents,
  extractSSEDataPayloads,
  extractAnthropicDelta,
  extractGoogleDelta,
} from './streamProtocol';

describe('encodeStreamEvent', () => {
  it('delta 이벤트를 개행으로 끝나는 JSON 한 줄로 인코딩한다', () => {
    expect(encodeStreamEvent({ type: 'delta', text: 'const A' })).toBe(
      '{"type":"delta","text":"const A"}\n'
    );
  });

  it('done 이벤트를 인코딩한다', () => {
    expect(encodeStreamEvent({ type: 'done', code: 'render(<A />);' })).toBe(
      '{"type":"done","code":"render(<A />);"}\n'
    );
  });

  it('error 이벤트를 인코딩한다', () => {
    expect(encodeStreamEvent({ type: 'error', message: '실패' })).toBe(
      '{"type":"error","message":"실패"}\n'
    );
  });
});

describe('parseStreamLine', () => {
  it('빈 줄은 null을 반환한다', () => {
    expect(parseStreamLine('')).toBeNull();
    expect(parseStreamLine('   ')).toBeNull();
  });

  it('인코딩된 이벤트 한 줄을 원래 이벤트 객체로 되돌린다', () => {
    const line = encodeStreamEvent({ type: 'delta', text: 'hi' });
    expect(parseStreamLine(line)).toEqual({ type: 'delta', text: 'hi' });
  });
});

describe('splitSSEEvents', () => {
  it('빈 줄(\\n\\n)로 구분된 완결 이벤트와 미완성 나머지를 분리한다', () => {
    const buffer = 'event: a\ndata: {"x":1}\n\nevent: b\ndata: {"x":2}\n\nevent: c\ndata: {"x":3}';
    const { events, remainder } = splitSSEEvents(buffer);

    expect(events).toEqual(['event: a\ndata: {"x":1}', 'event: b\ndata: {"x":2}']);
    expect(remainder).toBe('event: c\ndata: {"x":3}');
  });

  it('완결된 이벤트가 없으면 전체를 remainder로 반환한다', () => {
    const { events, remainder } = splitSSEEvents('event: a\ndata: {"x":1}');
    expect(events).toEqual([]);
    expect(remainder).toBe('event: a\ndata: {"x":1}');
  });
});

describe('extractSSEDataPayloads', () => {
  it('data: 로 시작하는 줄에서 JSON 페이로드만 추출한다', () => {
    const block = 'event: content_block_delta\ndata: {"type":"content_block_delta"}';
    expect(extractSSEDataPayloads(block)).toEqual(['{"type":"content_block_delta"}']);
  });

  it('data: 줄이 없으면 빈 배열을 반환한다', () => {
    expect(extractSSEDataPayloads('event: ping\n')).toEqual([]);
  });
});

describe('extractAnthropicDelta', () => {
  it('content_block_delta의 text_delta에서 텍스트를 추출한다', () => {
    const data = {
      type: 'content_block_delta',
      delta: { type: 'text_delta', text: 'Hello' },
    };
    expect(extractAnthropicDelta(data)).toBe('Hello');
  });

  it('content_block_delta가 아니면 null을 반환한다', () => {
    expect(extractAnthropicDelta({ type: 'message_start' })).toBeNull();
  });

  it('text_delta가 아닌 delta 타입이면 null을 반환한다', () => {
    expect(
      extractAnthropicDelta({ type: 'content_block_delta', delta: { type: 'input_json_delta' } })
    ).toBeNull();
  });
});

describe('extractGoogleDelta', () => {
  it('candidates에서 텍스트 파츠와 finishReason을 추출한다', () => {
    const data = {
      candidates: [
        {
          content: { parts: [{ text: 'const A' }, { text: ' = 1;' }] },
          finishReason: 'STOP',
        },
      ],
    };
    expect(extractGoogleDelta(data)).toEqual({ texts: ['const A', ' = 1;'], finishReason: 'STOP' });
  });

  it('candidates가 없으면 빈 texts를 반환한다', () => {
    expect(extractGoogleDelta({})).toEqual({ texts: [], finishReason: undefined });
  });
});
