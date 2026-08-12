import { describe, it, expect } from 'vitest';
import { serializeComponents, deserializeComponents } from './componentStorage';
import type { GeneratedComponent } from '../types';

describe('componentStorage', () => {
  it('should_null_반환빈배열', () => {
    expect(deserializeComponents(null)).toEqual([]);
  });

  it('should_잘못된JSON_반환빈배열', () => {
    expect(deserializeComponents('this is not json')).toEqual([]);
  });

  it('should_직렬화된컴포넌트_역직렬화하면_동일한값과Date인스턴스를반환', () => {
    const components: GeneratedComponent[] = [
      {
        id: '1-abcde',
        prompt: '프로필 카드',
        code: 'render(<div />)',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ];

    const serialized = serializeComponents(components);
    const restored = deserializeComponents(serialized);

    expect(restored).toHaveLength(1);
    expect(restored[0].id).toBe('1-abcde');
    expect(restored[0].prompt).toBe('프로필 카드');
    expect(restored[0].code).toBe('render(<div />)');
    expect(restored[0].createdAt).toBeInstanceOf(Date);
    expect(restored[0].createdAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });
});
