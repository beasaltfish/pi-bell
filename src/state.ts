import type { Outcome } from "./format.ts";

export type StopReason =
  | "pending"
  | "stop"
  | "length"
  | "toolUse"
  | "error"
  | "aborted"
  | "deferred";

export type RunState = {
  startedAt: number;
  lastStopReason: StopReason | null;
  lastErrorMessage: string | null;
};

export function createRunState(now: number): RunState {
  return { startedAt: now, lastStopReason: null, lastErrorMessage: null };
}

export function recordAssistantMessage(
  state: RunState,
  msg: { stopReason: StopReason | null; errorMessage?: string },
): RunState {
  return {
    ...state,
    lastStopReason: msg.stopReason,
    lastErrorMessage: msg.errorMessage ?? null,
  };
}

export function decideOutcome(state: RunState, aborted: boolean): Outcome {
  if (aborted) return "aborted";
  if (state.lastStopReason === "error") return "error";
  if (state.lastStopReason === "aborted") return "aborted";
  if (state.lastStopReason === "length") return "truncated";
  return "done";
}

export function elapsedMs(state: RunState, now: number): number {
  return now - state.startedAt;
}
