// Client-callable server function for Nemotron reasoning.
// Numbers always come from app code; Nemotron only writes the explanation.
import { createServerFn } from "@tanstack/react-start";
import { nemotronChat } from "./nemotron.server";

export type ReasoningReply =
  | { ok: true; text: string; source: "nemotron"; model: string }
  | { ok: false; error: string; source: "fallback" };

export const nemotronReason = createServerFn({ method: "POST" })
  .inputValidator((data: { agent: string; prompt: string }) => {
    if (!data || typeof data.agent !== "string" || typeof data.prompt !== "string") {
      throw new Error("agent and prompt are required");
    }
    return data;
  })
  .handler(async ({ data }): Promise<ReasoningReply> => {
    const system = [
      `You are the ${data.agent} in a data center operations platform.`,
      "You are given real telemetry measurements. Explain them in 2-3 plain sentences for an operations engineer.",
      "Never invent numbers, components or events that are not in the input. Do not use markdown.",
    ].join(" ");
    const r = await nemotronChat(system, data.prompt);
    if (r.ok) return { ok: true, text: r.text, source: "nemotron", model: r.model };
    console.warn(`[nemotron] ${data.agent}: ${r.error}`);
    return { ok: false, error: r.error, source: "fallback" };
  });
