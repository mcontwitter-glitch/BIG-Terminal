# BIG Terminal

**Live:** https://mcontwitter-glitch.github.io/BIG-Terminal/


Cinematic cyan holographic command-center HUD that simulates **1500 collaborative agents** working on shared multi-step tasks. Pure client-side — Vite + React + TypeScript + Three.js.

## Quick start

```bash
cd BIG-Terminal
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

Open **http://localhost:5173** (or the host URL printed by Vite).

Production build:

```bash
npm run build
npm run preview -- --host 0.0.0.0 --port 5173
```

## What you get

- **Central 3D mesh** — 1500 instanced agent nodes + edge links + activity pulses (Three.js / WebGL)
- **Left HUD** — network status, scrolling secure-core logs, validation checklist
- **Right HUD** — BIG NETWORK node card, Task Engine (contract-style), real-time data stream
- **Controls** — pause/resume, simulation speed, filter by role/status, search, click node for inspector

### Agent roles

`planner` · `coder` · `reviewer` · `researcher` · `ops`

### Statuses

`idle` · `working` · `waiting` · `done` · `error`

## Key files

| Path | Purpose |
|------|---------|
| `src/App.tsx` | Layout shell |
| `src/simulation/engine.ts` | 1500-agent simulation, tasks, pulses, metrics |
| `src/components/NetworkViz.tsx` | Three.js instanced mesh + pulses |
| `src/components/LeftPanels.tsx` / `RightPanels.tsx` | Holographic HUD panels |
| `src/components/Controls.tsx` | Pause, speed, filters, search |
| `src/components/DetailDrawer.tsx` | Agent/task inspector |
| `src/hooks/useSimulation.ts` | RAF loop + React snapshot bridge |
| `src/types.ts` | Shared types |

## Performance notes

- Agents rendered via `THREE.InstancedMesh` (single draw call)
- Edge graph capped (~2800 segments) with cluster + hub topology
- Message pulses capped at 80 concurrent sprites
- React UI refreshes ~10 Hz; Three.js renders every frame from a mutable ref

## Known limits

- Desktop / widescreen first; narrow mobile layouts are secondary
- Filter dims non-matching nodes in the 3D view; large searches are client-side only
- No backend — simulation resets on full page reload
- Bloom is approximated via emissive materials + CSS glow (no postprocessing pass, keeps laptop FPS high)

## License

Demo / MIT — use freely.
