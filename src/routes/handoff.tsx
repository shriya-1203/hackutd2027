import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, PenLine } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PartnerBadge, Pill, Section } from "@/components/nexus/shared";
import { HANDOFF } from "@/lib/demo-data";
import { useIncident } from "@/lib/incident-store";

export const Route = createFileRoute("/handoff")({
  head: () => ({
    meta: [
      { title: "Shift Handoff — NexusDC" },
      { name: "description", content: "Swing C to Night A handoff with AI-linked timeline and action items." },
      { property: "og:title", content: "Shift Handoff — NexusDC" },
      { property: "og:description", content: "Verified shift handoff with timeline and action items." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Handoff,
});

function Handoff() {
  const inc = useIncident();
  const [checked, setChecked] = useState<boolean[]>(HANDOFF.map(() => false));
  const items = inc.healed
    ? [...HANDOFF.map((h) => h.action), "Troubleshoot ran: approved changes executed (simulated), cooling stabilized."]
    : HANDOFF.map((h) => h.action);
  const allDone = items.every((_, i) => checked[i] ?? (inc.healed && i === items.length - 1));

  return (
    <div>
      <div className="mb-10 animate-fade-up">
        <PartnerBadge>NMC²</PartnerBadge>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight md:text-5xl">Swing C <ArrowRight className="size-8 text-muted-foreground" /> Night A</h1>
          <Pill tone={inc.handoffSigned ? "green" : "amber"}>{inc.handoffSigned ? "Verified" : "Pending"}</Pill>
        </div>
        <p className="mt-3 text-muted-foreground">{inc.healed ? "Cooling stabilized. Repairs queued for tonight." : "Open cooling issue. Read before taking over."}</p>
      </div>

      <ol className="space-y-4">
        {HANDOFF.map((h, i) => (
          <li key={i} className="card-nexus flex gap-4 p-6">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm text-primary">{i + 1}</span>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">{h.when}</p>
              <h3 className="font-semibold">{h.title}</h3>
              <Collapsible>
                <CollapsibleTrigger asChild><Button variant="link" size="sm" className="h-auto px-0">Read more</Button></CollapsibleTrigger>
                <CollapsibleContent className="mt-2 text-sm text-muted-foreground">{h.detail}</CollapsibleContent>
              </Collapsible>
            </div>
          </li>
        ))}
      </ol>

      <Section title="Action items">
        <div className="card-nexus space-y-4 p-6">
          {items.map((t, i) => {
            const isAuto = inc.healed && i === items.length - 1;
            return (
              <label key={t} className="flex items-start gap-3 text-sm">
                <Checkbox
                  checked={isAuto || !!checked[i]}
                  disabled={isAuto || inc.handoffSigned}
                  onCheckedChange={(v) => setChecked((c) => c.map((x, j) => (j === i ? !!v : x)))}
                  className="mt-0.5"
                />
                <span className={isAuto ? "text-success" : ""}>{t}</span>
              </label>
            );
          })}
        </div>
      </Section>

      <Button variant="hero" size="lg" className="mt-8 h-14 w-full text-base" disabled={!allDone || inc.handoffSigned} onClick={inc.signHandoff}>
        <PenLine /> {inc.handoffSigned ? "Handoff signed" : "Verify & sign handoff"}
      </Button>
      {!allDone && !inc.handoffSigned && <p className="mt-2 text-center text-xs text-muted-foreground">Check every action item to sign.</p>}
    </div>
  );
}
