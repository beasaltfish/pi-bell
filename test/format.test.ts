import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanText, formatDuration, formatNotification } from "../src/format.ts";

test("cleanText strips ANSI and markdown, then collapses whitespace", () => {
  assert.equal(cleanText("\x1b[31m**boom**\x1b[0m\n\n  `x`  "), "boom x");
});

test("cleanText truncates to 120 characters and appends an ellipsis", () => {
  const out = cleanText("a".repeat(130));
  assert.equal(out.length, 120);
  assert.ok(out.endsWith("…"));
});

test("formatDuration covers seconds, minutes, and hours", () => {
  assert.equal(formatDuration(42_400), "42s");
  assert.equal(formatDuration(72_000), "1m12s");
  assert.equal(formatDuration(3_930_000), "1h5m");
});

test("done outcome", () => {
  assert.deepEqual(
    formatNotification({ outcome: "done", durationMs: 42_400, project: "pi-bell" }),
    { title: "Pi ✓", body: "done · 42s · pi-bell" },
  );
});

test("truncated outcome is labelled in the body", () => {
  assert.deepEqual(
    formatNotification({ outcome: "truncated", durationMs: 900, project: "pi-bell" }),
    { title: "Pi ✓", body: "done (truncated) · 1s · pi-bell" },
  );
});

test("aborted outcome", () => {
  assert.deepEqual(
    formatNotification({ outcome: "aborted", durationMs: 5_000, project: "pi-bell" }),
    { title: "Pi ⚠", body: "aborted · 5s · pi-bell" },
  );
});

test("error outcome keeps only the first line of the error", () => {
  assert.deepEqual(
    formatNotification({
      outcome: "error",
      durationMs: 4_000,
      project: "pi-bell",
      errorMessage: "401 unauthorized\nstack line 2",
    }),
    { title: "Pi ✕", body: "failed · 4s · pi-bell — 401 unauthorized" },
  );
});

test("error without a message does not leave a hole", () => {
  assert.deepEqual(
    formatNotification({ outcome: "error", durationMs: 1_000, project: "pi-bell" }),
    { title: "Pi ✕", body: "failed · 1s · pi-bell — unknown error" },
  );
});

test("empty project name is omitted", () => {
  assert.deepEqual(
    formatNotification({ outcome: "done", durationMs: 1_000, project: "" }),
    { title: "Pi ✓", body: "done · 1s" },
  );
});
