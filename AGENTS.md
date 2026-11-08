<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->
- NexusDC demo state lives in src/lib/incident-store.tsx (one shared context); all numbers come from src/lib/demo-data.ts, and AI only explains via runAssistant in src/lib/assistants.ts — so a server function can later replace the scripted results.

## Architecture rules (agent-added)

- Blade/rack telemetry and history live in `src/lib/infra-data.ts` (deterministic, seeded); the 3D twin, timeline and agents all read from it — never invent parallel data sources.
- AI reasoning goes through `src/lib/nemotron.functions.ts` → `nemotron.server.ts` (NVIDIA_API_KEY server-side only). AI writes explanations; numbers always come from code. Label fallback reasoning when the API fails.
- The Troubleshoot workflow (idle → analyzing → plan → executing → done) lives in `src/lib/incident-store.tsx`; no infrastructure change may execute without a per-action approval recorded in the audit trail.
- Future trajectories and execution-adjusted observations use pure `src/lib/prediction.ts`, derived from infra-data; approvals change projections only, executed replacements change their own present observations, and investigations never claim repair.
- The synthetic hierarchy explicitly has one blade enclosure per rack containing the existing blade slots; legacy component-reference rows are not chassis or server counts.
- Audit decisions carry condition snapshots and deterministic predictions; authenticated Cloud append-only records are user-scoped, hidden after 90 days, with tab-session demo fallback expiring after 24 hours.
- Rack inspection renders only the selected cabinet; camera commands run on reset/fit or scene transitions, never continuously or on blade selection.
