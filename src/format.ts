export type Outcome = "done" | "truncated" | "aborted" | "error";

export type NotificationText = { title: string; body: string };

const ANSI_OSC = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;
const ANSI_CSI = /\x1b\[[0-9;?]*[ -/]*[@-~]/g;

const LABELS: Record<Outcome, string> = {
  done: "done",
  truncated: "done (truncated)",
  aborted: "aborted",
  error: "failed",
};

const TITLES: Record<Outcome, string> = {
  done: "Pi ✓",
  truncated: "Pi ✓",
  aborted: "Pi ⚠",
  error: "Pi ✕",
};

/** Strip escape sequences and markdown markers, collapse whitespace, truncate with an ellipsis. */
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
    const firstLine = cleanText((errorMessage ?? "").split("\n")[0] ?? "", 80) || "unknown error";
    body += ` — ${firstLine}`;
  }

  return { title: TITLES[outcome], body };
}
