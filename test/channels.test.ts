import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSystemCommand, escapeAppleScript, renderOsc, sanitizeOscField } from "../src/channels.ts";

test("field separators and control characters are stripped from OSC fields", () => {
  assert.equal(sanitizeOscField("a;b\x07c\nd"), "a,bc d");
});

test("OSC 777 is terminated with BEL", () => {
  assert.equal(
    renderOsc({ variant: "osc777", passthrough: false, title: "Pi ✓", body: "done · 1s" }),
    "\x1b]777;notify;Pi ✓;done · 1s\x07",
  );
});

test("tmux wrapping uses DCS and ST", () => {
  assert.equal(
    renderOsc({ variant: "osc777", passthrough: true, title: "Pi ✓", body: "done · 1s" }),
    "\x1bPtmux;\x1b]777;notify;Pi ✓;done · 1s\x1b\\\x1b\\",
  );
});

test("kitty uses the two-part OSC 99 form", () => {
  assert.equal(
    renderOsc({ variant: "osc99", passthrough: false, title: "Pi ✕", body: "failed" }),
    "\x1b]99;i=pi-bell:d=0;Pi ✕\x1b\\\x1b]99;i=pi-bell:p=body;failed\x1b\\",
  );
});

test("quotes, backslashes, and newlines are escaped inside an AppleScript string", () => {
  assert.equal(escapeAppleScript('he said "hi"\nthere\\'), 'he said \\"hi\\" there\\\\');
});

test("macOS uses osascript", () => {
  assert.deepEqual(buildSystemCommand("macos", "Pi ✓", "done · 1s"), {
    command: "osascript",
    args: ["-e", 'display notification "done · 1s" with title "Pi ✓"'],
  });
});

test("the macOS script stays valid when the body contains quotes", () => {
  assert.deepEqual(buildSystemCommand("macos", "Pi ✕", 'say "boom"'), {
    command: "osascript",
    args: ["-e", 'display notification "say \\"boom\\"" with title "Pi ✕"'],
  });
});

test("Linux uses notify-send with title and body as separate arguments", () => {
  assert.deepEqual(buildSystemCommand("linux", "Pi ⚠", "aborted · 5s"), {
    command: "notify-send",
    args: ["Pi ⚠", "aborted · 5s"],
  });
});

test("Windows uses a PowerShell toast and doubles single quotes", () => {
  const { command, args } = buildSystemCommand("windows", "Pi ✓", "it's done");
  assert.equal(command, "powershell.exe");
  assert.equal(args[0], "-NoProfile");
  assert.equal(args[1], "-Command");
  assert.ok(args[2]!.includes("it''s done"));
  assert.ok(args[2]!.includes("CreateToastNotifier('Pi ✓')"));
});
