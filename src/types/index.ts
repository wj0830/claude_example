export type Provider = 'anthropic' | 'google';

export type GenerationStatus = 'streaming' | 'complete' | 'error';

export interface GeneratedComponent {
  id: string;
  prompt: string;
  code: string;
  createdAt: Date;
  status: GenerationStatus;
}
