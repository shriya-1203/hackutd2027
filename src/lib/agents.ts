// Multi-agent troubleshooting orchestration.
// Metrics are computed deterministically from the demo telemetry; Nemotron only
// writes the reasoning text. If the NVIDIA API is unreachable, each agent falls
// back to a scripted explanation and the finding is labeled as such.
import { Activity, BrainCircuit, BusinessImpactIcon, FlaskConical, Gauge, Wrench } from "./agent-icons";
import { CUSTOMERS, RACKS } from "./demo-data";
import { bladesAt, type Blade, type BladeHealth } from "./infra-data";
import { simulate } from "./prediction";
import { nemotronReason } from "./nemotron.functions";

export const AGENTS = [
  { name: "Infrastructure Monitoring", icon: Activity, role: "Watches telemetry and flags anomalies." },
  { name: "Failure Prediction", icon: BrainCircuit, role: "Estimates which blades are likely to fail." },
  { name: "Troubleshooting", icon: Wrench, role: "Decides replace, investigate or monitor." },
  { name: "Simulation & Evaluation", icon: FlaskConical, role: "Compares intervention strategies." },
  { name: "Business Impact", icon: BusinessImpactIcon, role: "Translates faults into cost and SLA risk." },
  { name: "Resource Optimization", icon: Gauge, role: "Finds workload redistribution opportunities." },
] as const;

export type AgentName = (typeof AGENTS)[number]["name"];
export type AgentStatus = "Idle" | "Analyzing" | "Evaluating" | "Simulating" | "Awaiting approval" | "Completed" | "Failed";

export type Finding = {
  agent: AgentName;
  issueId: string;
  rack: string;
  blade?: string | undefined;
  observations: string[];
  severity: "critical" | "high" | "medium" | "low";
  confidence: number; // 0..1
  telemetry: string[];
  actions: string[];
  consequences: string;
  reasoning: string;
  reasoningSource: "nemotron" | "fallback";
  approvalsRequired: boolean;
  at: string;
};

export type PlanAction = {
  id: string;
  bladeId: string;
  rackId: string;
  component: string;
  condition: BladeHealth;
  action: "Replace blade" | "Schedule hardware investigation" | "Continue monitoring" | "Restore cooling loop";
  category: "critical" | "recommended" | "monitor";
  reason: string;
  telemetry: string[];
  confidence: number;
  predictedOutcome: string;
  risk: string;
  businessImpact: string;
  failureRisk: number;
};

export type Scenario = {
  id: "A" | "B" | "C";
  name: string;
  healthAfter: number;
  failureProb: number;
  downtimeMin: number;
  costUsd: number;
  risk: "Low" | "Medium" | "High";
  recommended: boolean;
  note: string;
};

export type TroubleshootPlan = {
  issueSummary: string;
  actions: PlanAction[];
  scenarios: Scenario[];
  generatedAt: string;
  simulated: true;
  recommendation?: string;
};

const now = () => new Date().toLocaleTimeString("en-US", { hour12: false });
const pad = (n: number) => String(n).padStart(2, "0");

function customerForRack(rackN: number) {
  const cluster = RACKS[rackN - 1]?.cluster;
  return CUSTOMERS.find((c) => c.cluster === cluster);
}

// --- Deterministic plan generation (no AI involved in the numbers) ---

export function buildPlan(minutesAgo = 0): TroubleshootPlan {
  const blades = bladesAt(minutesAgo).filter((b) => b.health === "red" || b.health === "orange" || (b.health === "yellow" && b.failureRisk > 0.3));
  const actions: PlanAction[] = blades.map((b) => {
    const cust = customerForRack(b.rackN);
    const impact = cust
      ? `Cluster ${cust.cluster} serves ${cust.name} (${cust.tier}). SLA exposure ${cust.costPerHour > 0 ? `$${cust.costPerHour.toLocaleString("en-US")}/hr` : "none currently"}.`
      : "No direct lease exposure.";
    if (b.health === "red") {
      return {
        id: `act-${b.id}`, bladeId: b.id, rackId: `R-${pad(b.rackN)}`, component: `Blade ${b.id}`,
        condition: b.health, action: "Replace blade", category: "critical",
        reason: b.reason, telemetry: b.signals, confidence: 0.9,
        predictedOutcome: "Blade swapped from Cage 4 stock; rack returns to full redundancy within the maintenance window.",
        risk: "Hot-swap carries minimal workload risk; jobs drain first.",
        businessImpact: impact, failureRisk: b.failureRisk,
      };
    }
    if (b.health === "orange") {
      return {
        id: `act-${b.id}`, bladeId: b.id, rackId: `R-${pad(b.rackN)}`, component: `Blade ${b.id}`,
        condition: b.health, action: "Schedule hardware investigation", category: "recommended",
        reason: b.reason, telemetry: b.signals, confidence: 0.7,
        predictedOutcome: "Confirms or rules out hardware failure before committing parts.",
        risk: "Deferring replacement carries a moderate chance of escalation.",
        businessImpact: impact, failureRisk: b.failureRisk,
      };
    }
    return {
      id: `act-${b.id}`, bladeId: b.id, rackId: `R-${pad(b.rackN)}`, component: `Blade ${b.id}`,
      condition: b.health, action: "Continue monitoring", category: "monitor",
      reason: b.reason, telemetry: b.signals, confidence: 0.8,
      predictedOutcome: "Expected to recover once the cooling loop stabilizes.",
      risk: "Low; alert thresholds stay armed.",
      businessImpact: impact, failureRisk: b.failureRisk,
    };
  });

  if (bladesAt(minutesAgo).some(b => b.health === "yellow")) actions.push({
    id: "act-cooling", bladeId: "CRAH-02", rackId: "R-11", component: "Cooling loop CRAH-02 · Bravo / Charlie",
    condition: "yellow", action: "Restore cooling loop", category: "critical", reason: "Bypass valve left 38% open; restore verified flow before hardware work.",
    telemetry: ["Vendor bypass valve 38% open", "Cooling drift across 12 racks"], confidence: 0.9,
    predictedOutcome: "Thermal-only warnings recover after approved simulated loop restoration.", risk: "Confirm valve position and flow before proceeding; hardware faults remain.", businessImpact: "Bravo SLA exposure $80,712/hr.", failureRisk: 0.3,
  });
  const critical = actions.filter((a) => a.category === "critical");
  const allApproved = Object.fromEntries(actions.map(a => [a.id, "approved" as const]));
  const full = simulate(actions, allApproved);
  const baseline = simulate(actions, {});
  const worst = actions.filter(a => a.action === "Replace blade").sort((a,b) => b.failureRisk - a.failureRisk)[0];
  const partial = simulate(actions, worst ? { [worst.id]: "approved" } : {});
  const scenarios: Scenario[] = [
    { id: "A", name: "Restore cooling, replace confirmed faults and investigate uncertain faults", healthAfter: full.future, failureProb: full.risk / 100, downtimeMin: 0, costUsd: critical.filter(a => a.action === "Replace blade").length * 9800, risk: "Low", recommended: true, note: "Staged simulated parts; drain workloads first. Investigations are not repairs." },
    { id: "B", name: "Replace highest-risk blade only", healthAfter: partial.future, failureProb: partial.risk / 100, downtimeMin: 0, costUsd: worst ? 9800 : 0, risk: "Medium", recommended: false, note: "Other faults and cooling drift remain." },
    { id: "C", name: "No intervention", healthAfter: baseline.future, failureProb: baseline.risk / 100, downtimeMin: 45, costUsd: 80712, risk: "High", recommended: false, note: "Continued degradation from observed thermal trends and error rates." },
  ];

  const redCount = bladesAt(minutesAgo).filter((b) => b.health === "red").length;
  const orangeCount = bladesAt(minutesAgo).filter((b) => b.health === "orange").length;
  return {
    issueSummary: `${redCount} critical and ${orangeCount} degraded blades need attention. Cooling drift in Cluster Bravo is recoverable; hardware faults are not.`,
    actions,
    scenarios,
    generatedAt: now(),
    simulated: true,
  };
}

// --- Orchestrated workflow ---

type Emit = (agent: AgentName, text: string) => void;
type SetStatus = (agent: AgentName, status: AgentStatus) => void;

// Guard against a model leaking its chain-of-thought into the visible answer.
export const REASONING_LEAK = /thinking process|analyze user input|draft - mental rehearsal|check against constraints/i;

async function reason(agent: AgentName, prompt: string, fallback: string): Promise<{ text: string; source: "nemotron" | "fallback" }> {
  const r = await nemotronReason({ data: { agent, prompt } });
  if (r.ok && !REASONING_LEAK.test(r.text)) return { text: r.text, source: "nemotron" };
  return { text: fallback, source: "fallback" };
}

export async function runAgentWorkflow(
  minutesAgo: number,
  emit: Emit,
  setStatus: SetStatus,
): Promise<{ plan: TroubleshootPlan; findings: Finding[] }> {
  const findings: Finding[] = [];
  const all = bladesAt(minutesAgo);
  const bad = all.filter((b) => b.health !== "green");
  const critical = all.filter((b) => b.health === "red");
  const orange = all.filter((b) => b.health === "orange");

  // 1. Monitoring
  setStatus("Infrastructure Monitoring", "Analyzing");
  const monTelemetry = [
    ` blades non-green: ${bad.length} of ${all.length}`,
    `critical: ${critical.map((b) => b.id).join(", ")}`,
    `hottest: ${[...all].sort((a, b) => b.temp - a.temp)[0]?.id} at ${[...all].sort((a, b) => b.temp - a.temp)[0]?.temp}°C`,
  ];
  const monReason = await reason(
    "Infrastructure Monitoring",
    `Telemetry scan of 256 blades across 32 racks. Findings: ${monTelemetry.join("; ")}. Explain what stands out.`,
    `Scan of 256 blades found ${bad.length} outside normal range. The critical set is concentrated in racks R-11, R-12, R-19, R-20 and R-27, and Bravo's cooling drift is pushing otherwise healthy blades toward warning thresholds.`,
  );
  findings.push({
    agent: "Infrastructure Monitoring", issueId: "ISS-COOLING-BRAVO", rack: "Bravo 09–16",
    observations: [`${bad.length} blades outside normal range`, "Cooling drift across 12 Bravo/Charlie racks", "6 blades critical with hardware faults"],
    severity: "critical", confidence: 0.95, telemetry: monTelemetry,
    actions: ["Escalate to Failure Prediction"], consequences: "SLA breach risk within 18 minutes if Bravo keeps warming.",
    reasoning: monReason.text, reasoningSource: monReason.source, approvalsRequired: false, at: now(),
  });
  emit("Infrastructure Monitoring", `Detected ${bad.length} degraded blades; ${critical.length} critical.`);
  setStatus("Infrastructure Monitoring", "Completed");

  // 2. Failure Prediction
  setStatus("Failure Prediction", "Evaluating");
  const riskList = critical.map((b) => `${b.id} ${(b.failureRisk * 100).toFixed(0)}%`).join(", ");
  const predReason = await reason(
    "Failure Prediction",
    `Failure risk estimates from telemetry: ${riskList}. Signals include ${critical[0]?.signals.join(", ") ?? "none"}. Explain which blades are most likely to fail and why.`,
    `The six critical blades carry failure-risk estimates between 72% and 89%, driven by thermal, power and vibration signals that have worsened monotonically. R-11-B04 (manifold leak) is the most likely near-term failure.`,
  );
  findings.push({
    agent: "Failure Prediction", issueId: "ISS-COOLING-BRAVO", rack: "Multiple", blade: critical[0]?.id,
    observations: critical.map((b) => `${b.id}: ${(b.failureRisk * 100).toFixed(0)}% failure risk — ${b.reason}`),
    severity: "critical", confidence: 0.85, telemetry: critical.flatMap((b) => b.signals).slice(0, 6),
    actions: ["Prioritize R-11-B04", "Estimate time-to-failure in days, not weeks"],
    consequences: "Unplanned outage of up to 6 blades if no action is taken.",
    reasoning: predReason.text, reasoningSource: predReason.source, approvalsRequired: false, at: now(),
  });
  emit("Failure Prediction", `Failure risk 72–89% across ${critical.length} critical blades.`);
  setStatus("Failure Prediction", "Completed");

  // 3. Troubleshooting
  setStatus("Troubleshooting", "Analyzing");
  const plan = buildPlan(minutesAgo);
  const trbReason = await reason(
    "Troubleshooting",
    `Proposed actions: ${plan.actions.filter((a) => a.category !== "monitor").map((a) => `${a.bladeId}: ${a.action} (${a.reason})`).join("; ")}. Explain why replace/investigate/monitor was chosen per severity.`,
    `Blades with confirmed hardware faults and risk above 70% are marked for replacement. Blades with rising but unconfirmed errors get a hardware investigation first, so parts are not wasted. Cooling-drift blades only need monitoring because they recover once the loop stabilizes.`,
  );
  findings.push({
    agent: "Troubleshooting", issueId: "ISS-COOLING-BRAVO", rack: "Multiple",
    observations: [`${plan.actions.filter((a) => a.category === "critical").length} replacements`, `${plan.actions.filter((a) => a.category === "recommended").length} investigations`, `${plan.actions.filter((a) => a.category === "monitor").length} monitor-only`],
    severity: "high", confidence: 0.88, telemetry: plan.actions.slice(0, 3).flatMap((a) => a.telemetry),
    actions: ["Generate proposed action plan", "Require human approval before any change"],
    consequences: "Plan ready for employee review; nothing executes automatically.",
    reasoning: trbReason.text, reasoningSource: trbReason.source, approvalsRequired: true, at: now(),
  });
  emit("Troubleshooting", `Drafted ${plan.actions.length} proposed actions for review.`);
  setStatus("Troubleshooting", "Completed");

  // 4. Simulation & Evaluation
  setStatus("Simulation & Evaluation", "Simulating");
  const simReason = await reason(
    "Simulation & Evaluation",
    `Internally evaluated outcomes: ${plan.scenarios.map(s => `${s.name}: projected health ${s.healthAfter}/100, peak risk ${Math.round(s.failureProb*100)}%, cost $${s.costUsd}`).join("; ")}. Present ONE strongest plan: restore cooling, replace confirmed faults, investigate uncertain faults. Explain why it beats no action, resource availability and operational risks. All outcomes are illustrative simulations; never claim actual recovery.`,
    `Recommend cooling restoration and targeted replacements using staged kits, with investigation of uncertain faults. Projected +48h affected-server health ${plan.scenarios[0]?.healthAfter}/100 versus ${plan.scenarios[2]?.healthAfter}/100 without intervention. Drain workloads first; investigations do not guarantee recovery. These are simulated estimates.`,
  );
  plan.recommendation = simReason.text;
  findings.push({
    agent: "Simulation & Evaluation", issueId: "ISS-COOLING-BRAVO", rack: "Multiple",
    observations: plan.scenarios.map((s) => `${s.id}: health ${s.healthAfter}%, failure ${(s.failureProb * 100).toFixed(0)}%, risk ${s.risk}`),
    severity: "medium", confidence: 0.75, telemetry: ["Simulated ground truth", "Deterministic outcome model"],
    actions: ["Recommend cooling restoration and targeted hardware remediation"], consequences: "Projected outcomes improve; SLA protection requires verified execution.",
    reasoning: simReason.text, reasoningSource: simReason.source, approvalsRequired: false, at: now(),
  });
  emit("Simulation & Evaluation", "Evaluated alternatives internally; one primary intervention plan recommended.");
  setStatus("Simulation & Evaluation", "Completed");

  // 5. Business Impact
  setStatus("Business Impact", "Evaluating");
  const expo = CUSTOMERS.filter((c) => c.costPerHour > 0);
  const bizReason = await reason(
    "Business Impact",
    `Lease exposure: ${expo.map((c) => `${c.name} $${c.costPerHour.toLocaleString("en-US")}/hr (${c.rule})`).join("; ")}. Bravo breach in 18 min. Explain the business stakes.`,
    `The Bravo incident maps directly to the Hyperscale Cloud Tenant #2 lease: $80,712 per hour once coolant stays above 42°C for 15 minutes, with a termination right. Charlie's power distortion puts a further $28,500 per hour of credits at risk. Figures are configured lease terms, not AI estimates.`,
  );
  findings.push({
    agent: "Business Impact", issueId: "ISS-COOLING-BRAVO", rack: "Bravo / Charlie",
    observations: expo.map((c) => `${c.name}: $${c.costPerHour.toLocaleString("en-US")}/hr exposure`),
    severity: "critical", confidence: 0.9, telemetry: ["LEASE-HYP-02 covenant", "LEASE-FIN-03 covenant"],
    actions: ["Act before the 18-minute breach window"], consequences: "Up to $80,712/hr penalty plus termination risk.",
    reasoning: bizReason.text, reasoningSource: bizReason.source, approvalsRequired: false, at: now(),
  });
  emit("Business Impact", "Estimated $80,712/hr SLA exposure on LEASE-HYP-02.");
  setStatus("Business Impact", "Completed");

  // 6. Resource Optimization
  setStatus("Resource Optimization", "Evaluating");
  const hot = [...RACKS].sort((a, b) => a.health - b.health).at(0);
  const optReason = await reason(
    "Resource Optimization",
    `Utilization: Bravo racks at 78.1 kW average load, Dallas site at 93.3% capacity with 3.2 MW spare. Hillsboro has 18 MW ready at 96% fit. Explain safe redistribution options.`,
    `Bravo is the hottest cluster while Dallas overall sits at 93.3% of capacity with only 3.2 MW of headroom. Draining 48 GPU jobs from racks 09–16 before blade work keeps replacement safe, and the Hillsboro site (18 MW ready, 96% fit) is the lowest-risk destination for the overflow.`,
  );
  findings.push({
    agent: "Resource Optimization", issueId: "ISS-COOLING-BRAVO", rack: `R-${pad(hot?.n ?? 1)}`,
    observations: ["Dallas at 93.3% capacity, 3.2 MW spare", "Hillsboro 18 MW ready, 96% fit", "48 GPU jobs movable off Bravo"],
    severity: "medium", confidence: 0.8, telemetry: ["Capacity record", "Scheduler job log"],
    actions: ["Drain 48 jobs before blade work", "Evaluate 18 MW move to Hillsboro"],
    consequences: "Redistribution reduces thermal load without new hardware risk.",
    reasoning: optReason.text, reasoningSource: optReason.source, approvalsRequired: true, at: now(),
  });
  emit("Resource Optimization", "Recommended draining 48 jobs; flagged Hillsboro capacity.");
  setStatus("Resource Optimization", "Completed");

  AGENTS.forEach((a) => setStatus(a.name, "Awaiting approval"));
  emit("Troubleshooting", "Final recommendation generated. Awaiting employee approval.");
  return { plan, findings };
}
