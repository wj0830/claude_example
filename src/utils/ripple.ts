import type { PointerEvent } from 'react';

export function spawnRipple(event: PointerEvent<HTMLElement>) {
  const target = event.currentTarget;
  if (target.hasAttribute('disabled')) return;

  const rect = target.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 1.6;
  const ripple = document.createElement('span');
  ripple.className = 'md-ripple';
  ripple.style.width = `${size}px`;
  ripple.style.height = `${size}px`;
  ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
  ripple.style.top = `${event.clientY - rect.top - size / 2}px`;

  target.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
}
