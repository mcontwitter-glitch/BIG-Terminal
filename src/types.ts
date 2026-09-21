export type AgentRole = 'planner' | 'coder' | 'reviewer' | 'researcher' | 'ops';
export type AgentStatus = 'idle' | 'working' | 'waiting' | 'done' | 'error';

export interface Agent {
  id: number;
  name: string;
  role: AgentRole;
  status: AgentStatus;
  x: number;
  y: number;
  z: number;
  taskId: number | null;
  progress: number;
  cluster: number;
  /** True when this node maps to a real on-chain agent. */
  live?: boolean;
  /** Visual / operational tier; sim = simulated only. */
  tier?: 'red' | 'white' | 'sim';
}

export interface TaskStep {
  id: string;
  label: string;
  role: AgentRole;
  done: boolean;
}

export interface Task {
  id: number;
  name: string;
  status: 'pending' | 'active' | 'validating' | 'complete' | 'failed';
  steps: TaskStep[];
  agents: number[];
  createdAt: number;
  progress: number;
}

export interface LogEntry {
  id: number;
  ts: number;
  hex: string;
  message: string;
  kind: 'info' | 'ok' | 'warn' | 'error' | 'task';
}

export interface MessagePulse {
  id: number;
  from: number;
  to: number;
  progress: number;
  color: number;
}

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface SimMetrics {
  activeAgents: number;
  totalAgents: number;
  tps: number;
  latencyMs: number;
  computeUsed: number;
  swarmIntegrity: number;
  tasksActive: number;
  tasksComplete: number;
  messagesPerSec: number;
  /** Count of live-tier agents currently working or waiting. */
  realAgentsOnline: number;
}

export interface SimFilters {
  role: AgentRole | 'all';
  status: AgentStatus | 'all';
  search: string;
}

export interface SimState {
  agents: Agent[];
  tasks: Task[];
  logs: LogEntry[];
  pulses: MessagePulse[];
  checklist: ChecklistItem[];
  metrics: SimMetrics;
  paused: boolean;
  speed: number;
  tick: number;
  selectedAgentId: number | null;
  selectedTaskId: number | null;
  filters: SimFilters;
  edges: Array<[number, number]>;
}

export const ROLE_COLORS: Record<AgentRole, string> = {
  planner: '#00e5ff',
  coder: '#4fc3f7',
  reviewer: '#00ffc8',
  researcher: '#7c9cff',
  ops: '#00b8d4',
};

export const STATUS_LABELS: Record<AgentStatus, string> = {
  idle: 'IDLE',
  working: 'WORKING',
  waiting: 'WAITING',
  done: 'DONE',
  error: 'ERROR',
};

export const ROLE_LABELS: Record<AgentRole, string> = {
  planner: 'PLANNER',
  coder: 'CODER',
  reviewer: 'REVIEWER',
  researcher: 'RESEARCHER',
  ops: 'OPS',
};
