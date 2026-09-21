import { useEffect, useRef, useState } from 'react';

export interface LiveNetworkMetrics {
  ok: boolean;
  connected: boolean;
  health: string | null;
  slot: number | null;
  tps: number | null;
  latencyMs: number | null;
  source: 'rpc' | 'unavailable';
  realAgents: number;
  updatedAt: string | null;
}

const EMPTY: LiveNetworkMetrics = {
  ok: false,
  connected: false,
  health: null,
  slot: null,
  tps: null,
  latencyMs: null,
  source: 'unavailable',
  realAgents: 60,
  updatedAt: null,
};

const POLL_MS = 5000;

export async function fetchLiveNetwork(): Promise<LiveNetworkMetrics> {
  try {
    const resp = await fetch('/api/live', { cache: 'no-store' });
    if (!resp.ok) return { ...EMPTY };
    const data = (await resp.json()) as Partial<LiveNetworkMetrics> & {
      ok?: boolean;
      source?: string;
    };
    const ok = Boolean(data.ok) && data.source === 'rpc';
    return {
      ok,
      connected: ok,
      health: typeof data.health === 'string' ? data.health : data.health != null ? String(data.health) : null,
      slot: typeof data.slot === 'number' ? data.slot : null,
      tps: typeof data.tps === 'number' ? data.tps : null,
      latencyMs: typeof data.latencyMs === 'number' ? data.latencyMs : null,
      source: data.source === 'rpc' ? 'rpc' : 'unavailable',
      realAgents: typeof data.realAgents === 'number' ? data.realAgents : 60,
      updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : null,
    };
  } catch {
    return { ...EMPTY };
  }
}

export function useLiveNetwork(intervalMs = POLL_MS) {
  const [live, setLive] = useState<LiveNetworkMetrics>(EMPTY);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const next = await fetchLiveNetwork();
      if (!cancelled) setLive(next);
    };
    void poll();
    timerRef.current = setInterval(() => {
      void poll();
    }, intervalMs);
    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [intervalMs]);

  return live;
}
