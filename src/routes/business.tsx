import { createFileRoute } from "@tanstack/react-router";
import { Building2, CheckCircle2, DollarSign, Gauge, MapPin, Sparkles, Users } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { NexusCard, PageHeader, Pill, Section, Term } from "@/components/nexus/shared";
import { CUSTOMERS, fmtMoney, LEASE_TOTAL, SITES, type CustomerStatus } from "@/lib/demo-data";
import { useIncident } from "@/lib/incident-store";
import { IncidentBar } from "@/components/nexus/Shell";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/business")({
  head: () => ({
    meta: [
      { title: "Business Impact — NexusDC" },
      { name: "description", content: "Customer contracts, penalty risk and expansion options for the Dallas incident." },
      { property: "og:title", content: "Business Impact — NexusDC" },
      { property: "og:description", content: "Customer contracts, penalty risk and expansion options." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Business,
});

const tone = (s: CustomerStatus) => (s === "Breach imminent" ? "red" : s === "At risk" ? "amber" : "green") as "red" | "amber" | "green";

function Business() {
  const inc = useIncident();
  const [site, setSite] = useState("hillsboro");
  const customers = CUSTOMERS.map((c) =>
    inc.healed && c.id === "LEASE-HYP-02" ? { ...c, status: "Protected" as CustomerStatus, costPerHour: 0 } : c,
  );

  return (
    <div>
      <PageHeader badge="CBRE" title="What this costs the business." sub={`${LEASE_TOTAL.count} leases worth ${LEASE_TOTAL.annual}. See the incident bar for live risk.`} />

      <div className="mb-6"><IncidentBar prominent /></div>
      <div className="card-nexus flex flex-col items-start gap-4 border-primary/40 p-6 shadow-glow md:flex-row md:items-center">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary"><Sparkles className="size-5" /></div>
        <div className="flex-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">AI recommendation</p>
          <p className="text-lg font-semibold">Move 18 MW to Hillsboro.</p>
        </div>
        {inc.expansionApproved ? (
          <Pill tone="green">Approved</Pill>
        ) : (
          <Button variant="hero" onClick={inc.approveExpansion}>Approve</Button>
        )}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={DollarSign} label={<Term tech="SLA penalty">Penalty risk</Term>} value={inc.healed ? "$0/hr" : "See incident bar"} tone={inc.healed ? "green" : "red"} />
        <Stat icon={Users} label="Customer at risk" value="Hyperscale Tenant #2" sub="$38.4M/yr" tone={inc.healed ? "green" : "red"} />
        <Stat icon={Gauge} label="Dallas capacity" value="44.8 of 48 MW" sub="93.3% used" tone="amber" />
        <Stat icon={MapPin} label="Best new site" value="Hillsboro" sub="96% fit" tone="blue" />
      </div>

      <Section title="Customers at risk">
        <div className="grid gap-4 md:grid-cols-2">
          {customers.map((c) => (
            <div key={c.id} className="card-nexus p-6 animate-fade-up">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{c.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Cluster {c.cluster} · {c.mw} MW · {c.tier}</p>
                </div>
                <Pill tone={tone(c.status)}>{c.status}</Pill>
              </div>
              <p className="mt-4 text-2xl font-semibold tabular-nums">{fmtMoney(c.costPerHour)}<span className="text-sm text-muted-foreground">/hr</span></p>
              <Collapsible className="mt-4">
                <CollapsibleTrigger asChild><Button variant="ghost" size="sm" className="-ml-3">View <Term tech="Covenant clause">rule</Term></Button></CollapsibleTrigger>
                <CollapsibleContent className="mt-2 rounded-xl bg-muted p-3 text-sm text-muted-foreground">
                  {c.id}: {c.rule}
                </CollapsibleContent>
              </Collapsible>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Where to grow next">
        <div className="grid gap-4 md:grid-cols-3">
          {SITES.map((s) => (
            <div key={s.id} className={cn("card-nexus flex flex-col p-6", site === s.id && "border-primary")}>
              <div className="flex items-center justify-between">
                <Building2 className="size-5 text-primary" />
                <Pill tone={s.tag === "Recommended" ? "blue" : s.tag === "Full" ? "red" : "muted"}>{s.tag}</Pill>
              </div>
              <h3 className="mt-4 font-semibold">{s.name}</h3>
              <dl className="mt-4 space-y-2 text-sm">
                {s.key.map(([k, v]) => (
                  <div key={k} className="flex justify-between"><dt className="text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>
                ))}
              </dl>
              <Collapsible className="mt-4">
                <CollapsibleTrigger asChild><Button variant="ghost" size="sm" className="-ml-3">More details</Button></CollapsibleTrigger>
                <CollapsibleContent>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">{s.more.map((m) => <li key={m}>· {m}</li>)}</ul>
                </CollapsibleContent>
              </Collapsible>
              <Button variant="secondary" className="mt-auto" style={{ marginTop: 16 }} onClick={() => setSite(s.id)} disabled={site === s.id}>
                {site === s.id ? <><CheckCircle2 /> Selected</> : "Select this site"}
              </Button>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Stat({ icon, label, value, sub, tone }: { icon: typeof Users; label: React.ReactNode; value: string; sub?: string; tone: "red" | "amber" | "green" | "blue" }) {
  return (
    <NexusCard icon={icon} iconTone={tone} title={<span className="text-sm font-normal text-muted-foreground">{label}</span>} line={<span className="text-lg font-semibold text-foreground">{value}{sub && <span className="block text-sm font-normal text-muted-foreground">{sub}</span>}</span>} />
  );
}
