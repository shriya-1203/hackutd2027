// Server-only NVIDIA Nemotron client. Never imported by client bundles.
// The API key lives in the NVIDIA_API_KEY server secret and is read per-request.

const ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions";
// Verified callable with the configured key (2026-11). Override with the NVIDIA_MODEL secret.
// For multimodal (image) reasoning, switch to nvidia/nemotron-3.5-super-vl-120b-a12b (also verified).
const MODEL = process.env["NVIDIA_MODEL"] ?? "nvidia/nemotron-3.5-lightning-30b-a3b";

export type NemotronResult =
  | { ok: true; text: string; model: string }
  | { ok: false; error: string };

export async function nemotronChat(system: string, user: string): Promise<NemotronResult> {
  const key = process.env["NVIDIA_API_KEY"];
  if (!key) return { ok: false, error: "NVIDIA_API_KEY is not configured" };

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0.2,
          // Generous budget: reasoning models spend tokens on hidden reasoning first;
          // too small a budget leaves the visible answer empty.
          max_tokens: 4096,
        }),
      });

      if (res.ok) {
        const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        // Never surface reasoning_content: it is the model's private chain-of-thought,
        // not an operator-facing explanation.
        const text = j.choices?.[0]?.message?.content?.trim() ?? "";
        if (text) return { ok: true, text, model: MODEL };
        return { ok: false, error: "Nemotron returned an empty completion" };
      }

      // Only 429 and 5xx are retryable, once, after a pause. Everything else is terminal.
      if ((res.status === 429 || res.status >= 500) && attempt === 0) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      return { ok: false, error: `NVIDIA API responded ${res.status}` };
    } catch {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      return { ok: false, error: "Network error reaching the NVIDIA API" };
    }
  }
  return { ok: false, error: "Nemotron unavailable" };
}
