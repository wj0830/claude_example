import { useState } from 'react';
import { spawnRipple } from '../utils/ripple';

interface CodeViewProps {
  code: string;
}

export function CodeView({ code }: CodeViewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="code-panel">
      <div className="panel-header">
        <h3>코드</h3>
        <button className="btn-copy ripple-surface" onClick={handleCopy} onPointerDown={spawnRipple}>
          {copied ? '복사됨!' : '복사'}
        </button>
      </div>
      <pre className="code-block">
        <code>{code}</code>
      </pre>
    </div>
  );
}
