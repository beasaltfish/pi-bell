import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanText, formatDuration, formatNotification } from "../src/format.ts";

test("cleanText 剥掉 ANSI 与 markdown，并折叠空白", () => {
  assert.equal(cleanText("\x1b[31m**boom**\x1b[0m\n\n  `x`  "), "boom x");
});

test("cleanText 截断到 120 并补省略号", () => {
  const out = cleanText("a".repeat(130));
  assert.equal(out.length, 120);
  assert.ok(out.endsWith("…"));
});

test("formatDuration 覆盖秒/分/时", () => {
  assert.equal(formatDuration(42_400), "42s");
  assert.equal(formatDuration(72_000), "1m12s");
  assert.equal(formatDuration(3_930_000), "1h5m");
});

test("完成态", () => {
  assert.deepEqual(
    formatNotification({ outcome: "done", durationMs: 42_400, project: "pi-bell" }),
    { title: "Pi ✓", body: "完成 · 42s · pi-bell" },
  );
});

test("截断态在正文里标注", () => {
  assert.deepEqual(
    formatNotification({ outcome: "truncated", durationMs: 900, project: "pi-bell" }),
    { title: "Pi ✓", body: "完成(截断) · 1s · pi-bell" },
  );
});

test("中止态", () => {
  assert.deepEqual(
    formatNotification({ outcome: "aborted", durationMs: 5_000, project: "pi-bell" }),
    { title: "Pi ⚠", body: "已中止 · 5s · pi-bell" },
  );
});

test("失败态只取错误首行", () => {
  assert.deepEqual(
    formatNotification({
      outcome: "error",
      durationMs: 4_000,
      project: "pi-bell",
      errorMessage: "401 unauthorized\nstack line 2",
    }),
    { title: "Pi ✕", body: "失败 · 4s · pi-bell — 401 unauthorized" },
  );
});

test("失败但没有错误文本时不留空洞", () => {
  assert.deepEqual(
    formatNotification({ outcome: "error", durationMs: 1_000, project: "pi-bell" }),
    { title: "Pi ✕", body: "失败 · 1s · pi-bell — 未知错误" },
  );
});

test("项目名为空时省略该段", () => {
  assert.deepEqual(
    formatNotification({ outcome: "done", durationMs: 1_000, project: "" }),
    { title: "Pi ✓", body: "完成 · 1s" },
  );
});
