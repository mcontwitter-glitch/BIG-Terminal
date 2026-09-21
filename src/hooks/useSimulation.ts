import { useCallback, useEffect, useRef, useState } from 'react';
import type { SimFilters, SimState } from '../types';
import {
  createInitialState,
  selectAgent,
  selectTask,
  setFilters,
  setPaused,
  setSpeed,
  tickSimulation,
} from '../simulation/engine';

const AGENT_COUNT = 1500;

export function useSimulation() {
  const stateRef = useRef<SimState>(createInitialState(AGENT_COUNT));
  const [snapshot, setSnapshot] = useState(() => ({
    metrics: stateRef.current.metrics,
    logs: stateRef.current.logs.slice(-40),
    checklist: stateRef.current.checklist,
    tasks: stateRef.current.tasks,
    paused: false,
    speed: 2,
    filters: stateRef.current.filters,
    selectedAgentId: null as number | null,
    selectedTaskId: null as number | null,
    tick: 0,
  }));

  const rafRef = useRef(0);
  const lastRef = useRef(performance.now());
  const uiAccRef = useRef(0);

  useEffect(() => {
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - lastRef.current) / 1000);
      lastRef.current = now;
      tickSimulation(stateRef.current, dt);
      uiAccRef.current += dt;
      // UI refresh ~10fps to keep React light; Three.js reads ref each frame
      if (uiAccRef.current >= 0.1) {
        uiAccRef.current = 0;
        const s = stateRef.current;
        setSnapshot({
          metrics: { ...s.metrics },
          logs: s.logs.slice(-40),
          checklist: s.checklist.map((c) => ({ ...c })),
          tasks: s.tasks.map((t) => ({
            ...t,
            steps: t.steps.map((st) => ({ ...st })),
            agents: [...t.agents],
          })),
          paused: s.paused,
          speed: s.speed,
          filters: { ...s.filters },
          selectedAgentId: s.selectedAgentId,
          selectedTaskId: s.selectedTaskId,
          tick: s.tick,
        });
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const pause = useCallback(() => {
    setPaused(stateRef.current, true);
  }, []);

  const resume = useCallback(() => {
    setPaused(stateRef.current, false);
  }, []);

  const togglePause = useCallback(() => {
    setPaused(stateRef.current, !stateRef.current.paused);
  }, []);

  const changeSpeed = useCallback((speed: number) => {
    setSpeed(stateRef.current, speed);
    setSnapshot((prev) => ({ ...prev, speed }));
  }, []);

  const updateFilters = useCallback((f: Partial<SimFilters>) => {
    setFilters(stateRef.current, f);
  }, []);

  const onSelectAgent = useCallback((id: number | null) => {
    selectAgent(stateRef.current, id);
  }, []);

  const onSelectTask = useCallback((id: number | null) => {
    selectTask(stateRef.current, id);
  }, []);

  const getAgent = useCallback((id: number) => stateRef.current.agents[id], []);
  const getState = useCallback(() => stateRef.current, []);

  return {
    snapshot,
    stateRef,
    getState,
    getAgent,
    pause,
    resume,
    togglePause,
    changeSpeed,
    updateFilters,
    onSelectAgent,
    onSelectTask,
    roles: ['all', 'planner', 'coder', 'reviewer', 'researcher', 'ops'] as const,
    statuses: ['all', 'idle', 'working', 'waiting', 'done', 'error'] as const,
  };
}

export type SimulationApi = ReturnType<typeof useSimulation>;
