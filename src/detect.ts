export type Env = Record<string, string | undefined>;

export type OscVariant = "osc777" | "osc99";
export type SystemTransport = "macos" | "linux" | "windows";

export type ChannelDecision = {
  channel: "osc" | "system" | "off";
  variant: OscVariant | null;
  passthrough: boolean;
  transport: SystemTransport | null;
};

const OSC777_TERMINALS = new Set([
  "WarpTerminal",
  "iTerm.app",
  "WezTerm",
  "ghostty",
  "vscode",
  "Hyper",
]);

function transportFor(platform: string): SystemTransport | null {
  if (platform === "darwin") return "macos";
  if (platform === "linux") return "linux";
  if (platform === "win32") return "windows";
  return null;
}

/** Terminals known to support OSC notifications; Apple_Terminal and Alacritty are not among them. */
export function oscVariant(env: Env): OscVariant | null {
  if (env.KITTY_WINDOW_ID || (env.TERM ?? "").includes("kitty")) return "osc99";
  if (env.TERM_PROGRAM && OSC777_TERMINALS.has(env.TERM_PROGRAM)) return "osc777";
  return null;
}

export function decideChannel(env: Env, platform: string): ChannelDecision {
  const transport = transportFor(platform);
  const ssh = Boolean(env.SSH_CONNECTION || env.SSH_TTY);
  const mux = Boolean(env.TMUX || env.STY || env.ZELLIJ);
  const allowPassthrough = env.PI_BELL_TMUX_PASSTHROUGH !== "0";

  const off: ChannelDecision = { channel: "off", variant: null, passthrough: false, transport: null };
  const system: ChannelDecision = transport
    ? { channel: "system", variant: null, passthrough: false, transport }
    : off;
  const osc = (passthrough: boolean): ChannelDecision => ({
    channel: "osc",
    variant: oscVariant(env) ?? "osc777",
    passthrough,
    transport,
  });

  const override = env.PI_BELL_CHANNEL;
  if (override === "off") return off;
  if (override === "system") return system;
  if (override === "osc") return osc(mux && allowPassthrough);

  // The order is the design: check SSH first (it decides whether a system notification is
  // even useful), then the multiplexer (it decides whether the OSC needs DCS wrapping).
  if (ssh && mux) return allowPassthrough ? osc(true) : system;
  if (ssh) return osc(false);
  if (mux) return allowPassthrough && env.PI_BELL_TMUX_PASSTHROUGH === "1" ? osc(true) : system;

  return oscVariant(env) ? osc(false) : system;
}

export type DeliveryMode = "tui" | "rpc" | "json" | "print";

export type Delivery =
  | { kind: "osc"; variant: OscVariant; passthrough: boolean }
  | { kind: "system"; transport: SystemTransport }
  | { kind: "none" };

/**
 * Only TUI mode gets a notification: in print and json mode the caller reads the result,
 * in RPC mode stdout is a JSON stream that an OSC sequence would corrupt, and a system
 * notification is pointless for an unattended run.
 */
export function chooseDelivery(decision: ChannelDecision, mode: DeliveryMode): Delivery {
  if (mode !== "tui" || decision.channel === "off") return { kind: "none" };
  if (decision.channel === "osc") {
    return { kind: "osc", variant: decision.variant ?? "osc777", passthrough: decision.passthrough };
  }
  return decision.transport ? { kind: "system", transport: decision.transport } : { kind: "none" };
}
