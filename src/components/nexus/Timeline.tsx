import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { EVENT_COLORS, EVENTS, fmtAgo, TIMELINE_MAX, TIMELINE_STEP, type DcEvent } from "@/lib/infra-data";
import { useIncident } from "@/lib/incident-store";
import { FUTURE_MAX } from "@/lib/prediction";
import { HealthPrediction } from "./HealthPrediction";
import { cn } from "@/lib/utils";

const SPEEDS = [1, 4, 16];

// Operational history scrubber. Dragging or playing moves the whole dashboard
// (3D twin, stats, alerts) through the simulated historical dataset.
export function Timeline() {
  const inc = useIncident();
  const [event, setEvent] = useState<DcEvent | null>(null);

  return (
    <div className="mt-6 border-t border-border py-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Step back" onClick={() => { inc.setPlaying(false); inc.setMinutesAgo(Math.min(TIMELINE_MAX, inc.minutesAgo + TIMELINE_STEP)); }}>
            <SkipBack className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label={inc.playing ? "Pause" : "Play"} onClick={() => inc.setPlaying(!inc.playing)} disabled={inc.minutesAgo === -FUTURE_MAX && !inc.playing}>
            {inc.playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </Button>
          <Button variant="ghost" size="icon" aria-label="Step forward" onClick={() => { inc.setPlaying(false); inc.setMinutesAgo(Math.max(-FUTURE_MAX, inc.minutesAgo - TIMELINE_STEP)); }}>
            <SkipForward className="size-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          {SPEEDS.map((s) => (
            <Button variant="ghost" size="sm" key={s} onClick={() => inc.setSpeed(s)} className={cn("rounded-full border px-2 py-0.5 text-xs", inc.speed === s ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground")}>
              {s}×
            </Button>
          ))}
        </div>
        <span className={cn("ml-auto font-mono text-sm tabular-nums", inc.minutesAgo > 0 ? "text-warning" : "text-muted-foreground")}>
          {inc.minutesAgo < 0 ? `+${(-inc.minutesAgo / 60).toFixed(1)}h · PREDICTED / simulated decisions` : `${fmtAgo(inc.minutesAgo)} · ${inc.minutesAgo > 0 ? "PAST · simulated observed telemetry" : "PRESENT"}`}
        </span>
      </div>

      <div className="relative mt-4 px-1">
        <Slider
          value={[TIMELINE_MAX - inc.minutesAgo]}
          max={TIMELINE_MAX + FUTURE_MAX}
          step={TIMELINE_STEP}
          onValueChange={([v]) => { inc.setPlaying(false); inc.setMinutesAgo(TIMELINE_MAX - (v ?? TIMELINE_MAX)); }}
          aria-label="Historical and predictive timeline"
        />
        {/* event markers */}
        {EVENTS.map((e) => (
          <button
            key={e.t + e.label}
            aria-label={e.label}
            onClick={() => setEvent(event === e ? null : e)}
            className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-background transition-transform hover:scale-150"
            style={{ left: `${((TIMELINE_MAX - e.t) / (TIMELINE_MAX + FUTURE_MAX)) * 100}%`, backgroundColor: EVENT_COLORS[e.type] }}
          />
        ))}
        <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
          <span>PAST −6h</span><span>PRESENT 0h</span><span>FUTURE +24h</span><span>+48h</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1">{[360,0,-60,-360,-720,-1440,-2880].map(m => <Button key={m} variant={inc.minutesAgo === m ? "secondary" : "ghost"} size="sm" onClick={() => { inc.setPlaying(false); inc.setMinutesAgo(m); }}>{m > 0 ? "−6h" : m === 0 ? "Now" : `+${-m/60}h`}</Button>)}</div><div className="mt-4"><HealthPrediction /></div>
      {event && (
        <div className="mt-3 flex items-start gap-3 rounded-xl border border-border bg-muted/50 p-3 text-sm">
          <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ backgroundColor: EVENT_COLORS[event.type] }} />
          <div className="flex-1">
            <p className="font-medium">{event.label}</p>
            <p className="text-xs text-muted-foreground">{fmtAgo(event.t)} · {event.type}{event.rack ? ` · Rack R-${String(event.rack).padStart(2, "0")}` : ""}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setEvent(null)}>Dismiss</Button>
        </div>
      )}
    </div>
  );
}
