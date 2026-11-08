import { Link, useLocation } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Loader2, Menu, ShieldCheck, Sparkles, Hexagon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AGENTS } from "@/lib/agents";
import { fmtMoney, INCIDENT } from "@/lib/demo-data";
import { fmtClock, useIncident } from "@/lib/incident-store";
import { cn } from "@/lib/utils";
import { PartnerBadge, Term } from "./shared";
import { TroubleshootPlanDialog } from "./TroubleshootPlan";

const NAV = [
  { to: "/", label: "Overview" },
  { to: "/business", label: "Business Impact", badge: "CBRE" },
  { to: "/facility", label: "Facility Health", badge: "NMC²" },
  { to: "/assistants", label: "AI Agents", badge: "NVIDIA Nemotron" },
  { to: "/handoff", label: "Shift Handoff", badge: "NMC²" },
] as const;

const TOUR = [
  ["Incident bar", "The one place for the key numbers: time left and money at risk."],
  ["Business Impact", "Which customers are affected and what it could cost."],
  ["Facility Health", "A live 3D digital twin of all 32 racks and 256 server blades."],
  ["AI Agents", "Six Nemotron-powered agents that analyze, simulate and propose a plan."],
  ["Troubleshoot", "Runs the agents and builds a proposed action plan. You approve every change before anything executes."],
];

export function Shell({ children }: { children: ReactNode }) {
  const inc = useIncident();
  const path = useLocation().pathname;
  const [tour, setTour] = useState(false);
  const [mobile, setMobile] = useState(false);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-3 md:px-5"><Button variant="ghost" size="icon" onClick={() => setMobile(v => !v)} aria-label="Menu" aria-expanded={mobile}><Menu /></Button>
            <Link to="/" className="flex items-center gap-2 font-semibold">
              <Hexagon className="size-6 text-primary" /> NexusDC
            </Link>
            <nav className="hidden flex-1 items-center gap-1 lg:flex">
              {NAV.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  activeOptions={{ exact: true }}
                  className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground data-[status=active]:bg-secondary data-[status=active]:text-foreground"
                >
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    {n.label}
                    
                  </span>
                </Link>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="secondary" size="sm" className="hidden sm:inline-flex" onClick={() => setTour(true)}>
                Take the tour
              </Button>
              <Button variant="hero" size="sm" disabled={inc.phase !== "idle"} onClick={() => inc.setConfirmOpen(true)}>
                <Sparkles /> Troubleshoot
              </Button>

            </div>
          </div>
          {path !== "/" && path !== "/business" && <IncidentBar />}
        </header>

        <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 md:px-6">{children}</main>

        <footer className="border-t border-border">
          <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-6 text-xs text-muted-foreground md:px-6">
            <span className="flex items-center gap-2">
              NexusDC <span className="rounded-full border border-border px-2 py-0.5">Demo data</span>
            </span>
            <button onClick={inc.reset} className="hover:text-foreground">Reset demo</button>
          </div>
        </footer>
      </div>

      <TroubleshootDialogs />

      <Dialog open={tour} onOpenChange={setTour}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quick tour</DialogTitle>
            <DialogDescription>Five things to know, in 30 seconds.</DialogDescription>
          </DialogHeader>
          <ol className="space-y-3">
            {TOUR.map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs text-primary">{i + 1}</span>
                <div><p className="text-sm font-medium">{t}</p><p className="text-sm text-muted-foreground">{d}</p></div>
              </li>
            ))}
          </ol>
          <DialogFooter><Button onClick={() => setTour(false)}>Got it</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={mobile} onOpenChange={setMobile}>
        <SheetContent side="left">
          <SheetHeader><SheetTitle>NexusDC</SheetTitle></SheetHeader>
          <nav className="mt-4 flex flex-col gap-1 px-4">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} onClick={() => setMobile(false)} className="rounded-lg px-3 py-2 text-sm hover:bg-secondary">
                {n.label}
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}

export function IncidentBar({ prominent = false }: { prominent?: boolean }) {
  const inc = useIncident();
  const { healed, secondsLeft, phase, setPlanOpen } = inc;
  return (
    <div className={cn("border-t transition-colors", healed ? "border-success/30 bg-success/10" : "border-destructive/30 bg-destructive/10")}>
      <div className={cn("mx-auto flex max-w-[1200px] flex-wrap items-center gap-3 px-4 text-sm md:px-6", prominent ? "py-7" : "py-2")}>
        {healed ? <CheckCircle2 className="size-4 shrink-0 text-success" /> : <AlertTriangle className={cn("shrink-0 text-destructive", prominent ? "size-8" : "size-4")} />}
        <div className="min-w-0 flex-1">
          {healed ? (
            <span className="text-success">Cooling stabilized · Penalty avoided</span>
          ) : (
            <>
              {INCIDENT.title} · <Term tech="T−18m / SLA breach">Breach in <span className="font-mono font-semibold tabular-nums text-destructive">{fmtClock(secondsLeft)}</span></Term> ·{" "}
              <span className="font-semibold">{fmtMoney(INCIDENT.penaltyPerHour)}/hr</span> at risk
            </>
          )}
        {prominent && <p className="mt-2 text-sm text-muted-foreground">Dallas · Cluster Bravo · Racks {INCIDENT.racks} · {INCIDENT.unit}. Immediate intervention: restore cooling, drain workloads and review affected blade replacements.</p>}</div>
        {healed ? (
          <span className="font-mono text-xs font-semibold text-success">Stabilized</span>
        ) : phase === "plan" ? (
          <Button size="sm" variant="secondary" onClick={() => setPlanOpen(true)}>Review plan</Button>
        ) : (
          <Button size="sm" variant="destructive" disabled={phase === "analyzing" || phase === "executing"} onClick={() => { if(inc.plan) inc.setPlanOpen(true); else inc.setConfirmOpen(true); }}>TAKE ACTION</Button>
        )}
      </div>
    </div>
  );
}

function TroubleshootDialogs() {
  const inc = useIncident();
  return (
    <>
      <Dialog open={inc.confirmOpen} onOpenChange={inc.setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run Troubleshoot?</DialogTitle>
            <DialogDescription>
              Six AI agents will analyze the facility, simulate interventions and propose an action plan. Nothing executes without your approval.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => inc.setConfirmOpen(false)}>Cancel</Button>
            <Button variant="hero" onClick={inc.startTroubleshoot}>Run analysis</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={inc.phase === "analyzing"}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agents analyzing the facility</DialogTitle>
            <DialogDescription>Each agent runs in turn and hands structured findings to the next.</DialogDescription>
          </DialogHeader>
          <ul className="space-y-3">
            {AGENTS.map((a) => {
              const st = inc.agentStatus[a.name];
              const running = st === "Analyzing" || st === "Evaluating" || st === "Simulating";
              return (
                <li key={a.name} className="flex items-center gap-3 rounded-xl border border-border p-3">
                  <a.icon className="size-4 text-primary" />
                  <span className="flex-1 text-sm">{a.name}</span>
                  {st === "Completed" ? (
                    <ShieldCheck className="size-4 text-success" />
                  ) : running ? (
                    <span className="flex items-center gap-2 text-xs text-primary"><Loader2 className="size-4 animate-spin" /> {st}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">{st}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </DialogContent>
      </Dialog>

      <TroubleshootPlanDialog />
    </>
  );
}
