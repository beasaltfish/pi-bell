import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSystemCommand, escapeAppleScript, renderOsc, sanitizeOscField } from "../src/channels.ts";

test("OSC 字段里的分隔符与控制字符被清掉", () => {
  assert.equal(sanitizeOscField("a;b\x07c\nd"), "a,bc d");
});

test("OSC 777 用 BEL 结束", () => {
  assert.equal(
    renderOsc({ variant: "osc777", passthrough: false, title: "Pi ✓", body: "完成 · 1s" }),
    "\x1b]777;notify;Pi ✓;完成 · 1s\x07",
  );
});

test("tmux 包装用 DCS + ST", () => {
  assert.equal(
    renderOsc({ variant: "osc777", passthrough: true, title: "Pi ✓", body: "完成 · 1s" }),
    "\x1bPtmux;\x1b]777;notify;Pi ✓;完成 · 1s\x1b\\\x1b\\",
  );
});

test("kitty 用 OSC 99 的两段式", () => {
  assert.equal(
    renderOsc({ variant: "osc99", passthrough: false, title: "Pi ✕", body: "失败" }),
    "\x1b]99;i=pi-bell:d=0;Pi ✕\x1b\\\x1b]99;i=pi-bell:p=body;失败\x1b\\",
  );
});

test("AppleScript 字符串里的引号、反斜杠、换行被转义", () => {
  assert.equal(escapeAppleScript('he said "hi"\nthere\\'), 'he said \\"hi\\" there\\\\');
});

test("macOS 用 osascript", () => {
  assert.deepEqual(buildSystemCommand("macos", "Pi ✓", "完成 · 1s"), {
    command: "osascript",
    args: ["-e", 'display notification "完成 · 1s" with title "Pi ✓"'],
  });
});

test("macOS 正文含引号时脚本仍是合法的", () => {
  assert.deepEqual(buildSystemCommand("macos", "Pi ✕", 'say "boom"'), {
    command: "osascript",
    args: ["-e", 'display notification "say \\"boom\\"" with title "Pi ✕"'],
  });
});

test("Linux 用 notify-send，标题与正文分开传参", () => {
  assert.deepEqual(buildSystemCommand("linux", "Pi ⚠", "已中止 · 5s"), {
    command: "notify-send",
    args: ["Pi ⚠", "已中止 · 5s"],
  });
});

test("Windows 用 PowerShell toast，单引号加倍", () => {
  const { command, args } = buildSystemCommand("windows", "Pi ✓", "it's done");
  assert.equal(command, "powershell.exe");
  assert.equal(args[0], "-NoProfile");
  assert.equal(args[1], "-Command");
  assert.ok(args[2]!.includes("it''s done"));
  assert.ok(args[2]!.includes("CreateToastNotifier('Pi ✓')"));
});
