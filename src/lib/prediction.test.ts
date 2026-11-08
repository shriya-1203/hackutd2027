import { describe, expect, it } from "vitest";
import { bladeAt, BLADES_PER_RACK, CHASSIS_PER_RACK, bladesAt, rackStats, summarizeBlades } from "./infra-data";
import { observedBlades, projectBlades, simulate, type PredictionAction } from "./prediction";

const actions: PredictionAction[] = [
  { id: "replace", bladeId: "R-11-B04", rackId: "R-11", action: "Replace blade" },
  { id: "replace2", bladeId: "R-12-B02", rackId: "R-12", action: "Replace blade" },
  { id: "investigate", bladeId: "R-09-B06", rackId: "R-09", action: "Schedule hardware investigation" },
  { id: "cooling", bladeId: "CRAH-02", rackId: "R-11", action: "Restore cooling loop" },
];
describe("Connected operational rules", () => {
  it("counts eight distinct blades in one simulated enclosure per rack", () => {
    expect(BLADES_PER_RACK).toBe(8); expect(CHASSIS_PER_RACK).toBe(1);
    expect(bladesAt()).toHaveLength(32 * 8);
    expect(new Set(bladesAt().map(b => b.id)).size).toBe(256);
    expect(rackStats(11).total).toBe(8);
  });
  it("rack power equals the sum of its blades, not their average", () => {
    const s = rackStats(11); expect(s.power).toBe(Math.round(s.blades.reduce((sum,b) => sum+b.power,0)*10)/10);
  });
  it("preserves the configured 89% risk for the highest-priority fault", () => expect(bladeAt(11,4).failureRisk).toBe(0.89));
  it("approval improves predicted health and rejection restores no-intervention trajectory", () => {
    const baseline = simulate(actions, {});
    const approved = simulate(actions, {replace:"approved"});
    expect(approved.future).toBeGreaterThan(baseline.future);
    expect(simulate(actions, {replace:"rejected"}).future).toBe(baseline.future);
  });
  it("combines multiple independent decisions", () => {
    const one = simulate(actions, {replace:"approved",replace2:"rejected"});
    const two = simulate(actions, {replace:"approved",replace2:"approved"});
    expect(two.future).toBeGreaterThan(one.future); expect(one.rejected).toBe(1);
  });
  it("approvals never mutate actual observed health", () => {
    expect(simulate(actions, {replace:"approved"}).current).toBe(simulate(actions,{}).current);
    expect(observedBlades(actions,[]).find(b => b.id === "R-11-B04")?.health).toBe("red");
  });
  it("only executed replacements recover and rejected blades remain critical", () => {
    const b = observedBlades(actions,["replace"]);
    expect(b.find(b => b.id === "R-11-B04")?.health).toBe("green");
    expect(b.find(b => b.id === "R-12-B02")?.health).toBe("red");
  });
  it("investigation is not treated as completed hardware repair", () => expect(observedBlades(actions,["investigate"]).find(b => b.id === "R-09-B06")?.health).toBe("orange"));
  it("execution leaves historical observations unchanged", () => expect(observedBlades(actions,["replace"],60)).toEqual(bladesAt(60)));
  it("supports +48h and derives nonlinear forecasts from telemetry", () => {
    expect(projectBlades(48,actions,{}).find(b => b.id === "R-11-B04")?.failureRisk).toBeGreaterThan(0.89);
    expect(simulate(actions,{}).points.at(-1)?.hour).toBe(48);
    expect(() => projectBlades(49,actions,{})).toThrow();
  });
  it("executed cooling restoration does not repair confirmed faults", () => {
    const b = observedBlades(actions,["cooling"]);
    expect(b.find(b => b.id === "R-10-B01")?.health).toBe("green");
    expect(b.find(b => b.id === "R-11-B04")?.health).toBe("red");
    expect(summarizeBlades(b).critical).toBe(6);
  });
});