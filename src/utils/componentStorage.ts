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
    }));
  } catch {
    return [];
  }
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
