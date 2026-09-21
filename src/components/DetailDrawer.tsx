import type { Agent, Task } from '../types';
import { ROLE_LABELS, STATUS_LABELS } from '../types';

interface Props {
  agent: Agent | null;
  task: Task | null;
  onClose: () => void;
}

export function DetailDrawer({ agent, task, onClose }: Props) {
  if (!agent && !task) return null;

  return (
    <div className="detail-drawer">
      <div className="drawer-head">
        <span>INSPECTOR</span>
        <button type="button" className="drawer-close" onClick={onClose}>
          ✕
        </button>
      </div>
      {agent && (
        <div className="drawer-section">
          <h3>{agent.name}</h3>
          <div className="kv">
            <span className="k">ROLE</span>
            <span className="v">{ROLE_LABELS[agent.role]}</span>
          </div>
          <div className="kv">
            <span className="k">STATUS</span>
            <span className={`v status-${agent.status}`}>{STATUS_LABELS[agent.status]}</span>
          </div>
          <div className="kv">
            <span className="k">CLUSTER</span>
            <span className="v">C-{agent.cluster}</span>
          </div>
          <div className="kv">
            <span className="k">TASK</span>
            <span className="v">{agent.taskId != null ? `#${agent.taskId}` : '—'}</span>
          </div>
          <div className="bar-block">
            <div className="bar-label">
              <span>STEP PROGRESS</span>
              <span>{Math.round(agent.progress * 100)}%</span>
            </div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${agent.progress * 100}%` }} />
            </div>
          </div>
        </div>
      )}
      {task && (
        <div className="drawer-section">
          <h3>{task.name}</h3>
          <div className="kv">
            <span className="k">STATUS</span>
            <span className="v">{task.status.toUpperCase()}</span>
          </div>
          <div className="kv">
            <span className="k">AGENTS</span>
            <span className="v">{task.agents.length}</span>
          </div>
          <ul className="task-steps">
            {task.steps.map((s) => (
              <li key={s.id} className={s.done ? 'done' : ''}>
                <span>{s.done ? '✓' : '○'}</span> {s.label}{' '}
                <em>({ROLE_LABELS[s.role]})</em>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
