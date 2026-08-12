import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComponentCard } from './ComponentCard';
import type { GeneratedComponent } from '../types';

function makeComponent(overrides: Partial<GeneratedComponent> = {}): GeneratedComponent {
  return {
    id: '1',
    prompt: '프로필 카드',
    code: '',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    status: 'complete',
    ...overrides,
  };
}

describe('ComponentCard', () => {
  it('status가 streaming이면 코드 탭이 기본으로 보이고 미리보기 탭은 비활성화된다', () => {
    const component = makeComponent({ status: 'streaming', code: 'const A = () =>' });
    const { container } = render(
      <ComponentCard component={component} onRemove={vi.fn()} onRegenerate={vi.fn()} isLoading />
    );

    expect(container.querySelector('.code-block')).not.toBeNull();
    expect(screen.getByRole('button', { name: '미리보기' })).toBeDisabled();
  });

  it('status가 complete이면 미리보기 탭이 기본으로 보이고 활성화되어 있다', () => {
    const component = makeComponent({ status: 'complete', code: 'render(<div />);' });
    const { container } = render(
      <ComponentCard component={component} onRemove={vi.fn()} onRegenerate={vi.fn()} isLoading={false} />
    );

    expect(container.querySelector('.code-block')).toBeNull();
    expect(screen.getByRole('button', { name: '미리보기' })).toBeEnabled();
  });

  it('status가 streaming에서 complete로 바뀌면 자동으로 미리보기 탭으로 전환된다', () => {
    const component = makeComponent({ status: 'streaming', code: 'const A = () =>' });
    const { container, rerender } = render(
      <ComponentCard component={component} onRemove={vi.fn()} onRegenerate={vi.fn()} isLoading />
    );

    expect(container.querySelector('.code-block')).not.toBeNull();

    const completed = makeComponent({ status: 'complete', code: 'render(<div />);' });
    rerender(
      <ComponentCard component={completed} onRemove={vi.fn()} onRegenerate={vi.fn()} isLoading={false} />
    );

    expect(container.querySelector('.code-block')).toBeNull();
  });

  it('status가 error이면 미리보기 탭이 비활성화된 채 코드 탭이 유지된다', () => {
    const component = makeComponent({ status: 'error', code: 'const A = () =>' });
    const { container } = render(
      <ComponentCard component={component} onRemove={vi.fn()} onRegenerate={vi.fn()} isLoading={false} />
    );

    expect(container.querySelector('.code-block')).not.toBeNull();
    expect(screen.getByRole('button', { name: '미리보기' })).toBeDisabled();
  });
});
