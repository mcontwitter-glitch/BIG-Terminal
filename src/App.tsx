import { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import { NetworkViz } from './components/NetworkViz';
import { LeftPanels } from './components/LeftPanels';
import { RightPanels } from './components/RightPanels';
import { Controls } from './components/Controls';
import { DetailDrawer } from './components/DetailDrawer';
import { useSimulation } from './hooks/useSimulation';
import { useLiveNetwork } from './hooks/useLiveNetwork';
import { applyFilters } from './simulation/engine';

const LS_LEFT = 'hud-show-left';
const LS_RIGHT = 'hud-show-right';
const LS_CINEMA = 'hud-cinematic';

function readBool(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    return v === '1' || v === 'true';
  } catch {
    return fallback;
  }
}

function writeBool(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export default function App() {
  const sim = useSimulation();
  const live = useLiveNetwork(5000);
  const { snapshot, stateRef, changeSpeed, updateFilters, onSelectAgent, onSelectTask } =
    sim;

  // When RPC is live, overlay TPS / latency onto displayed metrics
  const displayMetrics = live.ok
    ? {
        ...snapshot.metrics,
        tps: live.tps ?? snapshot.metrics.tps,
        latencyMs: live.latencyMs ?? snapshot.metrics.latencyMs,
      }
    : snapshot.metrics;

  const brandSub = live.ok
    ? `1500 Agents · LIVE RPC · ${live.realAgents} REAL`
    : '1500 Agents · LIVE SIM';

  const filteredIdsRef = useRef<Set<number> | null>(null);

  const [showLeft, setShowLeft] = useState(() => readBool(LS_LEFT, true));
  const [showRight, setShowRight] = useState(() => readBool(LS_RIGHT, true));
  const [cinematic, setCinematic] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const q = new URLSearchParams(window.location.search);
        if (q.get('cinema') === '0' || q.get('cinema') === 'false') return false;
        if (q.get('cinema') === '1' || q.get('cinema') === 'true') return true;
        const mobile = window.matchMedia('(max-width: 900px), (max-height: 520px)').matches;
        if (mobile) return true;
      }
    } catch {
      /* ignore */
    }
    return readBool(LS_CINEMA, false);
  });

  useEffect(() => {
    writeBool(LS_LEFT, showLeft);
  }, [showLeft]);
  useEffect(() => {
    writeBool(LS_RIGHT, showRight);
  }, [showRight]);
  useEffect(() => {
    writeBool(LS_CINEMA, cinematic);
  }, [cinematic]);

  // Locked at 2× (speed slider removed). Deep-link: ?left=1&right=1&cinema=0
  useEffect(() => {
    changeSpeed(2);
    const q = new URLSearchParams(window.location.search);
    if (q.get('left') === '1' || q.get('left') === 'true') {
      setCinematic(false);
      setShowLeft(true);
    }
    if (q.get('right') === '1' || q.get('right') === 'true') {
      setCinematic(false);
      setShowRight(true);
    }
    if (q.get('cinema') === '1' || q.get('cinema') === 'true') {
      setCinematic(true);
    }
    if (q.get('cinema') === '0' || q.get('cinema') === 'false') {
      setCinematic(false);
    }
  }, [changeSpeed]);

  // Phones / short landscape: keep mesh fullscreen unless ?cinema=0
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get('cinema') === '0' || q.get('cinema') === 'false') return;
    const mq = window.matchMedia('(max-width: 900px), (max-height: 520px)');
    const apply = () => {
      if (mq.matches) setCinematic(true);
    };
    apply();
    mq.addEventListener('change', apply);
    const onOrient = () => {
      window.setTimeout(apply, 150);
    };
    window.addEventListener('orientationchange', onOrient);
    return () => {
      mq.removeEventListener('change', apply);
      window.removeEventListener('orientationchange', onOrient);
    };
  }, []);

  const leftVisible = showLeft && !cinematic;
  const rightVisible = showRight && !cinematic;

  const toggleLeft = useCallback(() => {
    setCinematic(false);
    setShowLeft((v) => !v);
  }, []);
  const toggleRight = useCallback(() => {
    setCinematic(false);
    setShowRight((v) => !v);
  }, []);
  const toggleCinematic = useCallback(() => {
    setCinematic((v) => !v);
  }, []);

  useEffect(() => {
    const s = stateRef.current;
    const f = snapshot.filters;
    if (f.role === 'all' && f.status === 'all' && !f.search.trim()) {
      filteredIdsRef.current = null;
    } else {
      const list = applyFilters(s.agents, f);
      filteredIdsRef.current = new Set(list.map((a) => a.id));
    }
  }, [snapshot.filters, snapshot.tick, stateRef]);

  const selectedAgent =
    snapshot.selectedAgentId != null ? stateRef.current.agents[snapshot.selectedAgentId] : null;
  const selectedTask =
    snapshot.selectedTaskId != null
      ? (snapshot.tasks.find((t) => t.id === snapshot.selectedTaskId) ?? null)
      : selectedAgent?.taskId != null
        ? (snapshot.tasks.find((t) => t.id === selectedAgent.taskId) ?? null)
        : null;

  const stageClass = [
    'main-stage',
    leftVisible ? '' : 'hide-left',
    rightVisible ? '' : 'hide-right',
    cinematic ? 'cinematic' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={`app-shell ${cinematic ? 'mode-cinematic' : ''}`}>
      <div className="network-backdrop">
        <NetworkViz
          stateRef={stateRef}
          onSelectAgent={onSelectAgent}
          filteredIdsRef={filteredIdsRef}
        />
      </div>

      <div className="vignette" />
      <div className="scanlines" />

      <header className={`top-chrome ${cinematic ? 'chrome-dim' : ''}`}>
        <div className="brand">
          AGENT NETWORK HUD <span>//</span> BIG NETWORK
        </div>
        <div className="brand brand-sub">{brandSub}</div>
      </header>

      <div className={stageClass}>
        <div
          className={`panel-slot panel-slot-left ${leftVisible ? 'visible' : 'hidden'}`}
          aria-hidden={!leftVisible}
        >
          <LeftPanels
            metrics={displayMetrics}
            logs={snapshot.logs}
            checklist={snapshot.checklist}
          />
        </div>

        <div className="center-spacer">
          <div className="center-hint">
            {cinematic
              ? 'WATCHING SWARM · ESCAPE WATCH VIA CONTROLS'
              : 'CLICK NODE TO INSPECT · CONTROLS BELOW'}
          </div>
        </div>

        <div
          className={`panel-slot panel-slot-right ${rightVisible ? 'visible' : 'hidden'}`}
          aria-hidden={!rightVisible}
        >
          <RightPanels
            metrics={displayMetrics}
            nodeId="BIG-NETWORK-01"
            role="NETWORK ARCHITECT"
          />
        </div>
      </div>

      {!cinematic && (
        <DetailDrawer
          agent={selectedAgent}
          task={selectedTask}
          onClose={() => {
            onSelectAgent(null);
            onSelectTask(null);
          }}
        />
      )}

      <Controls
        filters={snapshot.filters}
        showLeft={showLeft}
        showRight={showRight}
        cinematic={cinematic}
        onFilters={updateFilters}
        onToggleLeft={toggleLeft}
        onToggleRight={toggleRight}
        onToggleCinematic={toggleCinematic}
      />
    </div>
  );
}
