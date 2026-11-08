import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, Server, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Pill } from "@/components/nexus/shared";
import { IncidentBar } from "@/components/nexus/Shell";
import { HealthPrediction } from "@/components/nexus/HealthPrediction";
import { useIncident } from "@/lib/incident-store";
import { infrastructureSummary, observedBlades } from "@/lib/prediction";
import { CLUSTERS, RACKS } from "@/lib/demo-data";
import { summarizeBlades } from "@/lib/infra-data";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Operations Overview — NexusDC" },
    { name: "description", content: "Dallas infrastructure operations: live incidents, critical blades, cluster health and intervention predictions." },
    { property: "og:title", content: "Operations Overview — NexusDC" },
    { property: "og:description", content: "Current infrastructure alerts and reviewed intervention plans." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }), component: Overview,
});
function Overview() {
  const inc = useIncident();
  const blades = observedBlades(inc.plan?.actions ?? [], inc.executed);
  const stats = infrastructureSummary(blades);
  return <div>
    <PageHeader title="Operations Overview" sub="Dallas data center · Simulated infrastructure · Current observed state" />
    <section aria-label="Live incident"><h2 className="mb-3 text-lg font-semibold">Live Incident</h2><IncidentBar prominent /></section>
    <section className="mt-6 border-b border-border pb-6">
      <div className="flex flex-wrap items-center gap-3"><AlertTriangle className="size-5 text-destructive" /><h2 className="text-lg font-semibold">Infrastructure Critical Alerts</h2><Pill tone={stats.critical ? "red" : "green"}>{stats.critical ? "Critical" : "Nominal"}</Pill></div>
      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">{[["Critical blade incidents", stats.critical],["Affected racks",stats.affectedRacks],["Affected server blades",stats.critical],["Infrastructure health",`${stats.hwHealth}%`]].map(([label,value]) => <div key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div>)}</div>
      {stats.priority && <div className="mt-5 flex flex-wrap items-center gap-4 border-l-2 border-destructive pl-4"><div className="min-w-0 flex-1"><p className="font-semibold">{stats.priority.id} · {stats.priority.reason}</p><p className="mt-1 text-sm text-muted-foreground">Failure probability {Math.round(stats.priority.failureRisk*100)}% (illustrative prediction) · Recommended: {stats.priority.action}</p></div><Button variant="secondary" onClick={() => { inc.setIncidentRackId(`R-${String(stats.priority?.rackN).padStart(2,"0")}`); if(inc.plan) inc.setPlanOpen(true); else inc.setConfirmOpen(true); }}>View Incident</Button><Button asChild><Link to="/facility" search={{ rack: `R-${String(stats.priority.rackN).padStart(2,"0")}` }}>Inspect Rack <ArrowRight /></Link></Button></div>}
    </section>
    <div className="mt-6 grid grid-cols-2 gap-5 md:grid-cols-4">{[["Server blades",stats.total],["Healthy blades",stats.healthy],["Average temperature",`${stats.temp}°C`],["Total blade power",`${stats.power} kW`]].map(([label,value]) => <div key={label} className="border-l border-border pl-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>)}</div>
    <section className="mt-8"><h2 className="mb-4 flex items-center gap-2 text-lg font-semibold"><Server className="size-5 text-primary" /> Rack and cluster status</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{CLUSTERS.map(c => { const racks = RACKS.filter(r => r.cluster === c.name); const s = summarizeBlades(blades.filter(b => racks.some(r => r.n === b.rackN))); return <div key={c.name} className="rounded-lg border border-border p-4"><div className="flex items-center justify-between"><h3 className="font-semibold">{c.name}</h3><Pill tone={s.critical ? "red" : s.degraded || s.attention ? "amber" : "green"}>{s.hwHealth}%</Pill></div><p className="mt-2 text-xs text-muted-foreground">{racks.length} racks · {racks.length} enclosures · {s.total} blades</p><p className="mt-1 text-xs">{s.critical} critical · {s.degraded+s.attention} warnings</p><Button asChild variant="link" className="mt-2 px-0"><Link to="/facility" search={{rack:racks[0]?.id}}>Inspect cluster <ArrowRight /></Link></Button></div>; })}</div></section>
    <section className="mt-8"><h2 className="mb-3 text-lg font-semibold">Active alerts</h2><div className="divide-y divide-border">{stats.criticalBlades.map(b => <div key={b.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="min-w-0">{b.id} · {b.reason}</span><Pill tone="red">{Math.round(b.failureRisk*100)}% risk</Pill></div>)}</div></section>
    <section className="mt-8 border-t border-border pt-5"><h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><Activity className="size-5 text-primary" /> Agent activity and latest recommendation</h2><p className="text-sm text-muted-foreground">{inc.plan?.recommendation ?? "No analysis run in this session."}</p><ul className="mt-3 space-y-2 text-xs text-muted-foreground">{inc.feed.slice(-3).map((f,i) => <li key={i}>{f.agent} · {f.text}</li>)}</ul><Button asChild variant="link" className="px-0"><Link to="/assistants">Agent activity <ArrowRight /></Link></Button></section>
    <div className="mt-8 border-t border-border pt-5"><HealthPrediction /></div>
  </div>;
}
