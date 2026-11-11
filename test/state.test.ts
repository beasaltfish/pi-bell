import { test } from "node:test";
import assert from "node:assert/strict";
import {
  beginRun,
  createRunState,
  decideOutcome,
  elapsedMs,
  recordAssistantMessage,
} from "../src/state.ts";

test("a fresh state records no outcome yet", () => {
  assert.deepEqual(createRunState(1000), { startedAt: 1000, lastStopReason: null, lastErrorMessage: null });
});

test("records the last assistant message", () => {
  const s = recordAssistantMessage(createRunState(0), { stopReason: "error", errorMessage: "boom" });
  assert.equal(s.lastStopReason, "error");
  assert.equal(s.lastErrorMessage, "boom");
});

test("recording leaves the original untouched and the later message wins", () => {
  const first = recordAssistantMessage(createRunState(0), { stopReason: "toolUse" });
  const second = recordAssistantMessage(first, { stopReason: "stop" });
  assert.equal(first.lastStopReason, "toolUse");
  assert.equal(second.lastStopReason, "stop");
  assert.equal(second.lastErrorMessage, null);
});

test("a user abort wins over an error", () => {
  const s = recordAssistantMessage(createRunState(0), { stopReason: "error", errorMessage: "boom" });
  assert.equal(decideOutcome(s, true), "aborted");
});

test("a model-side abort is also reported as aborted", () => {
  const s = recordAssistantMessage(createRunState(0), { stopReason: "aborted" });
  assert.equal(decideOutcome(s, false), "aborted");
});

test("length is reported as truncated, not as a failure", () => {
  const s = recordAssistantMessage(createRunState(0), { stopReason: "length" });
  assert.equal(decideOutcome(s, false), "truncated");
});

test("an error stop reason is reported as a failure", () => {
  const s = recordAssistantMessage(createRunState(0), { stopReason: "error", errorMessage: "boom" });
  assert.equal(decideOutcome(s, false), "error");
});

test("no assistant message at all is reported as done (known limitation, documented in the README)", () => {
  assert.equal(decideOutcome(createRunState(0), false), "done");
});

test("elapsedMs uses the given now", () => {
  assert.equal(elapsedMs(createRunState(1_000), 43_400), 42_400);
});

test("a new run resets the start time", () => {
  assert.equal(beginRun(createRunState(0), 5_000, false).startedAt, 5_000);
});

test("an agent_start caused by a retry keeps the start time (otherwise the duration covers only the last attempt)", () => {
  const first = beginRun(createRunState(0), 5_000, false);
  assert.equal(beginRun(first, 30_000, true).startedAt, 5_000);
});

test("a retry does not discard the outcome recorded so far", () => {
  const failed = recordAssistantMessage(beginRun(createRunState(0), 0, false), {
    stopReason: "error",
    errorMessage: "boom",
  });
  const retried = beginRun(failed, 10_000, true);
  assert.equal(retried.lastStopReason, "error");
  assert.equal(retried.lastErrorMessage, "boom");
});
