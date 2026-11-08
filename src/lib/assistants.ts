// AI assistant service. Returns scripted demo results today.
// Later: swap `scripted()` for a createServerFn that calls NVIDIA's OpenAI-compatible
// chat API (model from a config var, key in a server-side secret). Numbers stay in code.
import { Cpu, Snowflake, Zap, Radio, type LucideIcon } from "lucide-react";

export type AssistantName = "Cooling" | "Power" | "Hardware" | "Dispatcher";
export type Step = { kind: "Reason" | "Act" | "Observe"; text: string; source?: string };
export type AssistantResult = {
  summary: string;
  status: "Done" | "Pending";
  steps: Step[];
  toolCalls: string[];
  sources: string[];
};

export const ASSISTANTS: { name: AssistantName; icon: LucideIcon; title: string; line: string }[] = [
  { name: "Cooling", icon: Snowflake, title: "Cooling assistant", line: "Found valve CRAH-02 left 38% open." },
  { name: "Power", icon: Zap, title: "Power assistant", line: "Cut power distortion from 8.7% to 1.9%." },
  { name: "Hardware", icon: Cpu, title: "Hardware assistant", line: "Staged 5 repair kits, saved $242.5K." },
  { name: "Dispatcher", icon: Radio, title: "Dispatcher", line: "Moved 48 jobs, opened backup valve." },
];

const DATA: Record<AssistantName, AssistantResult> = {
  Cooling: {
    summary: "Unclosed manual valve in Room M2 threatens $80,712/hr within 18 min.",
    status: "Done",
    steps: [
      { kind: "Reason", text: "Coolant flow to Cluster Bravo dropped by 14.2 L/min.", source: "BMS telemetry · Loop B" },
      { kind: "Act", text: "Checked access logs for Room M2 since last shift.", source: "Access log · badge #4491" },
      { kind: "Observe", text: "Apex Mechanical left CRAH-02 bypass valve at 38%.", source: "Work order · Apex Mechanical" },
    ],
    toolCalls: ["query_bms_telemetry(loop='B')", "query_access_log(room='M2')"],
    sources: ["BMS telemetry · Loop B", "Access log · badge #4491", "LEASE-HYP-02"],
  },
  Power: {
    summary: "Ripple on Feeder PDU-B1 fixed; 16 racks protected.",
    status: "Done",
    steps: [
      { kind: "Reason", text: "91.8mV ripple found on Feeder PDU-B1.", source: "PDU-B1 power meter" },
      { kind: "Act", text: "Rebalanced load on Cluster Charlie rectifiers.", source: "Rectifier controller" },
      { kind: "Observe", text: "Distortion fell from 8.7% to 1.9%.", source: "LEASE-FIN-03 rule" },
    ],
    toolCalls: ["read_power_quality(feeder='PDU-B1')"],
    sources: ["PDU-B1 power meter", "LEASE-FIN-03"],
  },
  Hardware: {
    summary: "Damaged seals on Rack-11 and 4 others; 5 kits staged in Cage 4.",
    status: "Done",
    steps: [
      { kind: "Reason", text: "Separated heat-only racks from truly damaged ones.", source: "Rack health model" },
      { kind: "Act", text: "Inspected quick-disconnect seals on Rack-11, U4 tray.", source: "Rack-11 sensor log" },
      { kind: "Observe", text: "Only 5 racks need parts, avoiding $242.5K waste.", source: "Inventory · Cage 4" },
    ],
    toolCalls: ["classify_rack_faults(cluster='all')", "stage_parts(cage=4, kits=5)"],
    sources: ["Rack health model", "Inventory · Cage 4"],
  },
  Dispatcher: {
    summary: "Cooling stabilized. Recommends moving 18 MW to Hillsboro.",
    status: "Done",
    steps: [
      { kind: "Reason", text: "Bravo racks must cool before the contract rule triggers.", source: "LEASE-HYP-02 rule" },
      { kind: "Act", text: "Opened backup valve V-204B; moved 48 GPU jobs.", source: "Scheduler · job log" },
      { kind: "Observe", text: "Dallas has only 3.2 MW spare; status sent to lease portal.", source: "Dallas capacity record" },
    ],
    toolCalls: ["open_valve(id='V-204B')", "drain_jobs(racks='09-16', n=48)", "post_lease_portal(lease='LEASE-HYP-02')"],
    sources: ["Scheduler · job log", "Dallas capacity record", "Lease portal"],
  },
};

export async function runAssistant(name: AssistantName, _context?: unknown): Promise<AssistantResult> {
  await new Promise((r) => setTimeout(r, 400));
  return DATA[name];
}
