import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { scorePlan } from "../score";
import { buildPlan } from "../assign";
import { DatasetSchema, Job, Plan, TimelineEntry } from "../types";

describe("scorePlan - controlled fixture", () => {
  it("counts assigned entries, sums travel, and counts unassigned", () => {
    const jobA: Job = { id: "jobA", area: "A", skill: "plumbing", duration_minutes: 30, window_start: "09:00", window_end: "10:00" };
    const jobB: Job = { id: "jobB", area: "A", skill: "plumbing", duration_minutes: 30, window_start: "10:30", window_end: "11:30" };
    const entryA: TimelineEntry = { job: jobA, arrival: 540, start: 540, end: 570, travelFromPrev: 0 };
    const entryB: TimelineEntry = { job: jobB, arrival: 570, start: 630, end: 660, travelFromPrev: 15 };

    const plan: Plan = {
      routes: { t1: [entryA], t2: [entryB] },
      unassigned: [{ jobId: "jobC", reason: "OUTSIDE_SHIFT", detail: "x" }],
    };

    expect(scorePlan(plan)).toEqual({ assignedCount: 2, totalTravelMinutes: 15, unassignedCount: 1 });
  });

  it("handles an empty plan", () => {
    expect(scorePlan({ routes: {}, unassigned: [] })).toEqual({
      assignedCount: 0,
      totalTravelMinutes: 0,
      unassignedCount: 0,
    });
  });
});

describe("scorePlan - real dataset", () => {
  const datasetPath = path.join(__dirname, "../../../public/data/P11_route_shift_public.json");
  const raw = JSON.parse(fs.readFileSync(datasetPath, "utf-8"));
  const dataset = DatasetSchema.parse(raw);

  it.each(dataset.cases.map((c) => [c.case_id, c] as const))(
    "case %s: assigned + unassigned accounts for every job, travel is non-negative",
    (_caseId, kase) => {
      const plan = buildPlan(kase);
      const score = scorePlan(plan);
      expect(score.assignedCount + score.unassignedCount).toBe(kase.jobs.length);
      expect(score.totalTravelMinutes).toBeGreaterThanOrEqual(0);
    }
  );
});
