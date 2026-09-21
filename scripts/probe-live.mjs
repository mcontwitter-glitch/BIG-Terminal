/**
 * One-shot live RPC probe. Loads env the same way as Vite middleware.
 * Writes /workspace/agent-network-hud/.live-status.json — NEVER includes RPC URL or secrets.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getBigNetworkRpcUrl } from './load-env.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '.live-status.json');
const REAL_AGENTS = 60;

async function rpcCall(rpcUrl, method, params = []) {
  const started = Date.now();
  try {
    const resp = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    const latencyMs = Date.now() - started;
    if (!resp.ok) return { ok: false, error: `http_${resp.status}`, latencyMs };
    const data = await resp.json();
    if (data.error) return { ok: false, error: data.error.message ?? 'rpc_error', latencyMs };
    return { ok: true, result: data.result, latencyMs };
  } catch (e) {
    return { ok: false, error: 'fetch_failed', latencyMs: Date.now() - started };
  }
}

function computeTps(samples) {
  if (!Array.isArray(samples) || samples.length === 0) return null;
  let totalTx = 0;
  let totalSecs = 0;
  for (const s of samples) {
    if (
      typeof s?.numTransactions === 'number' &&
      typeof s?.samplePeriodSecs === 'number' &&
      s.samplePeriodSecs > 0
    ) {
      totalTx += s.numTransactions;
      totalSecs += s.samplePeriodSecs;
    }
  }
  if (totalSecs <= 0) return null;
  return totalTx / totalSecs;
}

function writeStatus(obj) {
  const safe = {
    ok: Boolean(obj.ok),
    envFound: Boolean(obj.envFound),
    source: obj.source ?? 'unavailable',
    health: obj.health ?? null,
    slot: obj.slot ?? null,
    tps: obj.tps ?? null,
    latencyMs: obj.latencyMs ?? null,
    realAgents: REAL_AGENTS,
    updatedAt: obj.updatedAt ?? new Date().toISOString(),
    reason: obj.reason ?? null,
    // never include rpc url / keys
  };
  fs.writeFileSync(OUT, JSON.stringify(safe, null, 2) + '\n');
  return safe;
}

async function main() {
  const rpcUrl = getBigNetworkRpcUrl();
  if (!rpcUrl) {
    const status = writeStatus({
      ok: false,
      envFound: false,
      source: 'unavailable',
      reason: 'missing',
      updatedAt: new Date().toISOString(),
    });
    console.log(JSON.stringify({ written: OUT, ...status }));
    return;
  }

  const started = Date.now();
  const [health, slot, perf] = await Promise.all([
    rpcCall(rpcUrl, 'getHealth'),
    rpcCall(rpcUrl, 'getSlot'),
    rpcCall(rpcUrl, 'getRecentPerformanceSamples', [5]),
  ]);
  const latencyMs = Date.now() - started;
  const tps = computeTps(perf.result);
  const ok = Boolean(health.ok || slot.ok);

  const status = writeStatus({
    ok,
    envFound: true,
    source: ok ? 'rpc' : 'unavailable',
    health: health.ok ? (health.result ?? 'ok') : null,
    slot: slot.ok && typeof slot.result === 'number' ? slot.result : null,
    tps: tps != null && Number.isFinite(tps) ? Math.round(tps * 10) / 10 : null,
    latencyMs,
    reason: ok ? null : 'rpc_error',
    updatedAt: new Date().toISOString(),
  });
  console.log(JSON.stringify({ written: OUT, envFound: true, ok: status.ok, source: status.source, tps: status.tps, slot: status.slot }));
}

main().catch((err) => {
  writeStatus({
    ok: false,
    envFound: Boolean(getBigNetworkRpcUrl()),
    source: 'unavailable',
    reason: 'probe_exception',
    updatedAt: new Date().toISOString(),
  });
  console.error('probe failed:', err?.message ?? 'error');
  process.exitCode = 1;
});
