import { test } from "node:test";
import assert from "node:assert/strict";
import { decideChannel, oscVariant } from "../src/detect.ts";

const warp = { TERM_PROGRAM: "WarpTerminal" };

test("kitty 用 OSC 99，其余已知终端用 OSC 777", () => {
  assert.equal(oscVariant({ KITTY_WINDOW_ID: "1" }), "osc99");
  assert.equal(oscVariant(warp), "osc777");
  assert.equal(oscVariant({ TERM_PROGRAM: "Apple_Terminal" }), null);
  assert.equal(oscVariant({}), null);
});

test("本地直连 Warp → OSC 777，不包装", () => {
  assert.deepEqual(decideChannel(warp, "darwin"), {
    channel: "osc", variant: "osc777", passthrough: false, transport: "macos",
  });
});

test("本地未知终端 → 系统级", () => {
  assert.deepEqual(decideChannel({ TERM_PROGRAM: "Apple_Terminal" }, "darwin"), {
    channel: "system", variant: null, passthrough: false, transport: "macos",
  });
});

test("本地 tmux → 系统级（不改 tmux 配置也能用）", () => {
  assert.deepEqual(decideChannel({ ...warp, TMUX: "/tmp/tmux-0" }, "darwin"), {
    channel: "system", variant: null, passthrough: false, transport: "macos",
  });
});

test("本地 tmux + PI_BELL_TMUX_PASSTHROUGH=1 → OSC 并在 DCS 里包装", () => {
  assert.deepEqual(
    decideChannel({ ...warp, TMUX: "/tmp/tmux-0", PI_BELL_TMUX_PASSTHROUGH: "1" }, "darwin"),
    { channel: "osc", variant: "osc777", passthrough: true, transport: "macos" },
  );
});

test("SSH 且终端未知 → 仍然赌 OSC 777（系统级会弹在远端）", () => {
  assert.deepEqual(decideChannel({ SSH_TTY: "/dev/pts/3" }, "darwin"), {
    channel: "osc", variant: "osc777", passthrough: false, transport: "macos",
  });
});

test("远端 tmux → OSC 并在 DCS 里包装", () => {
  assert.deepEqual(decideChannel({ SSH_CONNECTION: "1 2 3 4", TMUX: "/tmp/tmux-0" }, "darwin"), {
    channel: "osc", variant: "osc777", passthrough: true, transport: "macos",
  });
});

test("远端 tmux 且显式关闭 passthrough → 退回系统级", () => {
  assert.deepEqual(
    decideChannel({ SSH_CONNECTION: "1 2 3 4", TMUX: "/tmp/tmux-0", PI_BELL_TMUX_PASSTHROUGH: "0" }, "linux"),
    { channel: "system", variant: null, passthrough: false, transport: "linux" },
  );
});

test("Linux 与 Windows 的系统级通道", () => {
  assert.equal(decideChannel({}, "linux").transport, "linux");
  assert.equal(decideChannel({}, "win32").transport, "windows");
});

test("未知平台无从通知 → off", () => {
  assert.deepEqual(decideChannel({}, "freebsd"), {
    channel: "off", variant: null, passthrough: false, transport: null,
  });
});

test("PI_BELL_CHANNEL 覆盖探测", () => {
  assert.equal(decideChannel({ ...warp, PI_BELL_CHANNEL: "off" }, "darwin").channel, "off");
  assert.deepEqual(decideChannel({ ...warp, PI_BELL_CHANNEL: "system" }, "darwin"), {
    channel: "system", variant: null, passthrough: false, transport: "macos",
  });
  assert.deepEqual(decideChannel({ PI_BELL_CHANNEL: "osc" }, "darwin"), {
    channel: "osc", variant: "osc777", passthrough: false, transport: "macos",
  });
});
