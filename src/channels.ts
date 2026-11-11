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

/** Writes straight to stdout: the terminal may or may not act on it, and never reports back. */
export function sendOsc(sequence: string): void {
  process.stdout.write(sequence);
}

/** Fire-and-forget: detached + unref keeps it from blocking exit, and the error handler stops ENOENT from surfacing. */
export function sendSystem(transport: SystemTransport, title: string, body: string): void {
  const { command, args } = buildSystemCommand(transport, title, body);
  try {
    const child = spawn(command, args, { stdio: "ignore", detached: true });
    child.on("error", () => {});
    child.unref();
  } catch {
    // An unavailable channel stays silent; a failed notification must never affect the agent.
  }
}

/** Sound hook, independent of the notification channel, off by default. */
export function runSoundHook(env: Env): void {
  const command = env.PI_BELL_SOUND_CMD;
  if (!command) return;
  try {
    const child = spawn(command, { shell: true, stdio: "ignore", detached: true });
    child.on("error", () => {});
    child.unref();
  } catch {
    // Same as above: a failing hook must not affect the main flow.
  }
}
