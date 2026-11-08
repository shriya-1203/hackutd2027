// Blade-level infrastructure model and simulated historical telemetry.
// All numbers are deterministic simulated data. AI only writes explanations.
import { RACKS } from "./demo-data";

export type BladeHealth = "green" | "yellow" | "orange" | "red" | "gray";

export type Blade = {
  id: string; // R-11-B04
  rackN: number;
  slot: number; // 1..8
  health: BladeHealth;
  cpu: number; // %
  mem: number; // %
  temp: number; // °C
  power: number; // kW
  net: number; // %
  errors: number; // per hour
  failureRisk: number; // 0..1
  action: string;
  reason: string;
  signals: string[];
};

export const BLADES_PER_RACK = 8;
// Existing four RACK_DETAIL rows describe switches, GPU assemblies and PSU
// components, not enclosures. Explicit synthetic hierarchy: one enclosure/rack.
export const CHASSIS_PER_RACK = 1;
export const chassisId = (rackN: number) => `R-${String(rackN).padStart(2, "0")}-C01`;
export const TIMELINE_MAX = 360; // 6 hours of history
export const TIMELINE_STEP = 5;

export const BLADE_COLORS: Record<BladeHealth, string> = {
  green: "#22c55e",
  yellow: "#eab308",
  orange: "#f97316",
  red: "#ef4444",
  gray: "#64748b",
};

export const BLADE_LABELS: Record<BladeHealth, string> = {
  green: "Healthy",
  yellow: "Degraded",
  orange: "Attention",
  red: "Critical",
  gray: "Offline",
};

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n: number) => String(n).padStart(2, "0");
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const r1 = (v: number) => Math.round(v * 10) / 10;

type Fault = {
  health: BladeHealth;
  reason: string;
  signals: string[];
  action: string;
  degradedAt: number; // minutes ago the fault began
  maxErrors: number;
  risk: number; // failure risk at full severity
};

// Specific blade faults. Red blades match the staged repairs in the shift handoff.
const FAULTS: Record<string, Fault> = {
  "11-4": { health: "red", reason: "Manifold leak at quick-disconnect coupling", signals: ["Coolant flow −38%", "Inlet temp +9.2°C", "Drip sensor alert U4"], action: "Replace blade", degradedAt: 40, maxErrors: 46, risk: 0.89 },
  "12-2": { health: "red", reason: "Thermal paste pump-out on GPU baseplate", signals: ["Junction temp 94°C", "Thermal throttle 22%", "Fan duty 100%"], action: "Replace blade", degradedAt: 55, maxErrors: 31, risk: 0.84 },
  "12-5": { health: "red", reason: "NVLink switch fabric errors", signals: ["Link flaps 14/h", "CRC errors rising", "Port 3 degraded"], action: "Replace blade", degradedAt: 50, maxErrors: 58, risk: 0.81 },
  "19-8": { health: "red", reason: "PSU ripple beyond tolerance", signals: ["91.8 mV ripple", "Voltage droop events", "Capacitor wear high"], action: "Replace blade", degradedAt: 190, maxErrors: 12, risk: 0.77 },
  "20-8": { health: "red", reason: "Harmonic distortion on power shelf", signals: ["THD 8.7%", "Rectifier temp rising", "Phase imbalance"], action: "Replace blade", degradedAt: 185, maxErrors: 9, risk: 0.74 },
  "27-3": { health: "red", reason: "Cooling pump bearing wear", signals: ["Vibration 4.2 mm/s", "Acoustic anomaly", "Flow variance ±12%"], action: "Replace blade", degradedAt: 240, maxErrors: 6, risk: 0.72 },
  "9-6": { health: "orange", reason: "Increasing correctable memory errors", signals: ["ECC errors 22/h", "Temp 8°C above peers"], action: "Schedule hardware investigation", degradedAt: 90, maxErrors: 22, risk: 0.61 },
  "14-3": { health: "orange", reason: "Fan rotor imbalance", signals: ["Vibration rising", "RPM oscillation"], action: "Schedule hardware investigation", degradedAt: 100, maxErrors: 3, risk: 0.55 },
  "23-4": { health: "orange", reason: "SSD write-latency outliers", signals: ["p99 write 14 ms", "Wear level 81%"], action: "Schedule hardware investigation", degradedAt: 130, maxErrors: 5, risk: 0.58 },
  "12-7": { health: "orange", reason: "Intermittent PCIe bus errors", signals: ["AER errors 9/h", "Link retraining"], action: "Schedule hardware investigation", degradedAt: 70, maxErrors: 9, risk: 0.52 },
  "5-8": { health: "gray", reason: "Offline — no telemetry since maintenance", signals: ["No heartbeat 6h"], action: "Investigate hardware", degradedAt: 9999, maxErrors: 0, risk: 0 },
  "31-7": { health: "gray", reason: "Offline — awaiting parts", signals: ["No heartbeat 2d"], action: "Investigate hardware", degradedAt: 9999, maxErrors: 0, risk: 0 },
};

// Severity ramps from 0 to 1 over the 30 minutes after a fault begins.
// minutesAgo = 0 is "now" (worst); larger values look further into the past.
function severityAt(degradedAt: number, minutesAgo: number) {
  return clamp01((degradedAt + 15 - minutesAgo) / 30);
}

const stepDown: Record<BladeHealth, BladeHealth> = { red: "orange", orange: "yellow", yellow: "green", green: "green", gray: "gray" };

export function bladeAt(rackN: number, slot: number, minutesAgo = 0): Blade {
  const rnd = mulberry32(rackN * 100 + slot);
  const id = `R-${pad(rackN)}-B${pad(slot)}`;
  const fault = FAULTS[`${rackN}-${slot}`];

  // Healthy baselines vary deterministically per blade.
  const cpu0 = 38 + rnd() * 40;
  const mem0 = 45 + rnd() * 30;
  const temp0 = 54 + rnd() * 8;
  const power0 = 0.55 + rnd() * 0.35;
  const net0 = 60 + rnd() * 30;

  if (fault?.health === "gray") {
    return { id, rackN, slot, health: "gray", cpu: 0, mem: 0, temp: 0, power: 0, net: 0, errors: 0, failureRisk: 0, action: fault.action, reason: fault.reason, signals: fault.signals };
  }

  // Rack-level cooling drift (amber racks) started 26 min ago and recovers in the past.
  const rack = RACKS[rackN - 1];
  const drift = rack?.state === "amber" ? severityAt(26, minutesAgo) : 0;
  const fsev = fault ? severityAt(fault.degradedAt, minutesAgo) : 0;

  let health: BladeHealth = "green";
  if (fault && fsev > 0.66) health = fault.health;
  else if (fault && fsev > 0.2) health = stepDown[fault.health];
  else if (drift > 0.15) health = "yellow";

  const sev = Math.max(fsev, drift * 0.6);
  const temp = r1(temp0 + fsev * (fault?.health === "red" ? 32 : 16) + drift * 8);
  const cpu = r1(Math.min(99, cpu0 + sev * 15));
  const mem = r1(Math.min(98, mem0 + sev * 8));
  const power = r1(power0 + sev * 0.25);
  const net = r1(Math.max(5, net0 - fsev * 20));
  const errors = Math.round(fsev * (fault?.maxErrors ?? 4) + drift * 6);
  const failureRisk = Math.round((fault ? fault.risk * (0.4 + 0.6 * fsev) : drift * 0.3) * 100) / 100;

  const active = fault && fsev > 0.2;
  return {
    id, rackN, slot, health, cpu, mem, temp, power, net, errors,
    failureRisk: Math.min(0.99, failureRisk),
    action: active ? fault.action : drift > 0.15 ? "Continue monitoring" : "No action required",
    reason: active ? fault.reason : drift > 0.15 ? "Cooling drift — recovers when the loop stabilizes" : "Operating within normal range",
    signals: active ? fault.signals : drift > 0.15 ? ["Coolant flow below target", "Inlet temp rising"] : [],
  };
}

export function bladesAt(minutesAgo = 0): Blade[] {
  const out: Blade[] = [];
  for (let r = 1; r <= 32; r++) for (let s = 1; s <= BLADES_PER_RACK; s++) out.push(bladeAt(r, s, minutesAgo));
  return out;
}

export type RackStats = {
  blades: Blade[];
  total: number;
  healthy: number;
  degraded: number; // yellow
  attention: number; // orange
  critical: number; // red
  offline: number; // gray
  cpu: number;
  mem: number;
  temp: number;
  power: number;
  net: number;
  uptime: string;
  hwHealth: number;
  maxRisk: number;
};

export function rackStats(rackN: number, minutesAgo = 0): RackStats {
  const blades = Array.from({ length: BLADES_PER_RACK }, (_, i) => bladeAt(rackN, i + 1, minutesAgo));
  return summarizeBlades(blades);
}

export function summarizeBlades(blades: Blade[]): RackStats {
  const live = blades.filter((b) => b.health !== "gray");
  const avg = (f: (b: Blade) => number) => r1(live.reduce((a, b) => a + f(b), 0) / Math.max(1, live.length));
  const count = (h: BladeHealth) => blades.filter((b) => b.health === h).length;
  return {
    blades,
    total: blades.length,
    healthy: count("green"),
    degraded: count("yellow"),
    attention: count("orange"),
    critical: count("red"),
    offline: count("gray"),
    cpu: avg((b) => b.cpu),
    mem: avg((b) => b.mem),
    temp: avg((b) => b.temp),
    power: r1(live.reduce((sum, b) => sum + b.power, 0)),
    net: avg((b) => b.net),
    uptime: "99.98%",
    hwHealth: Math.round(blades.reduce((sum, b) => sum + ({ green: 100, yellow: 80, orange: 60, red: 30, gray: 0 }[b.health]), 0) / Math.max(1, blades.length)),
    maxRisk: Math.max(0, ...blades.map((b) => b.failureRisk)),
  };
}

// Historical event markers for the timeline. t = minutes ago.
export type DcEvent = { t: number; type: "degradation" | "spike" | "failure" | "network" | "replacement" | "action" | "recovery" | "ai"; label: string; rack?: number };
export const EVENTS: DcEvent[] = [
  { t: 300, type: "replacement", label: "Blade R-30-B06 replaced (planned maintenance)", rack: 30 },
  { t: 240, type: "degradation", label: "R-27 cooling pump bearing vibration rising", rack: 27 },
  { t: 190, type: "degradation", label: "R-19 PSU ripple first detected", rack: 19 },
  { t: 185, type: "degradation", label: "R-20 harmonic distortion on power shelf", rack: 20 },
  { t: 45, type: "network", label: "Charlie fabric interruption (40 s)", rack: 18 },
  { t: 26, type: "spike", label: "Vendor left CRAH-02 bypass valve 38% open" },
  { t: 22, type: "spike", label: "Bravo coolant temperature +6°C" },
  { t: 18, type: "failure", label: "R-11-B04 flagged critical (manifold leak)", rack: 11 },
  { t: 12, type: "ai", label: "AI warning: SLA breach risk within 18 min" },
  { t: 5, type: "degradation", label: "R-12-B02 thermal throttling", rack: 12 },
];

export const EVENT_COLORS: Record<DcEvent["type"], string> = {
  degradation: "#eab308",
  spike: "#f97316",
  failure: "#ef4444",
  network: "#4d8dff",
  replacement: "#22c55e",
  action: "#4d8dff",
  recovery: "#22c55e",
  ai: "#a78bfa",
};

export const fmtAgo = (m: number) => (m === 0 ? "Now" : `−${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`);
