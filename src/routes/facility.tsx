import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Info, Thermometer, Zap, Droplets, MemoryStick, Cpu, Activity, AlertOctagon } from "lucide-react";
import { lazy, Suspense, useMemo, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { Move3d } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PageHeader, Pill, Section, Term } from "@/components/nexus/shared";
import { Timeline } from "@/components/nexus/Timeline";
import { CLUSTERS, RACK_DETAIL, RACKS, type Rack, type RackState } from "@/lib/demo-data";
import { BLADE_COLORS, BLADE_LABELS, bladeAt, chassisId, CHASSIS_PER_RACK, summarizeBlades, fmtAgo, type Blade } from "@/lib/infra-data";
import { useIncident } from "@/lib/incident-store";
import { observedBlades, projectBlades } from "@/lib/prediction";
import { HealthPrediction } from "@/components/nexus/HealthPrediction";
import { cn } from "@/lib/utils";

const RackTwin = lazy(() => import("@/components/nexus/RackTwin"));
const C = { green: "#2fc27a", amber: "#f2b13a", red: "#ec4c4f", dim: "#3a4256", heatLow: "#5a2a33", heatMid: "#b2393f", heatHigh: "#ff4d4f" };

export const Route = createFileRoute("/facility")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { rack?: string | undefined } => ({ rack: typeof search["rack"] === "string" ? search["rack"] : undefined }),
  head: () => ({
    meta: [
      { title: "Facility Health — NexusDC" },
      { name: "description", content: "Interactive 3D digital twin of 32 racks and 256 server blades with live health, history and drill-down." },
      { property: "og:title", content: "Facility Health — NexusDC" },
      { property: "og:description", content: "Interactive 3D digital twin with per-blade health and history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Facility,
});

function Facility() {
  const inc = useIncident();
  const [filter, setFilter] = useState("All");
  const [mode, setMode] = useState("clusters");
  const [sel, setSel] = useState<Rack | null>(null);
  const [selBlade, setSelBlade] = useState<Blade | null>(null);

  const { rack: initialRack } = Route.useSearch();
  const selectedRack = sel ?? RACKS.find(r => r.id === initialRack) ?? null;
  const allBlades = useMemo(() => inc.minutesAgo < 0
    ? projectBlades(-inc.minutesAgo / 60, inc.plan?.actions ?? [], inc.decisions, inc.executed)
    : observedBlades(inc.plan?.actions ?? [], inc.executed, inc.minutesAgo), [inc.minutesAgo, inc.plan, inc.decisions, inc.executed]);
  const racks = RACKS.map(r => {
    const stats = summarizeBlades(allBlades.filter(b => b.rackN === r.n));
    return { ...r, health: stats.hwHealth, state: (stats.critical ? "red" : stats.attention || stats.degraded ? "amber" : "green") as RackState };
  });
  const visible = (r: Rack) => filter === "All" || r.cluster === filter;
  const twinColor = (r: Rack) => {
    const st = r.state;
    if (mode === "parts") return { color: st === "red" ? C.red : C.dim, glow: st === "red" ? 1 : 0.2 };
    if (mode === "heat") {
      const heat = st === "red" ? 0.9 : st === "amber" ? 0.6 : 0.15;
      return { color: heat > 0.7 ? C.heatHigh : heat > 0.4 ? C.heatMid : C.heatLow, glow: heat };
    }
    return { color: C[st], glow: 1 };
  };
  const twinRacks = racks.map((r) => ({ ...r, ...twinColor(r), dimmed: !visible(r), blades: allBlades.filter((b) => b.rackN === r.n) }));

  const reds = racks.filter((r) => r.state === "red");
  const ambers = racks.filter((r) => allBlades.some(b => b.rackN === r.n && b.health === "yellow"));

  return (
    <div>
      <PageHeader title="Facility Health" sub="Dallas · 32 racks · 32 simulated blade enclosures · 256 server blades" />

      <div className="overflow-hidden border-y border-border py-5">
        <div className="flex flex-wrap items-center gap-2">
          {["All", ...CLUSTERS.map((c) => c.name)].map((c) => (
            <Button size="sm" variant="ghost" key={c} onClick={() => setFilter(c)} className={cn("rounded-full border px-3 py-1 text-sm transition-colors", filter === c ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>{c}</Button>
          ))}
          <ToggleGroup type="single" value={mode} onValueChange={(v) => v && setMode(v)} className="ml-auto rounded-lg bg-muted p-1">
            <ToggleGroupItem value="clusters" size="sm">Clusters</ToggleGroupItem>
            <ToggleGroupItem value="parts" size="sm">Parts Needed</ToggleGroupItem>
            <ToggleGroupItem value="heat" size="sm">Heat</ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="mt-5">
          {selectedRack && <div className="mb-4 flex flex-wrap items-center gap-3"><Button variant="secondary" size="sm" asChild><Link to="/facility" search={{ rack: undefined }} onClick={() => { setSel(null); setSelBlade(null); }}><ArrowLeft /> Back to Data Center Overview</Link></Button><h2 className="font-semibold">{selectedRack.id} · Rack investigation</h2></div>}
          <div className={cn("grid gap-6", selectedRack && "lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]")}>
            {selectedRack && <div className="min-w-0 space-y-5">
              <ClusterPanel rack={selectedRack} blades={allBlades} />
              <RackPanel rack={racks.find(r => r.id === selectedRack.id) ?? selectedRack} blades={allBlades.filter(b => b.rackN === selectedRack.n)} />
            </div>}
            <div className="min-w-0">
              <ClientOnly fallback={<TwinLoading />}><Suspense fallback={<TwinLoading />}><RackTwin racks={twinRacks} selectedId={selectedRack?.id} selectedBladeId={selBlade?.id} onSelect={r => { setSel(r); setSelBlade(null); if(r) inc.setIncidentRackId(r.id); }} onSelectBlade={setSelBlade} /></Suspense></ClientOnly>
              {selectedRack && <div className="mt-3 grid grid-cols-4 gap-2">{allBlades.filter(b => b.rackN === selectedRack.n).map(b => <Button key={b.id} size="sm" variant={selBlade?.id === b.id ? "secondary" : "outline"} onClick={() => setSelBlade(b)} aria-label={`Inspect blade ${b.id}`}><span className={cn("size-2 rounded-full", b.health === "red" ? "bg-destructive motion-safe:animate-pulse" : b.health === "green" ? "bg-success" : b.health === "gray" ? "bg-muted-foreground" : "bg-warning")} />B{String(b.slot).padStart(2,"0")}</Button>)}</div>}
              {selBlade && <div className="mt-5 border-t border-border pt-5"><BladePanel blade={allBlades.find(b => b.id === selBlade.id) ?? selBlade} minutesAgo={inc.minutesAgo} /></div>}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          {(Object.keys(BLADE_COLORS) as (keyof typeof BLADE_COLORS)[]).map((h) => (
            <span key={h} className="flex items-center gap-2">
              <span className="size-3 rounded-sm" style={{ backgroundColor: BLADE_COLORS[h] }} />
              {BLADE_LABELS[h]}
            </span>
          ))}
        </div>

        <Timeline />


      </div>

      <Section title="How racks are grouped">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card-nexus p-6">
            <Pill tone="red">{reds.length} need parts replaced</Pill>
            <p className="mt-3 text-sm text-muted-foreground">{reds.map((r) => `${r.id} ${r.issue.toLowerCase()}`).join(" · ")}</p>
          </div>
          <div className="card-nexus p-6">
            <Pill tone={ambers.length ? "amber" : "green"}>{ambers.length} racks with cooling warnings</Pill>
            <p className="mt-3 text-sm text-muted-foreground">Cooling restoration resolves thermal-only warnings. Confirmed hardware faults require their own approved intervention.</p>
          </div>
        </div>
        <Collapsible className="mt-4">
          <CollapsibleTrigger asChild><Button variant="ghost" size="sm"><Info /> How we grouped these</Button></CollapsibleTrigger>
          <CollapsibleContent className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Racks with heat-only symptoms recover when coolant flow returns. Racks with leaks, wear or electrical damage need parts, so they stay red after Troubleshoot.
          </CollapsibleContent>
        </Collapsible>
      </Section>


    </div>
  );
}

function TwinLoading() {
  return <div className="mt-0 flex h-[520px] items-center justify-center rounded-xl bg-muted/40 text-sm text-muted-foreground">Loading digital twin…</div>;
}

function RackPanel({ rack, blades }: { rack: Rack; blades: Blade[] }) {
  const inc = useIncident();
  const stats = summarizeBlades(blades);
  const health = rack.health;
  const tone = rack.state === "red" ? "var(--destructive)" : rack.state === "amber" ? "var(--warning)" : "var(--success)";
  const C = 2 * Math.PI * 42;
  return (
    <>
      <div className="mb-4">
        <h3>{rack.id} · Cluster {rack.cluster}</h3>
        <p className="text-xs text-muted-foreground">{chassisId(rack.n)} · 1 simulated enclosure · {stats.total} server blades</p>
      </div>
      <div className="space-y-6 px-4 pb-6">
        <div className="flex items-center gap-4">
          <svg viewBox="0 0 100 100" className="size-24 -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="var(--muted)" strokeWidth="8" />
            <circle cx="50" cy="50" r="42" fill="none" stroke={tone} strokeWidth="8" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - health / 100)} />
          </svg>
          <div>
            <p className="text-3xl font-semibold">{health}%</p>
            <p className="text-sm text-muted-foreground">Hardware health · {stats.power} kW</p>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-2 text-center text-xs">
          {([["Healthy", stats.healthy, BLADE_COLORS.green], ["Degraded", stats.degraded, BLADE_COLORS.yellow], ["Attention", stats.attention, BLADE_COLORS.orange], ["Critical", stats.critical, BLADE_COLORS.red], ["Offline", stats.offline, BLADE_COLORS.gray]] as const).map(([label, n, color]) => (
            <div key={label} className="rounded-lg border border-border p-2">
              <p className="text-lg font-semibold" style={{ color }}>{n}</p>
              <p className="text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "CPU utilization", value: `${stats.cpu}%` },
            { label: "Memory utilization", value: `${stats.mem}%` },
            { label: "Avg temperature", value: `${stats.temp}°C` },
            { label: "Power draw", value: `${stats.power} kW` },
            { label: "Network utilization", value: `${stats.net}%` },
            { label: "Uptime", value: stats.uptime },
            { label: "Hardware health", value: `${stats.hwHealth}%` },
            { label: "Predicted failure risk", value: `${Math.round(stats.maxRisk * 100)}%` },
          ].map((r) => (
            <div key={r.label} className="rounded-xl border border-border p-3">
              <p className="text-xs text-muted-foreground">{r.label}</p>
              <p className="font-semibold">{r.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl bg-muted p-3 text-sm">{rack.state === "red" ? "Parts needed. Staged in Cage 4 for tonight." : RACK_DETAIL.verdict}</div>
        <Accordion type="single" collapsible>
          <AccordionItem value="trays">
            <AccordionTrigger>Component reference ({RACK_DETAIL.trays.length} assemblies)</AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-2">
                {RACK_DETAIL.trays.map((t) => (
                  <li key={t.slot} className="flex justify-between rounded-lg bg-muted px-3 py-2 text-xs">
                    <span>{t.slot} {t.name}</span>
                    <span className="text-muted-foreground">{t.temp} · {t.noise} · {t.errors} err</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">Legacy component examples, not separate enclosures or server counts.</p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        <Button variant="default" className="w-full" onClick={() => { inc.setIncidentRackId(rack.id); if(inc.plan) inc.setPlanOpen(true); else inc.setConfirmOpen(true); }}>Take Action</Button>
      </div>
    </>
  );
}

function BladePanel({ blade, minutesAgo }: { blade: Blade; minutesAgo: number }) {
  const inc = useIncident();
  const color = BLADE_COLORS[blade.health];
  return (
    <>
      <div className="mb-4">
        <h3 className="flex items-center gap-2">
          {blade.id}
          <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: `${color}22`, color }}>{BLADE_LABELS[blade.health]}</span>
        </h3>
        <p className="text-xs text-muted-foreground">Rack R-{String(blade.rackN).padStart(2, "0")} · Slot B{String(blade.slot).padStart(2, "0")}{minutesAgo > 0 ? ` · ${fmtAgo(minutesAgo)}` : ""}</p>
      </div>
      <div className="space-y-6 px-4 pb-6">
        <div className="rounded-xl border border-border p-4">
          <p className="text-sm font-medium">Why it was flagged</p>
          <p className="mt-1 text-sm text-muted-foreground">{blade.reason}</p>
          {blade.signals.length > 0 && (
            <ul className="mt-2 space-y-1">
              {blade.signals.map((s) => (
                <li key={s} className="flex items-center gap-2 text-xs text-muted-foreground"><Activity className="size-3 text-primary" /> {s}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Cpu, label: "CPU usage", value: `${blade.cpu}%` },
            { icon: MemoryStick, label: "Memory usage", value: `${blade.mem}%` },
            { icon: Thermometer, label: "Temperature", value: `${blade.temp}°C` },
            { icon: Zap, label: "Power draw", value: `${blade.power} kW` },
            { icon: Droplets, label: "Network", value: `${blade.net}%` },
            { icon: AlertOctagon, label: "Errors", value: `${blade.errors}/h` },
          ].map((r) => (
            <div key={r.label} className="rounded-xl border border-border p-3">
              <r.icon className="size-4 text-primary" />
              <p className="mt-2 text-xs text-muted-foreground">{r.label}</p>
              <p className="font-semibold">{r.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-border p-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Predicted failure probability</span>
            <span className="font-semibold" style={{ color }}>{Math.round(blade.failureRisk * 100)}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full" style={{ width: `${blade.failureRisk * 100}%`, backgroundColor: color }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Illustrative prediction from simulated telemetry.</p>
        </div>

        <div className="rounded-xl bg-muted p-3 text-sm">
          <span className="text-muted-foreground">Recommended action:</span> {blade.action}
        </div>
        <div><h4 className="text-sm font-semibold">Historical performance</h4><div className="mt-2 grid grid-cols-3 gap-2 text-xs">{[360,60,0].map(m => { const b = bladeAt(blade.rackN, blade.slot,m); return <div key={m}><p className="text-muted-foreground">{fmtAgo(m)}</p><p>{b.temp}°C · {b.errors} err/h</p></div>; })}</div></div><HealthPrediction rackId={`R-${String(blade.rackN).padStart(2,"0")}`} /><Button className="w-full" onClick={() => { inc.setIncidentRackId(`R-${String(blade.rackN).padStart(2,"0")}`); if(inc.plan) inc.setPlanOpen(true); else inc.setConfirmOpen(true); }}>Take Action</Button>
      </div>
    </>
  );
}

function ClusterPanel({ rack, blades }: { rack: Rack; blades: Blade[] }) {
  const rs = RACKS.filter(r => r.cluster === rack.cluster);
  const stats = summarizeBlades(blades.filter(b => rs.some(r => r.n === b.rackN)));
  return <section className="border-b border-border pb-5"><p className="text-xs text-muted-foreground">Dallas · Simulated infrastructure</p><h3 className="mt-1 text-lg font-semibold">Cluster {rack.cluster}</h3><div className="mt-3 grid grid-cols-3 gap-3 text-sm">{[["Health", `${stats.hwHealth}%`],["Racks",rs.length],["Enclosures",rs.length * CHASSIS_PER_RACK],["Server blades",stats.total],["Healthy",stats.healthy],["Degraded",stats.degraded],["Attention",stats.attention],["Critical",stats.critical],["Offline",stats.offline],["CPU",`${stats.cpu}%`],["Memory",`${stats.mem}%`],["Temperature",`${stats.temp}°C`],["Total power",`${stats.power} kW`]].map(([label,value]) => <div key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="font-semibold">{value}</p></div>)}</div><h4 className="mt-4 text-sm font-semibold">Active alerts</h4><ul className="mt-2 space-y-1 text-xs text-muted-foreground">{stats.blades.filter(b => b.health === "red" || b.health === "orange").map(b => <li key={b.id}>{b.id} · {b.reason}</li>)}</ul></section>;
}
