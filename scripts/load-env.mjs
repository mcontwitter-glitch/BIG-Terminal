/**
 * Load KEY=value pairs from .env.local into process.env (does not override existing).
 * Never logs secret values. Used by Vite middleware and probe scripts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

export function loadEnvLocal(root = ROOT) {
  const envPath = path.join(root, '.env.local');
  const loaded = [];
  if (!fs.existsSync(envPath)) {
    return { path: envPath, loaded, present: false };
  }
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
      loaded.push(key);
    }
  }
  return { path: envPath, loaded, present: true };
}

export function getBigNetworkRpcUrl() {
  loadEnvLocal();
  const url = process.env.BIG_NETWORK_RPC_URL;
  return typeof url === 'string' && url.trim().length > 0 ? url.trim() : null;
}

// CLI: node scripts/load-env.mjs  → prints only whether key was found
const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const url = getBigNetworkRpcUrl();
  console.log(JSON.stringify({ BIG_NETWORK_RPC_URL: url ? 'present' : 'missing' }));
}
