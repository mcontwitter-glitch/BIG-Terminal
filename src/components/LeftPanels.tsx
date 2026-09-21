import { useEffect, useRef } from 'react';
import { HudPanel } from './HudPanel';
import type { ChecklistItem, LogEntry, SimMetrics } from '../types';

interface Props {
  metrics: SimMetrics;
  logs: LogEntry[];
  checklist: ChecklistItem[];
}

function MiniMeshIcon() {
  return (
    <svg className="mini-mesh" viewBox="0 0 64 48" width="72" height="48" aria-hidden>
      <g stroke="#00e5ff" strokeWidth="1" fill="none" opacity="0.9">
        <circle cx="12" cy="24" r="3" fill="#00e5ff" />
        <circle cx="32" cy="10" r="3" fill="#00e5ff" />
        <circle cx="52" cy="24" r="3" fill="#00e5ff" />
        <circle cx="32" cy="38" r="3" fill="#00e5ff" />
        <circle cx="22" cy="16" r="2" fill="#00bcd4" />
        <circle cx="42" cy="16" r="2" fill="#00bcd4" />
        <line x1="12" y1="24" x2="22" y2="16" />
        <line x1="22" y1="16" x2="32" y2="10" />
        <line x1="32" y1="10" x2="42" y2="16" />
        <line x1="42" y1="16" x2="52" y2="24" />
        <line x1="12" y1="24" x2="32" y2="38" />
        <line x1="52" y1="24" x2="32" y2="38" />
        <line x1="22" y1="16" x2="32" y2="38" />
        <line x1="42" y1="16" x2="32" y2="38" />
      </g>
    </svg>
  );
}

export function LeftPanels({ metrics, logs, checklist }: Props) {
  const termRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = termRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  return (
    <aside className="col col-left">
      <HudPanel title="AGENT NETWORK INITIALIZED" className="panel-status">
        <div className="status-row">
          <div className="status-badge">
            <span className="pulse-dot" />
            STATUS <strong>ACTIVE</strong>
          </div>
          <MiniMeshIcon />
        </div>
        <div className="metric-hero">
          <span className="metric-num">
            {metrics.activeAgents} <span className="metric-sep">/</span> {metrics.totalAgents}
          </span>
          <span className="metric-label">ACTIVE AGENTS</span>
        </div>
        <div className="metric-sub">
          TASKS LIVE: {metrics.tasksActive} · COMPLETE: {metrics.tasksComplete}
        </div>
      </HudPanel>

      <HudPanel title="SECURE CORE // EVENT LOG" className="panel-logs">
        <div className="terminal" ref={termRef}>
          {logs.map((l) => (
            <div key={l.id} className={`log-line kind-${l.kind}`}>
              <span className="log-hex">{l.hex}</span>
              <span className="log-msg">{l.message}</span>
            </div>
          ))}
        </div>
      </HudPanel>

      <HudPanel title="VALIDATION CHECKLIST" className="panel-check">
        <ul className="checklist">
          {checklist.map((c) => (
            <li key={c.id} className={c.done ? 'done' : 'pending'}>
              <span className="check-mark">{c.done ? '✓' : '○'}</span>
              <span className="check-label">{c.label}</span>
            </li>
          ))}
        </ul>
      </HudPanel>
    </aside>
  );
}
