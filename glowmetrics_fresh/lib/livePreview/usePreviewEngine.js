'use client';

// Live Mode Preview engine — a fully local, isolated simulation.
//
// STRICT ISOLATION (do not violate): this hook must never import supabase,
// fetch, useLiveSessionEngine, or any /api/live/* route, and must never
// create, update, or read a real database row. Every value here lives only
// in React state for the lifetime of this component. A static-import check
// enforcing this lives at scripts/verify-preview-isolation.js.

import { useCallback, useEffect, useRef, useState } from 'react';
import { SCENARIOS, SCENARIO_ORDER } from './scenarios';

const AUTOPLAY_INTERVAL_MS = 6000;
let idCounter = 0;
const nextId = () => `preview-${++idCounter}`;

const initialState = {
  status: 'idle', // 'idle' | 'running' | 'ended'
  elapsedSeconds: 0,
  tips: [],
  totalUsd: 0,
  totalTokens: 0,
  tipCount: 0,
  uniqueTippers: 0,
  goalTokens: 1000,
  lastActivitySeconds: null, // elapsedSeconds value at the last mock tip
  activePrompt: null,
  history: [],
  currentScenarioId: null,
  playAuto: false,
};

export function usePreviewEngine() {
  const [state, setState] = useState(initialState);
  const tickerRef = useRef(null);
  const autoplayRef = useRef(null);
  const tipperSetRef = useRef(new Set());

  useEffect(() => () => {
    clearInterval(tickerRef.current);
    clearInterval(autoplayRef.current);
  }, []);

  const start = useCallback(() => {
    tipperSetRef.current = new Set();
    setState({ ...initialState, status: 'running' });
    clearInterval(tickerRef.current);
    tickerRef.current = setInterval(() => {
      setState((s) => (s.status === 'running' ? { ...s, elapsedSeconds: s.elapsedSeconds + 1 } : s));
    }, 1000);
  }, []);

  const stopTimers = useCallback(() => {
    clearInterval(tickerRef.current);
    clearInterval(autoplayRef.current);
    tickerRef.current = null;
    autoplayRef.current = null;
  }, []);

  const stop = useCallback(() => {
    stopTimers();
    setState((s) => {
      const history = s.activePrompt
        ? [{ ...s.activePrompt, status: s.activePrompt.status === 'unmarked' ? 'unmarked' : s.activePrompt.status }, ...s.history]
        : s.history;
      return { ...s, status: 'ended', activePrompt: null, history, playAuto: false };
    });
  }, [stopTimers]);

  const restart = useCallback(() => {
    stopTimers();
    tipperSetRef.current = new Set();
    setState(initialState);
  }, [stopTimers]);

  const applyScenario = useCallback((scenarioId) => {
    const scenario = SCENARIOS[scenarioId];
    if (!scenario) return;

    if (scenarioId === 'end_stream') {
      stop();
      return;
    }

    setState((s) => {
      if (s.status !== 'running') return s;

      let tips = s.tips;
      let totalUsd = s.totalUsd;
      let totalTokens = s.totalTokens;
      let tipCount = s.tipCount;
      let lastActivitySeconds = s.lastActivitySeconds;

      scenario.tips.forEach((t) => {
        tipperSetRef.current.add(t.username);
        tips = [{ id: nextId(), ...t, atSecond: s.elapsedSeconds }, ...tips].slice(0, 20);
        totalUsd = parseFloat((totalUsd + t.usd).toFixed(2));
        totalTokens += t.tokens;
        tipCount += 1;
        lastActivitySeconds = s.elapsedSeconds;
      });

      // Only one active prompt at a time, matching production — an
      // unanswered prompt is moved into history (as 'unmarked') the moment
      // a new one takes its place, never silently dropped.
      let history = s.history;
      if (s.activePrompt) {
        history = [s.activePrompt, ...history];
      }

      const activePrompt = scenario.prompt
        ? { id: nextId(), ...scenario.prompt, status: 'unmarked', firedAtSecond: s.elapsedSeconds }
        : null;

      return {
        ...s,
        tips,
        totalUsd,
        totalTokens,
        tipCount,
        lastActivitySeconds,
        uniqueTippers: tipperSetRef.current.size,
        activePrompt,
        history,
        currentScenarioId: scenarioId,
      };
    });
  }, [stop]);

  const advance = useCallback(() => {
    setState((s) => {
      if (s.status !== 'running') return s;
      const idx = s.currentScenarioId ? SCENARIO_ORDER.indexOf(s.currentScenarioId) : -1;
      const next = SCENARIO_ORDER[Math.min(idx + 1, SCENARIO_ORDER.length - 1)];
      // applyScenario reads/writes via setState itself; schedule it right
      // after this update settles so we don't nest setState calls.
      queueMicrotask(() => applyScenario(next));
      return s;
    });
  }, [applyScenario]);

  const togglePlay = useCallback(() => {
    setState((s) => {
      const playAuto = !s.playAuto;
      clearInterval(autoplayRef.current);
      if (playAuto && s.status === 'running') {
        autoplayRef.current = setInterval(() => advance(), AUTOPLAY_INTERVAL_MS);
      }
      return { ...s, playAuto };
    });
  }, [advance]);

  // Responds to the currently-active prompt: clears it and files it into
  // history with the chosen status. Never touches any real API.
  const respondActive = useCallback((status) => {
    setState((s) => {
      if (!s.activePrompt) return s;
      const answered = { ...s.activePrompt, status };
      return { ...s, activePrompt: null, history: [answered, ...s.history] };
    });
  }, []);

  // Changes the response already recorded on a history entry — required so
  // users can demonstrate "change a prompt response" without it needing to
  // still be the active prompt.
  const changeHistoryResponse = useCallback((entryId, status) => {
    setState((s) => ({
      ...s,
      history: s.history.map((h) => (h.id === entryId ? { ...h, status } : h)),
    }));
  }, []);

  const goalProgress = state.goalTokens > 0 ? Math.min(100, Math.round((state.totalTokens / state.goalTokens) * 100)) : 0;
  const elapsedMinutes = state.elapsedSeconds / 60;
  const paceUsdPerHour = elapsedMinutes > 0 ? (state.totalUsd / elapsedMinutes) * 60 : 0;
  const secondsSinceActivity = state.lastActivitySeconds !== null ? state.elapsedSeconds - state.lastActivitySeconds : null;

  return {
    ...state,
    goalProgress,
    paceUsdPerHour,
    secondsSinceActivity,
    start,
    stop,
    restart,
    advance,
    togglePlay,
    setScenario: applyScenario,
    respondActive,
    changeHistoryResponse,
  };
}
