import { spawn } from "node:child_process";
import type { Env, OscVariant, SystemTransport } from "./detect.ts";

const ST = "\x1b\\";
const BEL = "\x07";

export function sanitizeOscField(value: string): string {
  return value
    .replace(/\x07/g, "")
    .replace(/\x1b/g, "")
    .replace(/;/g, ",")
    .replace(/\s+/g, " ")
    .trim();
}

export function escapeAppleScript(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
}

function escapePowerShellSingleQuoted(value: string): string {
  return value.replace(/'/g, "''");
}

export function renderOsc(input: {
  variant: OscVariant;
  passthrough: boolean;
  title: string;
  body: string;
}): string {
  const title = sanitizeOscField(input.title);
  const body = sanitizeOscField(input.body);

  const sequences =
    input.variant === "osc99"
      ? [`\x1b]99;i=pi-bell:d=0;${title}`, `\x1b]99;i=pi-bell:p=body;${body}`]
      : [`\x1b]777;notify;${title};${body}`];

  const terminator = input.variant === "osc99" || input.passthrough ? ST : BEL;

  return sequences
    .map((sequence) => {
      const terminated = `${sequence}${terminator}`;
      return input.passthrough ? `\x1bPtmux;${terminated}${ST}` : terminated;
    })
    .join("");
}

function windowsToastScript(title: string, body: string): string {
  const type = "Windows.UI.Notifications";
  const manager = `[${type}.ToastNotificationManager, ${type}, ContentType = WindowsRuntime]`;
  const template = `[${type}.ToastTemplateType]::ToastText01`;
  const toast = `[${type}.ToastNotification]::new($xml)`;
  return [
    `${manager} > $null`,
    `$xml = [${type}.ToastNotificationManager]::GetTemplateContent(${template})`,
    `$xml.GetElementsByTagName('text')[0].AppendChild($xml.CreateTextNode('${escapePowerShellSingleQuoted(body)}')) > $null`,
    `[${type}.ToastNotificationManager]::CreateToastNotifier('${escapePowerShellSingleQuoted(title)}').Show(${toast})`,
  ].join("; ");
}

export function buildSystemCommand(
  transport: SystemTransport,
  title: string,
  body: string,
): { command: string; args: string[] } {
  if (transport === "macos") {
    return {
      command: "osascript",
      args: [
        "-e",
        `display notification "${escapeAppleScript(body)}" with title "${escapeAppleScript(title)}"`,
      ],
    };
  }

  if (transport === "linux") {
    return { command: "notify-send", args: [title, body] };
  }

  return {
    command: "powershell.exe",
    args: ["-NoProfile", "-Command", windowsToastScript(title, body)],
  };
}

/** 裸写 stdout：终端把这段字节当成通知请求，不回执，所以无法得知是否成功。 */
export function sendOsc(sequence: string): void {
  process.stdout.write(sequence);
}

/** fire-and-forget：detached + unref 不阻塞退出，吞掉 error 以免 ENOENT 冒成未捕获异常。 */
export function sendSystem(transport: SystemTransport, title: string, body: string): void {
  const { command, args } = buildSystemCommand(transport, title, body);
  try {
    const child = spawn(command, args, { stdio: "ignore", detached: true });
    child.on("error", () => {});
    child.unref();
  } catch {
    // 通道不可用就静默，通知失败不能影响 agent。
  }
}

/** 与通知通道无关的声音钩子，默认不启用。 */
export function runSoundHook(env: Env): void {
  const command = env.PI_BELL_SOUND_CMD;
  if (!command) return;
  try {
    const child = spawn(command, { shell: true, stdio: "ignore", detached: true });
    child.on("error", () => {});
    child.unref();
  } catch {
    // 同上：钩子失败不影响主流程。
  }
}
