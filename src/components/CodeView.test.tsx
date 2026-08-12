import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CodeView } from './CodeView';

describe('CodeView', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('disableCopy가 없으면 복사 버튼이 활성화되고 클릭 시 클립보드에 복사한다', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    render(<CodeView code="const A = 1;" />);

    const button = screen.getByRole('button', { name: '복사' });
    expect(button).toBeEnabled();

    await user.click(button);
    expect(writeText).toHaveBeenCalledWith('const A = 1;');
  });

  it('disableCopy가 true면 복사 버튼이 비활성화되고 클릭해도 복사되지 않는다', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    render(<CodeView code="const A = 1;" disableCopy />);

    const button = screen.getByRole('button', { name: '복사' });
    expect(button).toBeDisabled();

    await user.click(button);
    expect(writeText).not.toHaveBeenCalled();
  });
});
