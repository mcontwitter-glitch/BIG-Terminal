import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REAL_AGENTS = 60

/** Parse .env.local KEY=value without logging values. Does not override existing env. */
function loadEnvLocal() {
  const envPath = path.join(__dirname, '.env.local')
  if (!fs.existsSync(envPath)) return
  const text = fs.readFileSync(envPath, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

function getRpcUrl(): string | null {
  loadEnvLocal()
  const url = process.env.BIG_NETWORK_RPC_URL
  return typeof url === 'string' && url.trim().length > 0 ? url.trim() : null
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return null
  return JSON.parse(raw) as unknown
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(payload)
}

async function rpcCall(
  rpcUrl: string,
  method: string,
  params: unknown[] = [],
): Promise<{ ok: boolean; result?: unknown; error?: string; latencyMs: number }> {
  const started = Date.now()
  try {
    const resp = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'BIG-NETWORK-HUD/1.0',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    })
    const latencyMs = Date.now() - started
    if (!resp.ok) {
      return { ok: false, error: `http_${resp.status}`, latencyMs }
    }
    const data = (await resp.json()) as { result?: unknown; error?: { message?: string } }
    if (data.error) {
      return { ok: false, error: data.error.message ?? 'rpc_error', latencyMs }
    }
    return { ok: true, result: data.result, latencyMs }
  } catch {
    return { ok: false, error: 'fetch_failed', latencyMs: Date.now() - started }
  }
}

type PerfSample = { numTransactions: number; samplePeriodSecs: number }

function computeTps(samples: unknown): number | null {
  if (!Array.isArray(samples) || samples.length === 0) return null
  let totalTx = 0
  let totalSecs = 0
  for (const s of samples as PerfSample[]) {
    if (
      typeof s?.numTransactions === 'number' &&
      typeof s?.samplePeriodSecs === 'number' &&
      s.samplePeriodSecs > 0
    ) {
      totalTx += s.numTransactions
      totalSecs += s.samplePeriodSecs
    }
  }
  if (totalSecs <= 0) return null
  return totalTx / totalSecs
}

async function buildLivePayload() {
  const rpcUrl = getRpcUrl()
  const updatedAt = new Date().toISOString()
  if (!rpcUrl) {
    return {
      ok: false,
      health: null,
      slot: null,
      tps: null,
      latencyMs: null,
      source: 'unavailable' as const,
      realAgents: REAL_AGENTS,
      updatedAt,
      reason: 'missing_rpc_url',
    }
  }

  const started = Date.now()
  const [health, slot, perf] = await Promise.all([
    rpcCall(rpcUrl, 'getHealth'),
    rpcCall(rpcUrl, 'getSlot'),
    rpcCall(rpcUrl, 'getRecentPerformanceSamples', [5]),
  ])
  const latencyMs = Date.now() - started
  const tps = computeTps(perf.result)
  const ok = Boolean(health.ok || slot.ok)

  return {
    ok,
    health: health.ok ? (health.result ?? 'ok') : null,
    slot: slot.ok && typeof slot.result === 'number' ? slot.result : null,
    tps: tps != null && Number.isFinite(tps) ? Math.round(tps * 10) / 10 : null,
    latencyMs,
    source: ok ? ('rpc' as const) : ('unavailable' as const),
    realAgents: REAL_AGENTS,
    updatedAt,
  }
}

function liveApiPlugin(): Plugin {
  return {
    name: 'big-network-live-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0] ?? ''
        if (req.method === 'GET' && url === '/api/live') {
          try {
            const payload = await buildLivePayload()
            sendJson(res, 200, payload)
          } catch {
            sendJson(res, 200, {
              ok: false,
              health: null,
              slot: null,
              tps: null,
              latencyMs: null,
              source: 'unavailable',
              realAgents: REAL_AGENTS,
              updatedAt: new Date().toISOString(),
            })
          }
          return
        }

        if (req.method === 'POST' && url === '/api/rpc') {
          const rpcUrl = getRpcUrl()
          if (!rpcUrl) {
            sendJson(res, 503, { ok: false, error: 'rpc_unavailable' })
            return
          }
          try {
            const body = await readJsonBody(req)
            const resp = await fetch(rpcUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'User-Agent': 'BIG-NETWORK-HUD/1.0',
              },
              body: JSON.stringify(body ?? {}),
            })
            const text = await resp.text()
            res.statusCode = resp.status
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Cache-Control', 'no-store')
            res.end(text)
          } catch {
            sendJson(res, 502, { ok: false, error: 'proxy_failed' })
          }
          return
        }

        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), liveApiPlugin()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
  },
})
