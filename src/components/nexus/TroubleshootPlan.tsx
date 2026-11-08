import { AlertTriangle, Check, CheckCircle2, Loader2, RotateCcw, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pill } from "@/components/nexus/shared";
import type { PlanAction, Scenario } from "@/lib/agents";
import { fmtMoney } from "@/lib/demo-data";
import { useIncident } from "@/lib/incident-store";
import { HealthPrediction } from "./HealthPrediction";
import { cn } from "@/lib/utils";

const catTone = { critical: "red", recommended: "amber", monitor: "muted" } as const;
const catLabel = { critical: "Critical action", recommended: "Recommended", monitor: "Monitoring" } as const;

// Enterprise change-management approval interface for the Troubleshoot workflow.
export function TroubleshootPlanDialog() {
  const inc = useIncident();
  const [confirm, setConfirm] = useState(false);
  const open = inc.planOpen && !!inc.plan && (inc.phase === "plan" || inc.phase === "executing" || inc.phase === "done");
  if (!inc.plan) return null;
  const plan = inc.plan;

  const approved = plan.actions.filter((a) => inc.decisions[a.id] === "approved");
  const rejected = plan.actions.filter((a) => inc.decisions[a.id] === "rejected");
  const pending = plan.actions.filter((a) => !inc.decisions[a.id]);

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => inc.setPlanOpen(o)}>
        <DialogContent className="max-h-[90vh] w-[96vw] sm:max-w-[1160px] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Most Recommended Action Plan
              <Pill tone="muted">Simulated analysis</Pill>
            </DialogTitle>
            <DialogDescription>{plan.issueSummary} Generated {plan.generatedAt}. Nothing runs until you approve it.</DialogDescription>
          </DialogHeader>

          <p className="text-xs text-muted-foreground">Incident ISS-COOLING-BRAVO · Investigation context {inc.incidentRackId}</p>
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="order-2 max-h-[44vh] min-w-0 overflow-y-auto pr-2 lg:order-1 lg:max-h-[57vh]">
          <section className="mb-5 border-b border-border pb-3">
            <p className="text-sm text-muted-foreground">{plan.recommendation ?? plan.scenarios.find(s => s.recommended)?.note}</p>
            <p className="mt-1 text-xs text-muted-foreground">Confidence {Math.round((inc.findings.find(f => f.agent === "Simulation & Evaluation")?.confidence ?? 0.75) * 100)}% · Est. cost {fmtMoney(plan.scenarios.find(s => s.recommended)?.costUsd ?? 0)} · Projected +48h health: {inc.prediction.baseline}/100 no action → {inc.prediction.future}/100 with your decisions</p>
          </section>
          {/* proposed actions */}
          <div className="space-y-3">
            {plan.actions.map((a) => (
              <ActionCard key={a.id} action={a} />
            ))}
          </div>

          {/* execution / verification state */}
          {inc.phase === "executing" && (
            <div className="mt-4 rounded-xl border border-border p-4">
              <p className="flex items-center gap-2 text-sm font-medium"><Loader2 className="size-4 animate-spin text-primary" /> Executing approved changes (simulated)…</p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {approved.map((a) => (
                  <li key={a.id} className="flex items-center gap-2">
                    {inc.executed.includes(a.id) ? <Check className="size-3 text-success" /> : <span className="size-3 rounded-full border border-border" />}
                    {a.action} — {a.bladeId}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {inc.phase === "done" && (
            <div className="mt-4 rounded-xl border border-success/30 bg-success/10 p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-success"><CheckCircle2 className="size-4" /> Verification passed</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {approved.length} approved action{approved.length === 1 ? "" : "s"} completed (simulated), {rejected.length} rejected, {pending.length} left undecided. Only executed replacements report nominal. Rejected and undecided faults remain active; investigations do not repair hardware.
              </p>
            </div>
          )}

          </div><aside className="order-1 min-w-0 border-l border-border bg-background pl-4 py-2 lg:order-2"><HealthPrediction /></aside></div>
          {/* audit trail */}
          {inc.audit.length > 0 && (
            <>
              <h4 className="mt-6 text-sm font-semibold">Audit trail</h4><p className="mt-2 text-xs text-muted-foreground">Operational decisions, infrastructure conditions, approvals, predictions and simulated outcomes are retained as context for future analytics and agent evaluation. This does not train or change Nemotron model weights.</p><p className="mt-1 text-xs text-muted-foreground">{inc.auditStorage} Browser demo records expire after 24 hours and stay within this tab session.</p>
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-border p-3 text-xs">
                {inc.audit.map((e, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="font-mono text-muted-foreground">{e.at}</span>
                    <span className="font-medium">{e.actor}</span>
                    <span className="text-muted-foreground">{e.action} — {e.detail}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {inc.phase === "plan" && (
            <DialogFooter className="mt-4 gap-2">
              <Button variant="ghost" onClick={() => { inc.setPlanOpen(false); inc.startTroubleshoot(); }}>
                <RotateCcw /> Request reanalysis
              </Button>
              <Button variant="secondary" disabled={pending.length === 0} onClick={() => pending.forEach((a) => inc.setDecision(a.id, "rejected"))}>
                <X /> Reject remaining
              </Button>
              <Button variant="hero" disabled={approved.length === 0} onClick={() => setConfirm(true)}>
                <ShieldCheck /> Approve selected ({approved.length})
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* final confirmation before simulated execution */}
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="size-5 text-warning" /> Confirm execution</DialogTitle>
            <DialogDescription>
              You are about to execute {approved.length} approved change{approved.length === 1 ? "" : "s"} in the simulated environment. No real hardware will be touched. Rejected and undecided actions will not run.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirm(false)}>Back</Button>
            <Button variant="hero" onClick={() => { setConfirm(false); inc.executeApproved(); }}>Execute approved changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ActionCard({ action: a }: { action: PlanAction }) {
  const inc = useIncident();
  const d = inc.decisions[a.id];
  const locked = inc.phase !== "plan";
  return (
    <div className={cn("rounded-xl border p-4", d === "approved" ? "border-success/40 bg-success/5" : d === "rejected" ? "border-destructive/40 bg-destructive/5" : "border-border")}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold">{a.component}</p>
        <Pill tone={catTone[a.category]}>{catLabel[a.category]}</Pill>
        <Pill tone={a.condition === "red" ? "red" : a.condition === "orange" ? "amber" : "muted"}>{a.condition.toUpperCase()}</Pill>
        <span className="ml-auto text-xs text-muted-foreground">Confidence {Math.round(a.confidence * 100)}% · Failure risk {Math.round(a.failureRisk * 100)}% <span className="italic">(illustrative prediction)</span></span>
      </div>
      <p className="mt-2 text-sm"><span className="text-muted-foreground">Recommended:</span> {a.action}</p>
      <details className="mt-1">
        <summary className="cursor-pointer text-xs font-medium text-primary">Why &amp; details</summary>
        <div className="mt-1 space-y-1">
          <p className="text-sm"><span className="text-muted-foreground">Why:</span> {a.reason}</p>
          <p className="text-xs text-muted-foreground">Supporting telemetry: {a.telemetry.join(" · ") || "none"}</p>
          <p className="text-xs text-muted-foreground">Predicted outcome: {a.predictedOutcome}</p>
          <p className="text-xs text-muted-foreground">Risk: {a.risk}</p>
          <p className="text-xs text-muted-foreground">Business impact: {a.businessImpact}</p>
        </div>
      </details>
      {!locked && (
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant={d === "approved" ? "success" : "secondary"} onClick={() => inc.setDecision(a.id, "approved")}>
            <Check /> {d === "approved" ? "Approved" : "Approve"}
          </Button>
          <Button size="sm" variant={d === "rejected" ? "destructive" : "secondary"} onClick={() => inc.setDecision(a.id, "rejected")}>
            <X /> {d === "rejected" ? "Rejected" : "Reject"}
          </Button>
        </div>
      )}
      {locked && d && <p className={cn("mt-2 text-xs font-medium", d === "approved" ? "text-success" : "text-destructive")}>{d === "approved" ? "Approved by employee" : "Rejected by employee"}</p>}
    </div>
  );
}
