import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { REASONING_LEAK, runAgentWorkflow, type AgentName, type AgentStatus, type Finding, type TroubleshootPlan } from "./agents";
import { INCIDENT } from "./demo-data";
import { TIMELINE_STEP } from "./infra-data";
import { FUTURE_MAX, observedBlades, simulate, type Prediction } from "./prediction";
import { appendOperationalRecord } from "./audit-storage";

// Troubleshoot workflow: idle → analyzing → plan → executing → done.
// Nothing executes without explicit per-action employee approval.
export type TsPhase = "idle" | "analyzing" | "plan" | "executing" | "done";
export type Decision = "approved" | "rejected";
export type FeedEvent = { at: string; agent: string; text: string };
export type AuditEntry = { at: string; actor: string; action: string; detail: string; incidentId?: string; rackId?: string; bladeId?: string; condition?: unknown; prediction?: Prediction };

type Ctx = {
  prediction: Prediction;
  predictionError: string | null;
  auditStorage: string;
  incidentRackId: string;
  setIncidentRackId: (id: string) => void;
  phase: TsPhase;
  healed: boolean; // true once approved actions have been (simulated) executed
  secondsLeft: number;
  confirmOpen: boolean;
  setConfirmOpen: (v: boolean) => void;
  planOpen: boolean;
  setPlanOpen: (v: boolean) => void;
  startTroubleshoot: () => void;
  plan: TroubleshootPlan | null;
  findings: Finding[];
  feed: FeedEvent[];
  agentStatus: Record<AgentName, AgentStatus>;
  decisions: Record<string, Decision>;
  setDecision: (actionId: string, d: Decision) => void;
  executeApproved: () => void;
  executed: string[];
  audit: AuditEntry[];
  // timeline
  minutesAgo: number;
  setMinutesAgo: (m: number) => void;
  playing: boolean;
  setPlaying: (p: boolean) => void;
  speed: number;
  setSpeed: (s: number) => void;
  // existing demo state
  expansionApproved: boolean;
  approveExpansion: () => void;
  handoffSigned: boolean;
  signHandoff: () => void;
  reset: () => void;
};

const IncidentCtx = createContext<Ctx | null>(null);

const IDLE_STATUS = Object.fromEntries(
  ["Infrastructure Monitoring", "Failure Prediction", "Troubleshooting", "Simulation & Evaluation", "Business Impact", "Resource Optimization"].map((n) => [n, "Idle"]),
) as Record<AgentName, AgentStatus>;

const stamp = () => new Date().toISOString();

export function IncidentProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<TsPhase>("idle");
  const [secondsLeft, setSeconds] = useState(INCIDENT.countdownSeconds);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [plan, setPlan] = useState<TroubleshootPlan | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [feed, setFeed] = useState<FeedEvent[]>([]);
  const [agentStatus, setAgentStatus] = useState<Record<AgentName, AgentStatus>>(IDLE_STATUS);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [executed, setExecuted] = useState<string[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [expansionApproved, setExp] = useState(false);
  const [handoffSigned, setSigned] = useState(false);
  const [minutesAgo, setMinutesAgo] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(4);
  const running = useRef(false);
  const [incidentRackId, setIncidentRackId] = useState("R-11");
  const [auditStorage, setAuditStorage] = useState("Session-only simulated records; sign in for private Cloud retention.");
  const [restored, setRestored] = useState(false);
  const [predictionError, setPredictionError] = useState<string | null>(null);
  const lastPrediction = useRef(simulate([], {}));
  const decisionRef = useRef<Record<string, Decision>>({});
  const prediction = useMemo(() => {
    try { const result = simulate(plan?.actions ?? [], decisions, executed); lastPrediction.current = result; return result; }
    catch { return lastPrediction.current; }
  }, [plan, decisions, executed]);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem("nexus-operations-v2") ?? "null");
      if (saved?.savedAt && Date.now() - saved.savedAt < 86400000 && Array.isArray(saved.audit)) {
        // Drop saved recommendations that contain leaked chain-of-thought from an older session.
        if (saved.plan?.recommendation && REASONING_LEAK.test(saved.plan.recommendation)) saved.plan.recommendation = undefined;
        setAudit(saved.audit); setPlan(saved.plan ?? null); setDecisions(saved.decisions ?? {}); decisionRef.current = saved.decisions ?? {}; setExecuted(saved.executed ?? []);
        setPhase(saved.phase === "done" ? "done" : saved.plan ? "plan" : "idle");
      }
    } catch { /* Corrupt demo records do not block operations. */ }
    setRestored(true);
  }, []);
  useEffect(() => {
    if (restored) { try { sessionStorage.setItem("nexus-operations-v2", JSON.stringify({ savedAt: Date.now(), audit, plan, decisions, executed, phase })); } catch { setAuditStorage("Session storage unavailable; records remain in this open page."); } }
  }, [audit, plan, decisions, executed, phase, restored]);
  const recorded = useRef(new Set<string>());
  useEffect(() => {
    if (!restored) return;
    for (const entry of audit) {
      const key = JSON.stringify(entry);
      if (recorded.current.has(key)) continue;
      recorded.current.add(key);
      appendOperationalRecord(entry, entry.incidentId ?? "ISS-COOLING-BRAVO").then(saved => { if(saved) setAuditStorage("Private Cloud records: visible to your account for 90 days; expired records are hidden, not automatically deleted."); }).catch(() => setAuditStorage("Cloud save failed; records retained in this browser session. Refresh to retry."));
    }
  }, [audit, restored]);

  // SLA countdown runs until the incident is resolved.
  useEffect(() => {
    if (plan?.actions.some(a => a.action === "Restore cooling loop" && executed.includes(a.id))) return;
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [plan, executed]);

  // Timeline playback: walks toward "Now".
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setMinutesAgo((m) => {
        const next = Math.max(-FUTURE_MAX, m - TIMELINE_STEP * speed);
        if (next === -FUTURE_MAX) setPlaying(false);
        return next;
      });
    }, 500);
    return () => clearInterval(t);
  }, [playing, speed]);

  const startTroubleshoot = useCallback(() => {
    if (running.current) return;
    running.current = true;
    setPhase("analyzing");
    setPlan(null);
    setFindings([]);
    setFeed([]);
    setDecisions({});
    decisionRef.current = {};
    setExecuted([]);
    setConfirmOpen(false);
    setPlanOpen(false);
    setAgentStatus({ ...IDLE_STATUS });
    setAudit((a) => [...a, { at: stamp(), actor: "System", action: "Analysis started", detail: "Troubleshoot workflow initiated by employee." }]);

    runAgentWorkflow(
      0,
      (agent, text) => setFeed((f) => [...f, { at: stamp(), agent, text }]),
      (agent, status) => setAgentStatus((s) => ({ ...s, [agent]: status })),
    )
      .then(({ plan, findings }) => {
        setPlan(plan);
        setFindings(findings);
        setPhase("plan");
        setPlanOpen(true);
        setAudit((a) => [...a, { at: stamp(), actor: "System", action: "Plan generated", detail: `${plan.actions.length} actions in one primary recommendation.`, incidentId: "ISS-COOLING-BRAVO", condition: { actions: plan.actions, recommendation: plan.recommendation }, prediction: simulate(plan.actions, {}) }]);
      })
      .catch(() => {
        setPhase("idle");
        setAudit((a) => [...a, { at: stamp(), actor: "System", action: "Analysis failed", detail: "Agent workflow did not complete. No changes were made." }]);
      })
      .finally(() => {
        running.current = false;
      });
  }, []);

  const setDecision = useCallback((actionId: string, d: Decision) => {
    if (!plan || phase !== "plan") return;
    const action = plan.actions.find(a => a.id === actionId);
    if (!action) return;
    const next = { ...decisionRef.current, [actionId]: d };
    decisionRef.current = next;
    setDecisions(next);
    try {
      const result = simulate(plan.actions, next, executed);
      lastPrediction.current = result; setPredictionError(null);
      setAudit(a => [...a, { at: stamp(), actor: "Employee (demo)", action: `${d}: ${action.action}`, detail: `${action.bladeId} — ${action.reason}; projected +48h health ${result.future}/100`, incidentId: "ISS-COOLING-BRAVO", rackId: action.rackId, bladeId: action.bladeId, condition: observedBlades(plan.actions, executed).find(b => b.id === action.bladeId) ?? action.telemetry, prediction: result }]);
    } catch { setPredictionError("The updated simulation could not be generated."); }
  }, [plan, phase, executed]);

  const executeApproved = useCallback(() => {
    if (!plan || phase !== "plan") return;
    const approved = plan.actions.filter((a) => decisions[a.id] === "approved");
    if (approved.length === 0) return;
    setPhase("executing");
    setAudit((a) => [
      ...a,
      ...approved.map((p) => ({ at: stamp(), actor: "Employee (demo)", action: `Approved: ${p.action}`, detail: `${p.bladeId} — ${p.reason}` })),
      ...plan.actions.filter((p) => decisions[p.id] === "rejected").map((p) => ({ at: stamp(), actor: "Employee (demo)", action: `Rejected: ${p.action}`, detail: p.bladeId })),
    ]);

    // Simulated execution: each approved action completes in sequence.
    approved.forEach((p, i) => {
      setTimeout(() => {
        setExecuted((e) => [...e, p.id]);
        setFeed((f) => [...f, { at: stamp(), agent: "Execution (simulated)", text: `${p.action} on ${p.bladeId} completed.` }]);
        setAudit((a) => [...a, { at: stamp(), actor: "Execution layer (simulated)", action: p.action, detail: `${p.bladeId} — simulated, no real hardware touched.`, incidentId: "ISS-COOLING-BRAVO", rackId: p.rackId, bladeId: p.bladeId, condition: { outcome: "completed", actionId: p.id, employeeDecision: "approved" } }]);
      }, 900 * (i + 1));
    });
    setTimeout(() => {
      setPhase("done");
      const finalExecuted = [...executed, ...approved.map(a => a.id)];
      setFeed((f) => [...f, { at: stamp(), agent: "Verification", text: "Approved simulated changes completed. Only replaced blades recover; unapproved faults and cooling issues remain." }]);
      setAudit((a) => [...a, { at: stamp(), actor: "Verification", action: "Verification passed", detail: "Approved execution results recorded; unresolved faults remain active.", incidentId: "ISS-COOLING-BRAVO", condition: observedBlades(plan.actions, finalExecuted), prediction: simulate(plan.actions, decisions, finalExecuted) }]);
    }, 900 * (approved.length + 1));
  }, [plan, decisions, phase, executed]);

  const reset = useCallback(() => {
    setPhase("idle");
    setSeconds(INCIDENT.countdownSeconds);
    setPlan(null);
    setFindings([]);
    setFeed([]);
    setAgentStatus({ ...IDLE_STATUS });
    setDecisions({});
    decisionRef.current = {};
    setExecuted([]);
    setAudit(a => [...a, { at: stamp(), actor: "Employee (demo)", action: "Demo reset", detail: "Current simulated state reset; prior operational records retained." }]);
    setExp(false);
    setSigned(false);
    setConfirmOpen(false);
    setPlanOpen(false);
    setMinutesAgo(0);
    setPlaying(false);
    running.current = false;
  }, []);

  return (
    <IncidentCtx.Provider
      value={{
        prediction, predictionError, auditStorage, incidentRackId, setIncidentRackId,
        phase, healed: !!plan && plan.actions.some(a => a.action === "Restore cooling loop" && executed.includes(a.id)), secondsLeft, confirmOpen, setConfirmOpen, planOpen, setPlanOpen,
        startTroubleshoot, plan, findings, feed, agentStatus, decisions, setDecision, executeApproved, executed, audit,
        minutesAgo, setMinutesAgo, playing, setPlaying, speed, setSpeed,
        expansionApproved, approveExpansion: () => setExp(true),
        handoffSigned, signHandoff: () => setSigned(true), reset,
      }}
    >
      {children}
    </IncidentCtx.Provider>
  );
}

export function useIncident() {
  const c = useContext(IncidentCtx);
  if (!c) throw new Error("useIncident outside provider");
  return c;
}

export const fmtClock = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
