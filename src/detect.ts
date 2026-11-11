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

/** 已知支持 OSC 通知的终端；Apple_Terminal 与 Alacritty 不在其中，它们只能走系统级。 */
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

  // 顺序即设计：先判 SSH（决定系统级能不能用），再判复用器（决定要不要 DCS 包装）。
  if (ssh && mux) return allowPassthrough ? osc(true) : system;
  if (ssh) return osc(false);
  if (mux) return allowPassthrough && env.PI_BELL_TMUX_PASSTHROUGH === "1" ? osc(true) : system;

  return oscVariant(env) ? osc(false) : system;
}
