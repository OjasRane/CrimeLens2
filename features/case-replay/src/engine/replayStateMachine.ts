import { useCallback, useEffect, useReducer, useRef } from "react";

export type ReplayMode = "intro" | "playing" | "paused" | "summary";

export type ReplayState = {
  mode: ReplayMode;
  eventIndex: number;
  elapsedMs: number;
  speed: number;
};

type ReplayAction =
  | { type: "START" }
  | { type: "TOGGLE" }
  | { type: "TICK"; deltaMs: number; durationMs: number; eventCount: number }
  | { type: "NEXT"; eventCount: number }
  | { type: "PREVIOUS" }
  | { type: "JUMP"; index: number }
  | { type: "SET_SPEED"; speed: number }
  | { type: "RESTART" };

const initialState: ReplayState = {
  mode: "intro",
  eventIndex: 0,
  elapsedMs: 0,
  speed: 1,
};

export function replayReducer(state: ReplayState, action: ReplayAction): ReplayState {
  if (action.type === "START") {
    return { ...state, mode: "playing", elapsedMs: 0 };
  }
  if (action.type === "TOGGLE") {
    if (state.mode === "intro" || state.mode === "summary") return state;
    return { ...state, mode: state.mode === "playing" ? "paused" : "playing" };
  }
  if (action.type === "SET_SPEED") return { ...state, speed: action.speed };
  if (action.type === "RESTART") return { ...initialState };
  if (action.type === "JUMP") {
    return { ...state, mode: "paused", eventIndex: action.index, elapsedMs: 0 };
  }
  if (action.type === "PREVIOUS") {
    return { ...state, mode: "paused", eventIndex: Math.max(0, state.eventIndex - 1), elapsedMs: 0 };
  }
  if (action.type === "NEXT") {
    if (state.eventIndex >= action.eventCount - 1) {
      return { ...state, mode: "summary", elapsedMs: 0 };
    }
    return { ...state, mode: "paused", eventIndex: state.eventIndex + 1, elapsedMs: 0 };
  }
  if (action.type === "TICK" && state.mode === "playing") {
    const elapsedMs = state.elapsedMs + action.deltaMs * state.speed;
    if (elapsedMs < action.durationMs) return { ...state, elapsedMs };
    if (state.eventIndex >= action.eventCount - 1) {
      return { ...state, mode: "summary", elapsedMs: 0 };
    }
    return { ...state, eventIndex: state.eventIndex + 1, elapsedMs: 0 };
  }
  return state;
}

export function useReplayStateMachine(eventCount: number, durations: number | number[] = 9000) {
  const [state, dispatch] = useReducer(replayReducer, initialState);
  const intervalRef = useRef<number | null>(null);
  const previousTimeRef = useRef<number | null>(null);
  const durationMs = Array.isArray(durations)
    ? (durations[state.eventIndex] ?? 9000)
    : durations;

  useEffect(() => {
    if (state.mode !== "playing") {
      previousTimeRef.current = null;
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    previousTimeRef.current = performance.now();
    intervalRef.current = window.setInterval(() => {
      const time = performance.now();
      const previous = previousTimeRef.current ?? time;
      previousTimeRef.current = time;
      dispatch({
        type: "TICK",
        deltaMs: Math.min(250, time - previous),
        durationMs,
        eventCount,
      });
    }, 100);
    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [durationMs, eventCount, state.mode]);

  const start = useCallback(() => dispatch({ type: "START" }), []);
  const toggle = useCallback(() => dispatch({ type: "TOGGLE" }), []);
  const next = useCallback(() => dispatch({ type: "NEXT", eventCount }), [eventCount]);
  const previous = useCallback(() => dispatch({ type: "PREVIOUS" }), []);
  const jump = useCallback((index: number) => dispatch({ type: "JUMP", index }), []);
  const setSpeed = useCallback((speed: number) => dispatch({ type: "SET_SPEED", speed }), []);
  const restart = useCallback(() => dispatch({ type: "RESTART" }), []);

  return {
    state,
    progress: Math.min(1, state.elapsedMs / durationMs),
    phaseIndex: Math.min(2, Math.floor((state.elapsedMs / durationMs) * 3)),
    start,
    toggle,
    next,
    previous,
    jump,
    setSpeed,
    restart,
  };
}
