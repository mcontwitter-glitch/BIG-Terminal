import type { SimFilters } from '../types';
import { ROLE_LABELS, STATUS_LABELS } from '../types';
import type { AgentRole, AgentStatus } from '../types';

interface Props {
  filters: SimFilters;
  showLeft: boolean;
  showRight: boolean;
  cinematic: boolean;
  onFilters: (f: Partial<SimFilters>) => void;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  onToggleCinematic: () => void;
}

export function Controls({
  filters,
  showLeft,
  showRight,
  cinematic,
  onFilters,
  onToggleLeft,
  onToggleRight,
  onToggleCinematic,
}: Props) {
  return (
    <div className="controls-bar">
      <label className="ctrl-group">
        <span>ROLE</span>
        <select
          value={filters.role}
          onChange={(e) => onFilters({ role: e.target.value as SimFilters['role'] })}
        >
          <option value="all">ALL</option>
          {(Object.keys(ROLE_LABELS) as AgentRole[]).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </label>
      <label className="ctrl-group">
        <span>STATUS</span>
        <select
          value={filters.status}
          onChange={(e) => onFilters({ status: e.target.value as SimFilters['status'] })}
        >
          <option value="all">ALL</option>
          {(Object.keys(STATUS_LABELS) as AgentStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
      <label className="ctrl-group search">
        <span>SEARCH</span>
        <input
          type="search"
          placeholder="BIGFOOT#42…"
          value={filters.search}
          onChange={(e) => onFilters({ search: e.target.value })}
        />
      </label>

      <div className="ctrl-divider" aria-hidden />

      <button
        type="button"
        className={`ctrl-btn ctrl-toggle ${showLeft && !cinematic ? 'active' : ''}`}
        onClick={onToggleLeft}
        title="Show / hide left panels"
      >
        {showLeft && !cinematic ? '◀ LEFT ON' : '◀ LEFT OFF'}
      </button>
      <button
        type="button"
        className={`ctrl-btn ctrl-toggle ${showRight && !cinematic ? 'active' : ''}`}
        onClick={onToggleRight}
        title="Show / hide right panels"
      >
        {showRight && !cinematic ? 'RIGHT ON ▶' : 'RIGHT OFF ▶'}
      </button>
      <button
        type="button"
        className={`ctrl-btn ctrl-cinematic ${cinematic ? 'active' : ''}`}
        onClick={onToggleCinematic}
        title="Hide both side panels and watch the swarm"
      >
        {cinematic ? '■ EXIT WATCH' : '◎ WATCH SWARM'}
      </button>
    </div>
  );
}
