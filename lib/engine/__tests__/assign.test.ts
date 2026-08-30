import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { buildPlan } from "../assign";
import { DatasetSchema } from "../types";
import { hhmmToMinutes } from "../time";
import { getTravel } from "../travel";

const datasetPath = path.join(__dirname, "../../../public/data/P11_route_shift_public.json");
const raw = JSON.parse(fs.readFileSync(datasetPath, "utf-8"));
const dataset = DatasetSchema.parse(raw);

describe("buildPlan - real dataset invariants", () => {
  it.each(dataset.cases.map((c) => [c.case_id, c] as const))(
    "case %s: every job is accounted for exactly once and routes are internally consistent",
    (_caseId, kase) => {
      const plan = buildPlan(kase);
      const assignedJobIds = new Set<string>();

      for (const [techId, entries] of Object.entries(plan.routes)) {
        const tech = kase.technicians.find((t) => t.id === techId)!;
        let prevEnd = hhmmToMinutes(tech.shift_start);
        let prevArea = tech.home_area;

        for (const entry of entries) {
          expect(assignedJobIds.has(entry.job.id)).toBe(false);
          assignedJobIds.add(entry.job.id);

          expect(tech.skills).toContain(entry.job.skill);
          expect(entry.start).toBeGreaterThanOrEqual(hhmmToMinutes(entry.job.window_start));
          expect(entry.end).toBeLessThanOrEqual(hhmmToMinutes(entry.job.window_end));
          expect(entry.end).toBeLessThanOrEqual(hhmmToMinutes(tech.shift_end));
          expect(entry.end - entry.start).toBe(entry.job.duration_minutes);

          const travel = getTravel(kase.travel_minutes, prevArea, entry.job.area);
          expect(entry.arrival).toBe(prevEnd + travel);
          expect(entry.start).toBeGreaterThanOrEqual(entry.arrival);

          prevEnd = entry.end;
          prevArea = entry.job.area;
        }
      }

      const unassignedJobIds = new Set(plan.unassigned.map((u) => u.jobId));
      for (const id of unassignedJobIds) {
        expect(assignedJobIds.has(id)).toBe(false);
      }
      expect(assignedJobIds.size + unassignedJobIds.size).toBe(kase.jobs.length);

      for (const entry of plan.unassigned) {
        expect(entry.detail.length).toBeGreaterThan(0);
      }
    }
  );

  it("assigns most jobs overall and surfaces reasoned failures where jobs are dropped", () => {
    let totalJobs = 0;
    let totalAssigned = 0;
    let casesWithUnassigned = 0;

    for (const kase of dataset.cases) {
      const plan = buildPlan(kase);
      totalJobs += kase.jobs.length;
      totalAssigned += Object.values(plan.routes).reduce((sum, route) => sum + route.length, 0);
      if (plan.unassigned.length > 0) casesWithUnassigned++;
    }

    expect(totalAssigned).toBeGreaterThan(totalJobs / 2);
    expect(casesWithUnassigned).toBeGreaterThan(0);
  });
});
