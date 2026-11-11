import { test } from "node:test";
import assert from "node:assert/strict";
import { chooseDelivery, decideChannel, oscVariant } from "../src/detect.ts";

const warp = { TERM_PROGRAM: "WarpTerminal" };

test("kitty uses OSC 99, other known terminals use OSC 777", () => {
  assert.equal(oscVariant({ KITTY_WINDOW_ID: "1" }), "osc99");
  assert.equal(oscVariant(warp), "osc777");
  assert.equal(oscVariant({ TERM_PROGRAM: "Apple_Terminal" }), null);
  assert.equal(oscVariant({}), null);
});

test("local Warp with no multiplexer gets OSC 777, unwrapped", () => {
  assert.deepEqual(decideChannel(warp, "darwin"), {
    channel: "osc", variant: "osc777", passthrough: false, transport: "macos",
  });
});

test("an unknown local terminal falls back to a system notification", () => {
  assert.deepEqual(decideChannel({ TERM_PROGRAM: "Apple_Terminal" }, "darwin"), {
    channel: "system", variant: null, passthrough: false, transport: "macos",
  });
});

test("local tmux uses a system notification (works without touching the tmux config)", () => {
  assert.deepEqual(decideChannel({ ...warp, TMUX: "/tmp/tmux-0" }, "darwin"), {
    channel: "system", variant: null, passthrough: false, transport: "macos",
  });
});

test("local tmux with PI_BELL_TMUX_PASSTHROUGH=1 sends OSC wrapped in DCS", () => {
  assert.deepEqual(
    decideChannel({ ...warp, TMUX: "/tmp/tmux-0", PI_BELL_TMUX_PASSTHROUGH: "1" }, "darwin"),
    { channel: "osc", variant: "osc777", passthrough: true, transport: "macos" },
  );
});

test("over SSH with an unknown terminal it still bets on OSC 777 (a system notification would fire on the remote host)", () => {
  assert.deepEqual(decideChannel({ SSH_TTY: "/dev/pts/3" }, "darwin"), {
    channel: "osc", variant: "osc777", passthrough: false, transport: "macos",
  });
});

test("remote tmux sends OSC wrapped in DCS", () => {
  assert.deepEqual(decideChannel({ SSH_CONNECTION: "1 2 3 4", TMUX: "/tmp/tmux-0" }, "darwin"), {
    channel: "osc", variant: "osc777", passthrough: true, transport: "macos",
  });
});

test("remote tmux with passthrough explicitly disabled falls back to a system notification", () => {
  assert.deepEqual(
    decideChannel({ SSH_CONNECTION: "1 2 3 4", TMUX: "/tmp/tmux-0", PI_BELL_TMUX_PASSTHROUGH: "0" }, "linux"),
    { channel: "system", variant: null, passthrough: false, transport: "linux" },
  );
});

test("system transport on Linux and Windows", () => {
  assert.equal(decideChannel({}, "linux").transport, "linux");
  assert.equal(decideChannel({}, "win32").transport, "windows");
});

test("an unknown platform has no way to notify, so it is off", () => {
  assert.deepEqual(decideChannel({}, "freebsd"), {
    channel: "off", variant: null, passthrough: false, transport: null,
  });
});

test("PI_BELL_CHANNEL overrides detection", () => {
  assert.equal(decideChannel({ ...warp, PI_BELL_CHANNEL: "off" }, "darwin").channel, "off");
  assert.deepEqual(decideChannel({ ...warp, PI_BELL_CHANNEL: "system" }, "darwin"), {
    channel: "system", variant: null, passthrough: false, transport: "macos",
  });
  assert.deepEqual(decideChannel({ PI_BELL_CHANNEL: "osc" }, "darwin"), {
    channel: "osc", variant: "osc777", passthrough: false, transport: "macos",
  });
});

test("nothing is delivered outside TUI mode: print/json/RPC callers read the result themselves", () => {
  const osc = decideChannel(warp, "darwin");
  assert.deepEqual(chooseDelivery(osc, "rpc"), { kind: "none" });
  assert.deepEqual(chooseDelivery(osc, "json"), { kind: "none" });
  assert.deepEqual(chooseDelivery(osc, "print"), { kind: "none" });
});

test("in TUI mode an osc decision delivers the escape sequence", () => {
  assert.deepEqual(chooseDelivery(decideChannel(warp, "darwin"), "tui"), {
    kind: "osc", variant: "osc777", passthrough: false,
  });
});

test("in TUI mode a system decision delivers a system notification", () => {
  assert.deepEqual(chooseDelivery(decideChannel({ TERM_PROGRAM: "Apple_Terminal" }, "darwin"), "tui"), {
    kind: "system", transport: "macos",
  });
});

test("an off decision delivers nothing", () => {
  assert.deepEqual(chooseDelivery(decideChannel({ ...warp, PI_BELL_CHANNEL: "off" }, "darwin"), "tui"), {
    kind: "none",
  });
});
