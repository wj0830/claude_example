import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  serializeComponents,
  deserializeComponents,
  loadComponents,
  saveComponents,
  COMPONENTS_STORAGE_KEY,
} from './componentStorage';
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

describe('loadComponents', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('should_getItem이예외를던지면_빈배열반환', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    expect(loadComponents()).toEqual([]);
  });

  it('should_저장된값이있으면_역직렬화해서반환', () => {
    const components: GeneratedComponent[] = [
      {
        id: '2-fghij',
        prompt: '버튼',
        code: 'render(<button />)',
        createdAt: new Date('2026-02-02T00:00:00.000Z'),
      },
    ];
    localStorage.setItem(COMPONENTS_STORAGE_KEY, serializeComponents(components));

    const restored = loadComponents();

    expect(restored).toHaveLength(1);
    expect(restored[0].id).toBe('2-fghij');
  });
});

describe('saveComponents', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('should_setItem이예외를던져도_예외를전파하지않음', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(() => saveComponents([])).not.toThrow();
  });

  it('should_컴포넌트목록_직렬화되어localStorage에저장됨', () => {
    const components: GeneratedComponent[] = [
      {
        id: '3-klmno',
        prompt: '카드',
        code: 'render(<div />)',
        createdAt: new Date('2026-03-03T00:00:00.000Z'),
      },
    ];

    saveComponents(components);

    expect(localStorage.getItem(COMPONENTS_STORAGE_KEY)).toBe(serializeComponents(components));
  });
});
