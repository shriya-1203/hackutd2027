import type { LucideIcon } from "lucide-react";
import { HelpCircle } from "lucide-react";
import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function Term({ children, tech }: { children: ReactNode; tech: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {children}
      <Tooltip>
        <TooltipTrigger asChild>
          <span role="img" tabIndex={0} aria-label="What's this?" className="cursor-help text-muted-foreground hover:text-primary">
            <HelpCircle className="size-3.5" />
          </span>
        </TooltipTrigger>
        <TooltipContent>What's this? Technical term: {tech}</TooltipContent>
      </Tooltip>
    </span>
  );
}

export function PageHeader({ title, sub, badge }: { title: string; sub: string; badge?: string }) {
  return (
    <div className="mb-10 animate-fade-up">
      {badge && <PartnerBadge>{badge}</PartnerBadge>}
      <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">{title}</h1>
      <p className="mt-3 text-muted-foreground">{sub}</p>
    </div>
  );
}

export function PartnerBadge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
      {children}
    </span>
  );
}

type Tone = "red" | "amber" | "green" | "blue" | "muted";
const toneCls: Record<Tone, string> = {
  red: "bg-destructive/15 text-destructive border-destructive/30",
  amber: "bg-warning/15 text-warning border-warning/30",
  green: "bg-success/15 text-success border-success/30",
  blue: "bg-primary/15 text-primary border-primary/30",
  muted: "bg-muted text-muted-foreground border-border",
};
export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", toneCls[tone])}>
      {children}
    </span>
  );
}

export function NexusCard({
  icon: Icon, title, line, action, children, className, iconTone = "blue",
}: {
  icon: LucideIcon; title: ReactNode; line: ReactNode; action?: ReactNode; children?: ReactNode; className?: string; iconTone?: Tone;
}) {
  return (
    <div className={cn("card-nexus flex flex-col gap-4 p-6 animate-fade-up", className)}>
      <div className={cn("flex size-10 items-center justify-center rounded-xl border", toneCls[iconTone])}>
        <Icon className="size-5" />
      </div>
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{line}</p>
      </div>
      {children}
      {action && <div className="mt-auto pt-2">{action}</div>}
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-16">
      <h2 className="mb-6 text-xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}
