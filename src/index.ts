import { basename } from "node:path";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { renderOsc, runSoundHook, sendOsc, sendSystem } from "./channels.ts";
import { chooseDelivery, decideChannel, type ChannelDecision, type Delivery } from "./detect.ts";
import { formatNotification } from "./format.ts";
import {
  beginRun,
  createRunState,
  decideOutcome,
  elapsedMs,
  recordAssistantMessage,
  type StopReason,
} from "./state.ts";

function deliver(delivery: Delivery, title: string, body: string): void {
  if (delivery.kind === "osc") {
    sendOsc(
      renderOsc({
        variant: delivery.variant,
        passthrough: delivery.passthrough,
        title,
        body,
      }),
    );
    return;
  }

  if (delivery.kind === "system") sendSystem(delivery.transport, title, body);
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
  let inFlight = false;

  pi.on("agent_start", () => {
    state = beginRun(state, Date.now(), inFlight);
    inFlight = true;
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
    // Reset first: the next run has to be able to start its own clock even if this one stays silent.
    inFlight = false;
    if (!ctx.hasUI) return;

    const decision = decideChannel(process.env, process.platform);
    const { title, body } = formatNotification({
      outcome: decideOutcome(state, event.aborted),
      durationMs: elapsedMs(state, Date.now()),
      project: basename(ctx.cwd),
      errorMessage: state.lastErrorMessage ?? undefined,
    });

    deliver(chooseDelivery(decision, ctx.mode), title, body);
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

      deliver(chooseDelivery(decision, ctx.mode), title, body);
      ctx.ui.notify(`pi-bell: ${describe(decision)}`, "info");
      ctx.ui.notify(`Sent: ${title} — ${body}`, "info");
    },
  });
}
