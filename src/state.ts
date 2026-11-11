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

/**
 * `agent_start` 会在自动重试、压缩重试时再次触发。只有上一轮已结束时才重置起始时间，
 * 否则最终报告的耗时只是最后一次尝试，而不是整轮。
 */
export function beginRun(state: RunState, now: number, inFlight: boolean): RunState {
  return inFlight ? state : createRunState(now);
}
