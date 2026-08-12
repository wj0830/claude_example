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
