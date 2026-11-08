import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useIncident } from "@/lib/incident-store";
import { CRITICAL_THRESHOLD, simulate } from "@/lib/prediction";

export function HealthPrediction({ rackId }: { rackId?: string }) {
  const inc = useIncident();
  const p = rackId ? simulate(inc.plan?.actions ?? [], inc.decisions, inc.executed, rackId) : inc.prediction;
  return <section aria-label="Live server health prediction" className="min-w-0 space-y-3">
    <h3 className="text-base font-semibold">Live server health prediction</h3>
    <p className="text-xs text-muted-foreground">{rackId ?? "Affected server blades"} · Illustrative telemetry-based simulation · 48-hour horizon</p>
    <div className="grid grid-cols-3 gap-2 text-sm"><div>Current<p className="text-xl font-semibold">{p.current}/100</p></div><div>Predicted +48h<p className="text-xl font-semibold text-primary" data-testid="future-health">{p.future}/100</p></div><div>Peak risk<p className="text-xl font-semibold text-destructive">{p.risk}%</p></div></div>
    <div className="h-64 w-full" data-testid="prediction-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={p.points} margin={{ top: 12, right: 10, left: -20, bottom: 5 }}>
      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
      <XAxis dataKey="hour" type="number" domain={[-6,48]} ticks={[-6,0,6,12,24,48]} tickFormatter={v => `${v > 0 ? "+" : ""}${v}h`} stroke="var(--muted-foreground)" fontSize={10} />
      <YAxis domain={[0,100]} stroke="var(--muted-foreground)" fontSize={10} />
      <Tooltip contentStyle={{ background: "var(--popover)", borderColor: "var(--border)", color: "var(--foreground)" }} labelFormatter={v => `${Number(v)>0?"+":""}${v}h`} />
      <Legend wrapperStyle={{ fontSize: 10 }} />
      <ReferenceLine x={0} stroke="var(--foreground)" label={{ value: "NOW", fill: "var(--muted-foreground)", fontSize: 10 }} />
      <ReferenceLine y={CRITICAL_THRESHOLD} stroke="var(--destructive)" strokeDasharray="3 3" />
      <Line name="Observed (simulated)" dataKey="actual" stroke="var(--foreground)" strokeWidth={2} dot={false} />
      <Line name="Without intervention" dataKey="baseline" stroke="var(--destructive)" strokeDasharray="3 4" dot={false} />
      <Line name="Your decisions" dataKey="predicted" stroke="var(--primary)" strokeWidth={3} strokeDasharray="6 3" dot={false} />
      <Line name="Recommended recovery" dataKey="recovery" stroke="var(--success)" strokeDasharray="2 4" dot={false} />
    </LineChart></ResponsiveContainer></div>
    <p className="text-xs text-muted-foreground">Critical threshold {CRITICAL_THRESHOLD}/100 · {p.approved} approved · {p.rejected} rejected · {p.pending} pending</p>
    <p className="text-xs text-muted-foreground">Approved replacement: 30-minute drain, 1.5-hour recovery. Investigation reduces projected exposure, not hardware damage. Predictions do not change actual telemetry.</p>
    {inc.predictionError && <p role="alert" className="text-xs text-destructive">{inc.predictionError} Last verified prediction retained.</p>}
  </section>;
}