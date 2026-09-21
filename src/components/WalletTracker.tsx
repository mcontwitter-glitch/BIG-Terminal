import { useEffect, useMemo, useState } from 'react';
import { HudPanel } from './HudPanel';

const MINT = 'Foot4fxy8CHxM37W8BeHwK6aLd8VH2yHTFu43KCxbCqc';

export type HolderRow = {
  owner: string;
  uiAmount: number;
  percentage?: number;
};

type HolderPayload = {
  mint: string;
  symbol?: string;
  holders: HolderRow[];
  updatedAt?: string;
};

function shortAddr(a: string) {
  if (!a || a.length < 10) return a || '—';
  return `${a.slice(0, 4)}…${a.slice(-4)}`;
}

function formatAmt(n: number) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export function WalletTracker() {
  const [data, setData] = useState<HolderPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/token-holders.json?t=${Date.now()}`);
        if (!res.ok) throw new Error(`holders ${res.status}`);
        const json = (await res.json()) as HolderPayload;
        if (!cancelled) {
          setData(json);
          setErr(null);
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'load failed');
      }
    };
    load();
    const id = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const rows = useMemo(() => {
    const list = data?.holders ?? [];
    const total = list.reduce((s, h) => s + (h.uiAmount || 0), 0) || 1;
    return list.slice(0, 12).map((h) => ({
      ...h,
      percentage: h.percentage ?? (h.uiAmount / total) * 100,
    }));
  }, [data]);

  const maxPct = Math.max(...rows.map((r) => r.percentage), 1);

  return (
    <HudPanel title="WALLET TRACKER // FOOT HOLDERS" className="panel-wallets">
      <div className="wallet-mint" title={MINT}>
        MINT <code>{shortAddr(MINT)}</code>
      </div>
      {err && !rows.length ? (
        <div className="wallet-empty">Awaiting holder feed…</div>
      ) : (
        <div className="wallet-chart" role="img" aria-label="Owner wallet balances">
          {rows.map((r) => (
            <div className="wallet-row" key={r.owner}>
              <a
                className="wallet-addr"
                href={`https://solscan.io/account/${r.owner}`}
                target="_blank"
                rel="noreferrer"
                title={r.owner}
              >
                {shortAddr(r.owner)}
              </a>
              <div className="wallet-bar-track">
                <div
                  className="wallet-bar-fill"
                  style={{ width: `${(r.percentage / maxPct) * 100}%` }}
                />
              </div>
              <span className="wallet-amt">{formatAmt(r.uiAmount)}</span>
              <span className="wallet-pct">{r.percentage.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      )}
      <div className="wallet-foot">
        {data?.updatedAt ? `SYNC ${new Date(data.updatedAt).toLocaleTimeString()}` : 'LIVE SNAPSHOT'}
        {' · '}
        TOP {rows.length} OWNERS
      </div>
    </HudPanel>
  );
}
