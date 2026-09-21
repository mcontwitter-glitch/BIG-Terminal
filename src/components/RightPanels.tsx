import { HudPanel } from './HudPanel';
import { WalletTracker } from './WalletTracker';
import type { SimMetrics } from '../types';

interface Props {
  metrics: SimMetrics;
  nodeId?: string;
  role?: string;
}

function Waveform() {
  const bars = 32;
  return (
    <div className="waveform" aria-hidden>
      {Array.from({ length: bars }, (_, i) => (
        <span
          key={i}
          style={{
            animationDelay: `${i * 0.05}s`,
            height: `${30 + ((i * 17) % 60)}%`,
          }}
        />
      ))}
    </div>
  );
}

function SphereMeshAccent() {
  return (
    <svg className="sphere-mesh" viewBox="0 0 120 80" width="120" height="70" aria-hidden>
      <defs>
        <radialGradient id="sg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#00e5ff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="60" cy="40" rx="48" ry="28" fill="url(#sg)" stroke="#00e5ff" strokeWidth="0.8" opacity="0.7" />
      <ellipse cx="60" cy="40" rx="32" ry="28" fill="none" stroke="#00bcd4" strokeWidth="0.6" opacity="0.5" />
      <ellipse cx="60" cy="40" rx="16" ry="28" fill="none" stroke="#00e5ff" strokeWidth="0.5" opacity="0.4" />
      <ellipse cx="60" cy="40" rx="48" ry="12" fill="none" stroke="#00e5ff" strokeWidth="0.5" opacity="0.5" />
      <ellipse cx="60" cy="40" rx="48" ry="20" fill="none" stroke="#00bcd4" strokeWidth="0.4" opacity="0.35" />
      <line x1="12" y1="40" x2="108" y2="40" stroke="#00e5ff" strokeWidth="0.4" opacity="0.4" />
    </svg>
  );
}

function formatTps(tps: number): string {
  return Math.round(tps).toLocaleString('en-US');
}

export function RightPanels({
  metrics,
  nodeId = 'BIG-NETWORK-01',
  role = 'NETWORK ARCHITECT',
}: Props) {
  const integrity = Math.round(metrics.swarmIntegrity * 1000) / 10;
  return (
    <aside className="col col-right">
      <HudPanel title="BIG NETWORK // NETWORK NODE" className="panel-jarvis">
        <div className="kv">
          <span className="k">NODE ID</span>
          <span className="v">{nodeId}</span>
        </div>
        <div className="kv">
          <span className="k">ROLE</span>
          <span className="v accent">{role}</span>
        </div>
        <div className="bar-block">
          <div className="bar-label">
            <span>SWARM INTEGRITY</span>
            <span>{integrity}%</span>
          </div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${integrity}%` }} />
          </div>
        </div>
        <div className="threat">
          THREAT LEVEL: <strong>NONE DETECTED</strong>
        </div>
      </HudPanel>

      <HudPanel title="TASK ENGINE" className="panel-contract">
        <div className="contract-meta">
          <div className="kv">
            <span className="k">CONTRACT</span>
            <span className="v">AgentSwarmProtocol</span>
          </div>
          <div className="kv">
            <span className="k">STATUS</span>
            <span className="v ok">DEPLOYED ✓</span>
          </div>
          <div className="kv">
            <span className="k">VERSION</span>
            <span className="v">v3.7.1-swarm</span>
          </div>
        </div>
        <div className="fn-list">
          <div className="fn">assignTask()</div>
          <div className="fn">collaborate()</div>
          <div className="fn">validateResult()</div>
          <div className="fn">escalate()</div>
        </div>
      </HudPanel>

      <HudPanel title="REAL-TIME DATA STREAM" className="panel-stream">
        <div className="stream-visual">
          <SphereMeshAccent />
          <Waveform />
        </div>
        <div className="stream-stats">
          <div className="stat">
            <span className="stat-val">{formatTps(metrics.tps)}</span>
            <span className="stat-key">TPS</span>
          </div>
          <div className="stat">
            <span className="stat-val">{metrics.latencyMs.toFixed(1)}ms</span>
            <span className="stat-key">LATENCY</span>
          </div>
          <div className="stat">
            <span className="stat-val">{(metrics.computeUsed * 100).toFixed(0)}%</span>
            <span className="stat-key">COMPUTE</span>
          </div>
          <div className="stat">
            <span className="stat-val">{Math.round(metrics.messagesPerSec)}</span>
            <span className="stat-key">MSG/S</span>
          </div>
        </div>
      </HudPanel>

      <WalletTracker />
    </aside>
  );
}
