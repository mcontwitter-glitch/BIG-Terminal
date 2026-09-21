import type {
  Agent,
  AgentRole,
  ChecklistItem,
  LogEntry,
  SimFilters,
  SimMetrics,
  SimState,
  Task,
  TaskStep,
} from '../types';
import {
  REAL_AGENT_COUNT,
  getRealAgentTier,
  isRealAgent,
} from '../live/realAgents';

const ROLES: AgentRole[] = ['planner', 'coder', 'reviewer', 'researcher', 'ops'];
const ROLE_WEIGHTS = [0.12, 0.35, 0.18, 0.2, 0.15];

const TASK_TEMPLATES = [
  'Deploy swarm protocol',
  'Validate mesh integrity',
  'Sync agent memory banks',
  'Optimize routing table',
  'Compile consensus report',
  'Audit collaboration graph',
  'Provision compute shard',
  'Reconcile task ledger',
  'Run adversarial probe',
  'Merge knowledge fragments',
  'Calibrate sensor net',
  'Encrypt channel keys',
  'Rebuild index shards',
  'Simulate edge failover',
  'Generate threat model',
];

const STEP_POOL: Array<{ label: string; role: AgentRole }> = [
  { label: 'Scope requirements', role: 'planner' },
  { label: 'Gather intelligence', role: 'researcher' },
  { label: 'Draft implementation', role: 'coder' },
  { label: 'Peer review patch', role: 'reviewer' },
  { label: 'Provision resources', role: 'ops' },
  { label: 'Integrate modules', role: 'coder' },
  { label: 'Validate outputs', role: 'reviewer' },
  { label: 'Publish findings', role: 'researcher' },
  { label: 'Orchestrate rollout', role: 'ops' },
  { label: 'Finalize plan', role: 'planner' },
];

function rand(seed: { v: number }) {
  seed.v = (seed.v * 1664525 + 1013904223) >>> 0;
  return seed.v / 0xffffffff;
}

function pickRole(r: number): AgentRole {
  let acc = 0;
  for (let i = 0; i < ROLES.length; i++) {
    acc += ROLE_WEIGHTS[i];
    if (r < acc) return ROLES[i];
  }
  return 'coder';
}

function hexChunk(n: number): string {
  return n.toString(16).padStart(8, '0').toUpperCase();
}

function makeHex(seed: { v: number }): string {
  return `0x${hexChunk((rand(seed) * 0xffffffff) >>> 0)}_${hexChunk((rand(seed) * 0xffffffff) >>> 0)}`;
}

function fibonacciSphere(i: number, n: number, radius: number) {
  const phi = Math.acos(1 - (2 * (i + 0.5)) / n);
  const theta = Math.PI * (1 + Math.sqrt(5)) * i;
  return {
    x: radius * Math.sin(phi) * Math.cos(theta),
    y: radius * Math.cos(phi) * 0.85,
    z: radius * Math.sin(phi) * Math.sin(theta),
  };
}

function createAgents(count: number, seed: { v: number }): Agent[] {
  const agents: Agent[] = [];
  const clusters = 8;
  for (let i = 0; i < count; i++) {
    const cluster = i % clusters;
    const base = fibonacciSphere(i, count, 22 + (cluster % 3) * 1.4);
    const jitter = 0.35;
    const role = pickRole(rand(seed));
    const realTier = getRealAgentTier(i);
    const live = realTier != null;
    agents.push({
      id: i,
      name: `BIGFOOT#${String(i + 1).padStart(4, '0')}`,
      role,
      // Real agents prefer working; others ~93% hot → ~1400/1500
      status: live || rand(seed) > 0.07 ? 'working' : 'idle',
      x: base.x + (rand(seed) - 0.5) * jitter,
      y: base.y + (rand(seed) - 0.5) * jitter,
      z: base.z + (rand(seed) - 0.5) * jitter,
      taskId: null,
      progress: live ? 0.35 + rand(seed) * 0.4 : 0,
      cluster,
      live,
      tier: realTier ?? 'sim',
    });
  }
  return agents;
}

function buildEdges(agents: Agent[], maxEdges: number, seed: { v: number }): Array<[number, number]> {
  const edges: Array<[number, number]> = [];
  const byCluster = new Map<number, number[]>();
  for (const a of agents) {
    const list = byCluster.get(a.cluster) ?? [];
    list.push(a.id);
    byCluster.set(a.cluster, list);
  }

  // Intra-cluster connections (local mesh)
  for (const ids of byCluster.values()) {
    for (let i = 0; i < ids.length; i++) {
      const degree = 2 + Math.floor(rand(seed) * 3);
      for (let d = 1; d <= degree; d++) {
        const j = (i + d) % ids.length;
        if (ids[i] < ids[j]) edges.push([ids[i], ids[j]]);
      }
    }
  }

  // Inter-cluster bridges
  const clusterIds = [...byCluster.keys()];
  for (let c = 0; c < clusterIds.length; c++) {
    const a = byCluster.get(clusterIds[c])!;
    const b = byCluster.get(clusterIds[(c + 1) % clusterIds.length])!;
    const bridges = 8;
    for (let i = 0; i < bridges; i++) {
      const ai = a[Math.floor(rand(seed) * a.length)];
      const bi = b[Math.floor(rand(seed) * b.length)];
      edges.push([Math.min(ai, bi), Math.max(ai, bi)]);
    }
  }

  // Role affinity links (planners/reviewers as hubs)
  const hubs = agents.filter((a) => a.role === 'planner' || a.role === 'ops').slice(0, 40);
  for (const h of hubs) {
    for (let i = 0; i < 6; i++) {
      const t = Math.floor(rand(seed) * agents.length);
      if (t !== h.id) edges.push([Math.min(h.id, t), Math.max(h.id, t)]);
    }
  }

  // Dedup + cap
  const seen = new Set<string>();
  const unique: Array<[number, number]> = [];
  for (const e of edges) {
    const k = `${e[0]}-${e[1]}`;
    if (!seen.has(k)) {
      seen.add(k);
      unique.push(e);
      if (unique.length >= maxEdges) break;
    }
  }
  return unique;
}

function createTask(id: number, seed: { v: number }): Task {
  const name = TASK_TEMPLATES[Math.floor(rand(seed) * TASK_TEMPLATES.length)];
  const stepCount = 3 + Math.floor(rand(seed) * 3);
  const steps: TaskStep[] = [];
  const used = new Set<number>();
  for (let i = 0; i < stepCount; i++) {
    let idx = Math.floor(rand(seed) * STEP_POOL.length);
    let guard = 0;
    while (used.has(idx) && guard++ < 10) idx = Math.floor(rand(seed) * STEP_POOL.length);
    used.add(idx);
    const s = STEP_POOL[idx];
    steps.push({ id: `${id}-${i}`, label: s.label, role: s.role, done: false });
  }
  return {
    id,
    name: `${name} #${id}`,
    status: 'pending',
    steps,
    agents: [],
    createdAt: Date.now(),
    progress: 0,
  };
}

function createChecklist(): ChecklistItem[] {
  return [
    { id: 'c1', label: '0xA7F3_MESH_BOOTSTRAP', done: true },
    { id: 'c2', label: '0xB21C_KEY_EXCHANGE', done: true },
    { id: 'c3', label: '0xC9E0_ROLE_BINDING', done: true },
    { id: 'c4', label: '0xD44A_TASK_SCHEDULER', done: true },
    { id: 'c5', label: '0xE1F8_CONSENSUS_RING', done: false },
    { id: 'c6', label: '0xF03B_EDGE_VALIDATE', done: false },
  ];
}

export function createInitialState(agentCount = 1500): SimState {
  const seed = { v: 0xa9e17000 };
  const agents = createAgents(agentCount, seed);
  const edges = buildEdges(agents, 4200, seed);
  const tasks: Task[] = [];
  for (let i = 0; i < 24; i++) tasks.push(createTask(i + 1, seed));

  const logs: LogEntry[] = [];
  for (let i = 0; i < 18; i++) {
    logs.push({
      id: i,
      ts: Date.now() - (18 - i) * 400,
      hex: makeHex(seed),
      message: i % 3 === 0 ? 'SECURE CORE handshake' : `_cryptographic_validation... [OK]`,
      kind: i % 5 === 0 ? 'task' : 'ok',
    });
  }

  // Assign some agents to initial tasks
  let working = 0;
  for (const task of tasks.slice(0, 12)) {
    task.status = 'active';
    for (const step of task.steps) {
      const candidate = agents.find(
        (a) => a.status === 'idle' && a.role === step.role && a.taskId === null,
      );
      if (candidate) {
        candidate.status = 'working';
        candidate.taskId = task.id;
        candidate.progress = rand(seed);
        task.agents.push(candidate.id);
        working++;
      }
    }
  }

  const metrics: SimMetrics = {
    activeAgents: 1400,
    totalAgents: agentCount,
    tps: 27000,
    latencyMs: 18.4,
    computeUsed: 0.15,
    swarmIntegrity: 0.94,
    tasksActive: 12,
    tasksComplete: 0,
    messagesPerSec: 128,
    realAgentsOnline: REAL_AGENT_COUNT,
  };

  return {
    agents,
    tasks,
    logs,
    pulses: [],
    checklist: createChecklist(),
    metrics,
    paused: false,
    speed: 2,
    tick: 0,
    selectedAgentId: null,
    selectedTaskId: null,
    filters: { role: 'all', status: 'all', search: '' },
    edges,
  };
}

let logId = 100;
let pulseId = 1;
let nextTaskId = 100;

function pushLog(state: SimState, message: string, kind: LogEntry['kind'], seed: { v: number }) {
  state.logs.push({
    id: logId++,
    ts: Date.now(),
    hex: makeHex(seed),
    message,
    kind,
  });
  if (state.logs.length > 80) state.logs.splice(0, state.logs.length - 80);
}

function findEdgeNeighbor(state: SimState, agentId: number, seed: { v: number }): number | null {
  const candidates: number[] = [];
  for (const [a, b] of state.edges) {
    if (a === agentId) candidates.push(b);
    else if (b === agentId) candidates.push(a);
  }
  if (!candidates.length) return Math.floor(rand(seed) * state.agents.length);
  return candidates[Math.floor(rand(seed) * candidates.length)];
}

export function tickSimulation(state: SimState, dt: number): SimState {
  if (state.paused) return state;

  const seed = { v: (state.tick * 9973 + 0x51a00) >>> 0 };

  const speed = state.speed;
  const scaled = dt * speed;
  state.tick += 1;

  // Advance message pulses
  for (let i = state.pulses.length - 1; i >= 0; i--) {
    state.pulses[i].progress += scaled * 1.8;
    if (state.pulses[i].progress >= 1) state.pulses.splice(i, 1);
  }

  // Spawn collaboration pulses from working agents
  const pulseBudget = Math.min(12, Math.floor(2 + scaled * 8));
  let spawned = 0;
  for (let n = 0; n < pulseBudget && spawned < pulseBudget; n++) {
    const idx = Math.floor(rand(seed) * state.agents.length);
    const agent = state.agents[idx];
    if (agent.status !== 'working' && agent.status !== 'waiting') continue;
    const to = findEdgeNeighbor(state, agent.id, seed);
    if (to == null) continue;
    state.pulses.push({
      id: pulseId++,
      from: agent.id,
      to,
      progress: 0,
      color: agent.role === 'coder' ? 0x4fc3f7 : 0x00e5ff,
    });
    spawned++;
  }

  // Advance working agents / tasks
  let activeCount = 0;
  let doneCount = 0;
  let errCount = 0;

  for (const agent of state.agents) {
    if (agent.status === 'working') {
      activeCount++;
      agent.progress += scaled * (0.08 + rand(seed) * 0.12);
      if (agent.progress >= 1) {
        agent.progress = 1;
        const task = state.tasks.find((t) => t.id === agent.taskId);
        if (task) {
          const step = task.steps.find((s) => !s.done && s.role === agent.role);
          if (step) {
            step.done = true;
            pushLog(
              state,
              `${agent.name} completed "${step.label}" on ${task.name}`,
              'ok',
              seed,
            );
          }
          const doneSteps = task.steps.filter((s) => s.done).length;
          task.progress = doneSteps / task.steps.length;
          if (doneSteps === task.steps.length) {
            task.status = 'complete';
            pushLog(state, `TASK COMPLETE // ${task.name}`, 'task', seed);
            for (const aid of task.agents) {
              const a = state.agents[aid];
              if (a) {
                a.status = 'done';
                a.taskId = null;
                a.progress = 0;
              }
            }
            // checklist progress
            const pending = state.checklist.find((c) => !c.done);
            if (pending && rand(seed) > 0.55) pending.done = true;
          } else {
            agent.status = rand(seed) > 0.15 ? 'waiting' : 'idle';
            if (agent.status === 'idle') agent.taskId = null;
          }
        } else {
          agent.status = 'idle';
          agent.taskId = null;
          agent.progress = 0;
        }
      }
    } else if (agent.status === 'waiting') {
      activeCount++;
      if (rand(seed) > 0.97) {
        agent.status = 'working';
        agent.progress = 0;
        const to = findEdgeNeighbor(state, agent.id, seed);
        if (to != null) {
          state.pulses.push({
            id: pulseId++,
            from: agent.id,
            to,
            progress: 0,
            color: 0x00ffc8,
          });
        }
      }
    } else if (agent.status === 'done') {
      doneCount++;
      if (rand(seed) > 0.985) {
        agent.status = 'idle';
      }
    } else if (agent.status === 'error') {
      errCount++;
      if (rand(seed) > 0.99) agent.status = 'idle';
    } else if (agent.status === 'idle' && rand(seed) > 0.9993) {
      agent.status = 'error';
      pushLog(state, `${agent.name} fault — retrying channel`, 'warn', seed);
    }
  }

  // Claim work for idle agents matching pending steps
  for (const task of state.tasks) {
    if (task.status !== 'active' && task.status !== 'pending') continue;
    if (task.status === 'pending') task.status = 'active';
    for (const step of task.steps) {
      if (step.done) continue;
      const already = task.agents.some((id) => {
        const a = state.agents[id];
        return a && a.role === step.role && (a.status === 'working' || a.status === 'waiting');
      });
      if (already) continue;
      const candidate = state.agents.find(
        (a) => a.status === 'idle' && a.role === step.role && a.taskId === null,
      );
      if (candidate) {
        candidate.status = 'working';
        candidate.taskId = task.id;
        candidate.progress = 0;
        if (!task.agents.includes(candidate.id)) task.agents.push(candidate.id);
        pushLog(state, `${candidate.name} claimed "${step.label}"`, 'info', seed);
        const collab = task.agents[Math.floor(rand(seed) * task.agents.length)];
        if (collab !== undefined && collab !== candidate.id) {
          state.pulses.push({
            id: pulseId++,
            from: candidate.id,
            to: collab,
            progress: 0,
            color: 0x7c9cff,
          });
        }
      }
    }
  }

  // Spawn new tasks continuously
  const activeTasks = state.tasks.filter((t) => t.status === 'active' || t.status === 'pending').length;
  if (activeTasks < 18 && rand(seed) > 0.92) {
    const t = createTask(nextTaskId++, seed);
    t.status = 'pending';
    state.tasks.push(t);
    pushLog(state, `TASK SPAWN // ${t.name}`, 'task', seed);
    if (state.tasks.length > 60) {
      // prune old completed
      const keep = state.tasks.filter((t) => t.status !== 'complete').concat(
        state.tasks.filter((t) => t.status === 'complete').slice(-10),
      );
      state.tasks.length = 0;
      state.tasks.push(...keep);
    }
  }

  // Cap pulses for perf
  if (state.pulses.length > 80) state.pulses.splice(0, state.pulses.length - 80);

  const completed = state.tasks.filter((t) => t.status === 'complete').length;
  activeCount = state.agents.filter((a) => a.status === 'working' || a.status === 'waiting').length;

  // Keep the hive hot: ~1400 / 1500 agents active
  const TARGET_ACTIVE = 1400;
  const targetActive = Math.max(
    1385,
    Math.min(
      1415,
      Math.round(TARGET_ACTIVE + Math.sin(state.tick * 0.07) * 8 + (rand(seed) - 0.5) * 6),
    ),
  );
  let liveIds = state.agents
    .filter((a) => a.status === 'working' || a.status === 'waiting')
    .map((a) => a.id);
  if (liveIds.length < targetActive) {
    for (const a of state.agents) {
      if (liveIds.length >= targetActive) break;
      if (a.status === 'idle' || a.status === 'done' || a.status === 'error') {
        a.status = 'working';
        a.progress = Math.min(0.95, Math.max(a.progress, rand(seed) * 0.4));
        liveIds.push(a.id);
      }
    }
  } else if (liveIds.length > targetActive) {
    for (let i = liveIds.length - 1; i >= 0 && liveIds.length > targetActive; i--) {
      const a = state.agents[liveIds[i]];
      // Never idle out real/live agents — keep them preferentially working
      if (a.live || isRealAgent(a.id)) continue;
      if ((i + state.tick) % 3 === 0) {
        a.status = 'idle';
        a.taskId = null;
        liveIds.splice(i, 1);
      }
    }
  }
  // Ensure all live agents stay hot
  for (const a of state.agents) {
    if (a.live && a.status !== 'working' && a.status !== 'waiting') {
      a.status = 'working';
      a.progress = Math.min(0.95, Math.max(a.progress, rand(seed) * 0.4));
    }
  }
  activeCount = state.agents.filter((a) => a.status === 'working' || a.status === 'waiting').length;
  const realAgentsOnline = state.agents.filter(
    (a) => a.live && (a.status === 'working' || a.status === 'waiting'),
  ).length;

  state.metrics = {
    activeAgents: activeCount,
    totalAgents: state.agents.length,
    tps: 27000 + Math.sin(state.tick * 0.08) * 400 + (rand(seed) - 0.5) * 600,
    latencyMs: 12 + rand(seed) * 14 + (errCount > 5 ? 8 : 0),
    computeUsed: Math.min(0.18, Math.max(0.12, 0.15 + Math.sin(state.tick * 0.12) * 0.012 + (rand(seed) - 0.5) * 0.01)),
    swarmIntegrity: Math.min(0.999, 0.88 + (1 - errCount / 50) * 0.1 + rand(seed) * 0.02),
    tasksActive: activeTasks,
    tasksComplete: completed,
    messagesPerSec: spawned / Math.max(scaled, 0.016) * 0.4 + 40 + rand(seed) * 30,
    realAgentsOnline,
  };

  return state;
}

export function applyFilters(agents: Agent[], filters: SimFilters): Agent[] {
  const q = filters.search.trim().toLowerCase();
  return agents.filter((a) => {
    if (filters.role !== 'all' && a.role !== filters.role) return false;
    if (filters.status !== 'all' && a.status !== filters.status) return false;
    if (q && !a.name.toLowerCase().includes(q) && !String(a.id).includes(q)) return false;
    return true;
  });
}

export function setPaused(state: SimState, paused: boolean): SimState {
  state.paused = paused;
  return state;
}

export function setSpeed(state: SimState, speed: number): SimState {
  state.speed = speed;
  return state;
}

export function setFilters(state: SimState, filters: Partial<SimFilters>): SimState {
  state.filters = { ...state.filters, ...filters };
  return state;
}

export function selectAgent(state: SimState, id: number | null): SimState {
  state.selectedAgentId = id;
  if (id != null) {
    const a = state.agents[id];
    state.selectedTaskId = a?.taskId ?? null;
  }
  return state;
}

export function selectTask(state: SimState, id: number | null): SimState {
  state.selectedTaskId = id;
  return state;
}
