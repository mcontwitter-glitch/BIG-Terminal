import type { ReactNode } from 'react';

interface Props {
  title?: string;
  className?: string;
  children: ReactNode;
  corner?: 'tl' | 'tr' | 'bl' | 'br' | 'all';
}

export function HudPanel({ title, className = '', children, corner = 'all' }: Props) {
  return (
    <div className={`hud-panel corner-${corner} ${className}`}>
      <div className="hud-panel-glow" />
      {title && (
        <div className="hud-panel-header">
          <span className="hud-panel-title">{title}</span>
          <span className="hud-panel-ticks" aria-hidden>
            ▢▢▢
          </span>
        </div>
      )}
      <div className="hud-panel-body">{children}</div>
    </div>
  );
}
