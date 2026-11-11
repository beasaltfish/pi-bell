export type Outcome = "done" | "truncated" | "aborted" | "error";

export type NotificationText = { title: string; body: string };

const ANSI_OSC = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;
const ANSI_CSI = /\x1b\[[0-9;?]*[ -/]*[@-~]/g;

const LABELS: Record<Outcome, string> = {
  done: "完成",
  truncated: "完成(截断)",
  aborted: "已中止",
  error: "失败",
};

const TITLES: Record<Outcome, string> = {
  done: "Pi ✓",
  truncated: "Pi ✓",
  aborted: "Pi ⚠",
  error: "Pi ✕",
};

/** 剥掉转义序列与 markdown 记号，折叠空白，超长时截断并补省略号。 */
export function cleanText(raw: string, maxLength = 120): string {
  const stripped = raw
    .replace(ANSI_OSC, "")
    .replace(ANSI_CSI, "")
    .replace(/```/g, "")
    .replace(/`/g, "")
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (stripped.length <= maxLength) return stripped;
  return `${stripped.slice(0, maxLength - 1)}…`;
}

export function formatDuration(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m${Math.round((ms % 60_000) / 1000)}s`;
  return `${Math.floor(ms / 3_600_000)}h${Math.floor((ms % 3_600_000) / 60_000)}m`;
}

export function formatNotification(input: {
  outcome: Outcome;
  durationMs: number;
  project: string;
  errorMessage?: string;
}): NotificationText {
  const { outcome, durationMs, project, errorMessage } = input;

  const parts = [LABELS[outcome], formatDuration(durationMs)];
  if (project !== "") parts.push(project);

  let body = parts.join(" · ");
  if (outcome === "error") {
    const firstLine = cleanText((errorMessage ?? "").split("\n")[0] ?? "", 80) || "未知错误";
    body += ` — ${firstLine}`;
  }

  return { title: TITLES[outcome], body };
}
