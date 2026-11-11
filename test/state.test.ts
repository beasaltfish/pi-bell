import { test } from "node:test";
import assert from "node:assert/strict";
import { createRunState, decideOutcome, elapsedMs, recordAssistantMessage } from "../src/state.ts";

test("新状态没有记录任何结局", () => {
  assert.deepEqual(createRunState(1000), { startedAt: 1000, lastStopReason: null, lastErrorMessage: null });
});

test("记录最后一条 assistant 消息", () => {
  const s = recordAssistantMessage(createRunState(0), { stopReason: "error", errorMessage: "boom" });
  assert.equal(s.lastStopReason, "error");
  assert.equal(s.lastErrorMessage, "boom");
});

test("记录不修改原对象，后一条覆盖前一条", () => {
  const first = recordAssistantMessage(createRunState(0), { stopReason: "toolUse" });
  const second = recordAssistantMessage(first, { stopReason: "stop" });
  assert.equal(first.lastStopReason, "toolUse");
  assert.equal(second.lastStopReason, "stop");
  assert.equal(second.lastErrorMessage, null);
});

test("用户中止优先于错误", () => {
  const s = recordAssistantMessage(createRunState(0), { stopReason: "error", errorMessage: "boom" });
  assert.equal(decideOutcome(s, true), "aborted");
});

test("模型侧 aborted 也判中止", () => {
  const s = recordAssistantMessage(createRunState(0), { stopReason: "aborted" });
  assert.equal(decideOutcome(s, false), "aborted");
});

test("length 判截断而非失败", () => {
  const s = recordAssistantMessage(createRunState(0), { stopReason: "length" });
  assert.equal(decideOutcome(s, false), "truncated");
});

test("错误判失败", () => {
  const s = recordAssistantMessage(createRunState(0), { stopReason: "error", errorMessage: "boom" });
  assert.equal(decideOutcome(s, false), "error");
});

test("没有任何 assistant 消息时判完成（已知局限，README 会写明）", () => {
  assert.equal(decideOutcome(createRunState(0), false), "done");
});

test("elapsedMs 用传入的 now 计算", () => {
  assert.equal(elapsedMs(createRunState(1_000), 43_400), 42_400);
});
