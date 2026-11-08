// All numbers are plain simulated data. AI only writes explanations.
export const INCIDENT = {
  title: "Cooling problem in Dallas",
  penaltyPerHour: 80712,
  countdownSeconds: 18 * 60,
  unit: "CRAH-02",
  valveOpen: 38,
  room: "M2",
  badge: "#4491",
  vendor: "Apex Mechanical",
  cluster: "Bravo",
  racks: "09-16",
};

export type CustomerStatus = "Breach imminent" | "At risk" | "Nominal" | "Protected";
export const CUSTOMERS = [
  { id: "LEASE-HYP-02", name: "Hyperscale Cloud Tenant #2", cluster: "Bravo", racks: "09-16", tier: "Tier-0 Mission Critical", mw: 14.5, annual: "$38.4M/yr", rule: "Coolant above 42°C for over 15 min = $80,712/hr penalty and right to terminate.", status: "Breach imminent" as CustomerStatus, costPerHour: 80712 },
  { id: "LEASE-FIN-03", name: "Global Quant & Sovereign Cloud", cluster: "Charlie", racks: "17-24", tier: "Tier-1 Low Latency", mw: 10.2, annual: null, rule: "Power distortion above 5% for over 30 min = $28,500/hr credit.", status: "At risk" as CustomerStatus, costPerHour: 28500 },
  { id: "LEASE-FAI-01", name: "Frontier AI Research Lab", cluster: "Alpha", racks: "01-08", tier: "Tier-0", mw: 16, annual: null, rule: "Efficiency above 1.35 or power dip above 5% = $32,000/hr rebate.", status: "Nominal" as CustomerStatus, costPerHour: 0 },
  { id: "LEASE-BIO-04", name: "BioCompute & Digital Twin Consortium", cluster: "Delta", racks: "25-32", tier: "Tier-2", mw: 7.3, annual: null, rule: "Chilled water above 30°C = 15% monthly rebate.", status: "Nominal" as CustomerStatus, costPerHour: 0 },
];
export const LEASE_TOTAL = { count: 4, annual: "$105.7M/yr" };

export const SITES = [
  { id: "dallas", name: "Dallas (DFW)", tag: "Full", key: [["Capacity", "44.8 / 48 MW"], ["Spare", "3.2 MW"], ["Energy efficiency", "1.24"]], more: ["93.3% used", "Floor weight limit 350 lbs/sq ft (maxed)", "Expansion needs $14M substation rebuild", "5 racks need maintenance"], fit: null },
  { id: "hillsboro", name: "Hillsboro, OR", tag: "Recommended", key: [["Ready now", "18 MW"], ["Fit", "96%"], ["Saves", "$1.84M/yr"]], more: ["34.0 MW available", "Energy efficiency 1.11 (15% better)", "Floor weight limit 500 lbs/sq ft", "Liquid-cooled, 100% hydro"], fit: 96 },
  { id: "columbus", name: "Columbus, OH", tag: "Waiting", key: [["Available", "0.0 MW"], ["Power ready", "Q4 2027"], ["Fit", "78%"]], more: ["Waiting in grid queue", "Energy efficiency 1.25", "Floor weight limit 400 lbs/sq ft", "18-month grid delay"], fit: 78 },
];

export type RackState = "green" | "amber" | "red";
export const CLUSTERS = [
  { name: "Alpha", range: [1, 8], role: "LLM" },
  { name: "Bravo", range: [9, 16], role: "Inference" },
  { name: "Charlie", range: [17, 24], role: "Quant" },
  { name: "Delta", range: [25, 32], role: "Simulation" },
] as const;

const RED: Record<number, { issue: string; health: number }> = {
  11: { issue: "Manifold leak", health: 43 },
  12: { issue: "Thermal paste pump-out", health: 45 },
  19: { issue: "Power supply ripple", health: 34 },
  20: { issue: "Harmonics", health: 34 },
  27: { issue: "Cooling pump bearing", health: 71 },
};
// 12 amber cooling-drift racks: Bravo (minus reds) + Charlie extras
const AMBER = [9, 10, 13, 14, 15, 16, 17, 18, 21, 22, 23, 24];

export type Rack = { n: number; id: string; cluster: string; state: RackState; health: number; issue: string };
export const RACKS: Rack[] = Array.from({ length: 32 }, (_, i) => {
  const n = i + 1;
  const cluster = CLUSTERS.find((c) => n >= c.range[0] && n <= c.range[1])!.name;
  const id = `R-${String(n).padStart(2, "0")}`;
  if (RED[n]) return { n, id, cluster, state: "red", ...RED[n] };
  if (AMBER.includes(n)) return { n, id, cluster, state: "amber", health: n === 9 ? 79 : n === 23 ? 71 : 74 + (n % 6), issue: "Temporary cooling drift" };
  return { n, id, cluster, state: "green", health: n === 1 ? 97 : 92 + (n % 6), issue: "Healthy" };
});

export const RACK_DETAIL = {
  id: "RACK-23",
  model: "Hopper H200 Hybrid",
  readings: [
    { label: "Coolant temp", term: "Coolant temperature", value: "46.7°C", meaning: "Running warm because the cooling loop drifted." },
    { label: "Power quality", term: "THD / ripple", value: "26.9 mV", meaning: "Slight electrical noise, within safe range." },
    { label: "Flow rate", term: "Coolant flow", value: "20.2 L/min", meaning: "Less coolant than normal is reaching this rack." },
    { label: "Memory errors", term: "ECC errors", value: "12/h", meaning: "A few corrected errors, caused by heat." },
  ],
  load: "78.1 kW",
  trays: [
    { slot: "U5", name: "NVLink Switch", temp: "60.9°C", noise: "25.1mV", errors: "0" },
    { slot: "U6", name: "HGX H200", temp: "60.3°C", noise: "22.8mV", errors: "0" },
    { slot: "U7", name: "HGX H200", temp: "59.7°C", noise: "20.6mV", errors: "8/h" },
    { slot: "U8", name: "Rectifier PSU shelf", temp: "62.5°C", noise: "26.9mV", errors: "0" },
  ],
  verdict: "Hardware is fine once the cooling loop is stabilized.",
  status: "Verified nominal",
};

export const HANDOFF = [
  { when: "26 min ago", title: "Vendor left a cooling valve open", detail: "Outgoing note: vendor bled air from CRAH-02 and left the bypass valve at about 38% while the gauge settled.", action: "Close the manual valve in Mech Room M2 and confirm loop flow of at least 39 L/min." },
  { when: "+12 min", title: "AI linked valve to rising heat", detail: "AI linked the valve note to the temperature rise across 12 recoverable racks and wear on 5 racks needing parts.", action: "Confirm the workload drain and open valve V-204B." },
  { when: "Night queue", title: "5 racks staged for repair", detail: "Cage 4 hot-swap: R-11 (U4 manifold/blade), R-12 (U2 blade, U5 NVLink), R-19 and R-20 (U8 48V power shelf + blade), R-27 (cooling pump bearing).", action: "Pull the pre-staged blades and power shelves from Cage 4 and sign." },
];

export const fmtMoney = (n: number) => `$${n.toLocaleString("en-US")}`;
