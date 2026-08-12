import { useState } from 'react';
import type { GeneratedComponent } from '../types';
import { LivePreview } from './LivePreview';
import { CodeView } from './CodeView';
import { spawnRipple } from '../utils/ripple';

interface ComponentCardProps {
  component: GeneratedComponent;
  onRemove: (id: string) => void;
  onRegenerate: (prompt: string) => void;
  isLoading: boolean;
}

type Tab = 'preview' | 'code';

export function ComponentCard({ component, onRemove, onRegenerate, isLoading }: ComponentCardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('preview');
  const [previewKey, setPreviewKey] = useState(0);
  const createdAt = component.createdAt.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="component-card">
      <div className="card-header">
        <div className="card-title-group">
          <span>{createdAt}</span>
          <p className="card-prompt">{component.prompt}</p>
        </div>
        <div className="card-actions">
          <button
            className="btn-refresh ripple-surface"
            onClick={() => setPreviewKey((k) => k + 1)}
            onPointerDown={spawnRipple}
            title="미리보기 새로고침"
            aria-label="미리보기 새로고침"
          >
            ↻
          </button>
          <button
            className="btn-regenerate ripple-surface"
            onClick={() => onRegenerate(component.prompt)}
            onPointerDown={spawnRipple}
            disabled={isLoading}
          >
            {isLoading ? '생성 중...' : '재생성'}
          </button>
          <button
            className="btn-remove ripple-surface"
            onClick={() => onRemove(component.id)}
            onPointerDown={spawnRipple}
          >
            삭제
          </button>
        </div>
      </div>
      <div className="card-tabs">
        <button
          className={`tab ripple-surface ${activeTab === 'preview' ? 'tab--active' : ''}`}
          onClick={() => setActiveTab('preview')}
          onPointerDown={spawnRipple}
        >
          미리보기
        </button>
        <button
          className={`tab ripple-surface ${activeTab === 'code' ? 'tab--active' : ''}`}
          onClick={() => setActiveTab('code')}
          onPointerDown={spawnRipple}
        >
          코드
        </button>
      </div>
      <div className="card-content">
        {activeTab === 'preview' ? (
          <LivePreview key={previewKey} code={component.code} />
        ) : (
          <CodeView code={component.code} />
        )}
      </div>
    </div>
  );
}
