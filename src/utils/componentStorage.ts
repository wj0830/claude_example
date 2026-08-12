import type { GeneratedComponent } from '../types';

export const COMPONENTS_STORAGE_KEY = 'react-component-generator:components';

export function serializeComponents(components: GeneratedComponent[]): string {
  return JSON.stringify(components);
}

export function deserializeComponents(raw: string | null): GeneratedComponent[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as GeneratedComponent[];
    return parsed.map((component) => ({
      ...component,
      createdAt: new Date(component.createdAt),
      status: component.status ?? 'complete',
    }));
  } catch {
    return [];
  }
}

/** 스트리밍 중이거나 실패한 항목은 새로고침 시 복원하지 않도록 저장 대상에서 제외한다. */
export function filterPersistable(components: GeneratedComponent[]): GeneratedComponent[] {
  return components.filter((component) => component.status === 'complete');
}

export function loadComponents(): GeneratedComponent[] {
  try {
    return deserializeComponents(localStorage.getItem(COMPONENTS_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function saveComponents(components: GeneratedComponent[]): void {
  try {
    localStorage.setItem(COMPONENTS_STORAGE_KEY, serializeComponents(components));
  } catch {
    // localStorage 접근 불가/용량 초과 시 무시
  }
}
