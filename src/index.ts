import { basename } from "node:path";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { renderOsc, runSoundHook, sendOsc, sendSystem } from "./channels.ts";
import { decideChannel, type ChannelDecision } from "./detect.ts";
import { formatNotification } from "./format.ts";
import {
  createRunState,
  decideOutcome,
  elapsedMs,
  recordAssistantMessage,
  type StopReason,
} from "./state.ts";

type Mode = "tui" | "rpc" | "json" | "print";

function deliver(decision: ChannelDecision, mode: Mode, title: string, body: string): void {
  if (decision.channel === "off") return;

  if (decision.channel === "osc") {
    // 不变量：decideChannel 在 channel === "osc" 时保证 variant 非空（每条 osc 分支都带 `?? "osc777"`）。
    // RPC 的 stdout 是 JSON 流，写 OSC 会破坏协议，所以只在 TUI 模式直发，其余降级到系统级。
    if (mode === "tui") {
      sendOsc(
        renderOsc({
          variant: decision.variant!,
          passthrough: decision.passthrough,
          title,
          body,
        }),
      );
      return;
    }
    if (!decision.transport) return;
    sendSystem(decision.transport, title, body);
    return;
  }

  if (!decision.transport) return;
  sendSystem(decision.transport, title, body);
}

function describe(decision: ChannelDecision): string {
  const parts: string[] = [decision.channel];
  if (decision.variant) parts.push(decision.variant);
  if (decision.passthrough) parts.push("passthrough");
  if (decision.transport) parts.push(decision.transport);
  return parts.join(" / ");
}

export default function (pi: ExtensionAPI) {
  let state = createRunState(Date.now());

  pi.on("agent_start", () => {
    state = createRunState(Date.now());
  });

  pi.on("message_end", (event) => {
    if (event.message.role !== "assistant") return;
    const message = event.message as AssistantMessage;
    state = recordAssistantMessage(state, {
      stopReason: (message.stopReason as StopReason | undefined) ?? null,
      errorMessage: message.errorMessage,
    });
  });

  pi.on("agent_settled", (event, ctx) => {
    if (!ctx.hasUI) return;

    const decision = decideChannel(process.env, process.platform);
    const { title, body } = formatNotification({
      outcome: decideOutcome(state, event.aborted),
      durationMs: elapsedMs(state, Date.now()),
      project: basename(ctx.cwd),
      errorMessage: state.lastErrorMessage ?? undefined,
    });

    deliver(decision, ctx.mode, title, body);
    runSoundHook(process.env);
  });

  pi.registerCommand("bell-test", {
    description: "Send a test notification and report the detected channel",
    handler: async (_args, ctx) => {
      const decision = decideChannel(process.env, process.platform);
      const { title, body } = formatNotification({
        outcome: "done",
        durationMs: 42_000,
        project: basename(ctx.cwd),
      });

      deliver(decision, ctx.mode, title, body);
      ctx.ui.notify(`pi-bell: ${describe(decision)}`, "info");
      ctx.ui.notify(`已发送：${title} — ${body}`, "info");
    },
  });
}
