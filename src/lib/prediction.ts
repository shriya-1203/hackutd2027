import { bladeAt, bladesAt, summarizeBlades, type Blade } from "./infra-data";

export const FUTURE_MAX = 48 * 60;
export const CRITICAL_THRESHOLD = 40;
export type PredictionAction = { id: string; bladeId: string; action: string; rackId: string };
export type Decisions = Record<string, "approved" | "rejected">;
export type PredictionPoint = { hour: number; actual?: number; baseline?: number; predicted?: number; recovery?: number; risk?: number };
export type Prediction = { points: PredictionPoint[]; current: number; future: number; baseline: number; risk: number; approved: number; rejected: number; pending: number; bladeIds: string[]; version: string };

export function observedBlades(actions: PredictionAction[] = [], executed: string[] = [], minutesAgo = 0): Blade[] {
  const base = bladesAt(Math.max(0, minutesAgo));
  // Historical observations are immutable; only recorded simulated executions
  // change present telemetry, and investigation is not a repair.
  if (minutesAgo > 0) return base;
  const done = actions.filter(a => executed.includes(a.id));
  const cooling = done.some(a => a.action === "Restore cooling loop");
  return base.map(b => {
    if (done.some(a => a.bladeId === b.id && a.action === "Replace blade")) return { ...b, health: "green", temp: bladeAt(b.rackN, b.slot, 360).temp, cpu: bladeAt(b.rackN, b.slot, 360).cpu, errors: 0, failureRisk: 0.04, reason: "Approved blade replacement completed (simulated)", action: "No action required", signals: [] };
    if (cooling && b.health === "yellow") return { ...bladeAt(b.rackN, b.slot, 360), reason: "Approved cooling restoration completed (simulated)" };
    return b;
  });
}

export function projectBlades(hours: number, actions: PredictionAction[], decisions: Decisions, executed: string[] = []): Blade[] {
  if (!Number.isFinite(hours) || hours < 0 || hours > 48) throw new Error("Prediction horizon must be 0–48 hours");
  const current = observedBlades(actions, executed);
  const cooling = actions.some(a => a.action === "Restore cooling loop" && decisions[a.id] === "approved");
  return current.map(b => {
    if (hours === 0 || b.health === "gray") return b;
    const action = actions.find(a => a.bladeId === b.id && decisions[a.id] === "approved");
    const past = bladeAt(b.rackN, b.slot, 60);
    const thermalSlope = Math.max(0, b.temp - past.temp) / 60;
    const fault = b.health === "red" || b.health === "orange";
    const recovery = action?.action === "Replace blade" ? 1 - Math.exp(-Math.max(0, hours - 0.5) / 1.5) : cooling && b.health === "yellow" ? 1 - Math.exp(-hours / 0.75) : 0;
    // Investigations reduce uncertainty/exposure but do not claim a repair.
    const mitigation = action?.action === "Schedule hardware investigation" ? 0.25 : 0;
    const hazard = (fault ? 0.025 + b.failureRisk * 0.05 : b.health === "yellow" ? 0.012 : 0.0002) + thermalSlope * 0.018 + b.errors * 0.00015;
    const risk = (1 - (1 - b.failureRisk) * Math.exp(-hazard * hours * (1 - mitigation))) * (1 - recovery) + 0.04 * recovery;
    const temp = Math.min(105, b.temp + (fault ? 0.4 : b.health === "yellow" ? 0.18 : 0.01) * hours + thermalSlope * Math.min(hours, 6)) * (1 - recovery) + 58 * recovery;
    const health = recovery > 0.8 ? "green" : risk > 0.7 ? "red" : risk > 0.45 ? "orange" : risk > 0.2 ? "yellow" : "green";
    return { ...b, health, temp: Math.round(temp * 10) / 10, errors: Math.round((b.errors + hours * hazard * 10) * (1 - recovery)), failureRisk: Math.round(risk * 1000) / 1000, reason: recovery > 0 ? "Simulated intervention outcome — not observed telemetry" : "Model-predicted degradation from historical temperature, errors and failure risk" };
  });
}

const healthScore = (b: Blade) => b.health === "gray" ? 0 : Math.max(0, Math.min(100, 100 - b.failureRisk * 60 - Math.max(0, b.temp - 65) * 0.6 - Math.min(15, b.errors * 0.2)));
const score = (blades: Blade[]) => Math.round(blades.reduce((s, b) => s + healthScore(b), 0) / Math.max(1, blades.length));

export function simulate(actions: PredictionAction[], decisions: Decisions, executed: string[] = [], rackId?: string): Prediction {
  const targets = new Set(actions.filter(a => !rackId || a.rackId === rackId).map(a => a.bladeId));
  const coolingTargets = new Set(observedBlades(actions, executed).filter(b => b.health === "yellow").map(b => b.id));
  const scope = (bs: Blade[]) => bs.filter(b => rackId ? `R-${String(b.rackN).padStart(2, "0")}` === rackId : targets.size ? targets.has(b.id) || (coolingTargets.has(b.id) && targets.has("CRAH-02")) : true);
  const points: PredictionPoint[] = [-6, -4, -2, -1, 0].map(hour => ({ hour, actual: score(scope(observedBlades(actions, executed, -hour * 60))) }));
  const approvedAll: Decisions = Object.fromEntries(actions.map(a => [a.id, "approved"]));
  for (const hour of [0, 1, 2, 6, 12, 24, 48]) {
    const projected = scope(projectBlades(hour, actions, decisions, executed));
    const point = { hour, predicted: score(projected), baseline: score(scope(projectBlades(hour, actions, {}, executed))), recovery: score(scope(projectBlades(hour, actions, approvedAll, executed))), risk: Math.round(Math.max(0, ...projected.map(b => b.failureRisk)) * 100) };
    const currentPoint = points[points.length - 1];
    if (hour === 0 && currentPoint) Object.assign(currentPoint, point); else points.push(point);
  }
  const last = points[points.length - 1];
  return { points, current: points.find(p => p.hour === 0)?.actual ?? 0, future: last?.predicted ?? 0, baseline: last?.baseline ?? 0, risk: last?.risk ?? 0, approved: actions.filter(a => decisions[a.id] === "approved").length, rejected: actions.filter(a => decisions[a.id] === "rejected").length, pending: actions.filter(a => !decisions[a.id]).length, bladeIds: scope(observedBlades(actions, executed)).map(b => b.id), version: "telemetry-v2" };
}

export function infrastructureSummary(blades: Blade[]) {
  const critical = blades.filter(b => b.health === "red").sort((a,b) => b.failureRisk - a.failureRisk);
  return { ...summarizeBlades(blades), criticalBlades: critical, affectedRacks: new Set(critical.map(b => b.rackN)).size, priority: critical[0] };
}