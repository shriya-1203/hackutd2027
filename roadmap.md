# NexusDC Major Upgrade Roadmap

## Iteration 2
- [x] Isolated split-screen rack inspection, free camera, blade history and critical indicators
- [x] Consistent simulated hardware hierarchy and aggregate counts
- [x] Top-left menu and operational Overview / prominent Business incident
- [x] Shared decision-sensitive predictions, future timeline and persistent approval graph
- [x] One recommended plan, session-retained audit and private append-only Cloud schema
- [x] Verify decisions, execution, inspection and live six-agent flow; 12 tests passed
- [ ] Verify authenticated Cloud audit readback — blocked: no signed-up auth users; demo session persistence verified

## Setup
- [x] Enable Lovable Cloud (backend for secure Nemotron calls + secret storage)
- [x] Store NVIDIA API key as a server-side secret (never in frontend code)

## Phase 1 — UI & Visualization
- [x] Blade-level data model (32 racks × 8 blades, per-blade health/telemetry) — src/lib/infra-data.ts
- [x] 3D twin: click rack → isolated inspection → individual blades visible & colored
- [x] Blade click → stats panel (CPU/mem/temp/power/errors/failure risk/action)
- [x] Back-to-overview + click-outside-to-deselect, hover tooltips, 5-color legend
- [x] Preserve existing dark theme as required by Iteration 2 (supersedes exact palette alignment)

## Phase 2 — Timeline
- [x] Draggable scrubber with play/pause, step, speed, event markers — src/components/nexus/Timeline.tsx
- [x] Simulated historical telemetry (6h) shared by 3D map + panels
- [x] Scrubbing updates rack/blade colors, stats, predictions

## Phase 3 — Nemotron multi-agent
- [x] Secure server-side Nemotron service (retry, JSON, fallback, key server-only) — src/lib/nemotron.server.ts
- [x] 6 agents orchestrated with structured findings — src/lib/agents.ts
- [x] Agent activity dashboard with live status + chronological feed — /assistants
- [x] Verified live: model nvidia/nemotron-3.5-lightning-30b-a3b (multimodal option documented)

## Phase 4 — Simulation
- [x] Internal alternatives evaluated; one primary recommendation and decision-sensitive health graph shown
- [ ] Separate calibrated evaluation-metrics page — blocked: no labeled observed outcomes to calculate detection accuracy / false-positive rate

## Phase 5 — Troubleshoot workflow
- [x] Auto-Heal → Troubleshoot renamed everywhere
- [x] Troubleshoot = analyze → reason → simulate → proposed plan (no silent execution)
- [x] Approval UI: per-action approve/reject, reanalysis, final confirmation
- [x] Simulated execution + verification + audit trail

## Verify
- [x] Browser-tested: 3D drill-down, timeline, full Troubleshoot flow, live Nemotron badges
