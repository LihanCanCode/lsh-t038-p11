import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { removeSickTechnician } from "../sickTechnician";
import { buildPlan } from "../assign";
import { Case, DatasetSchema, Job, Plan, Technician, TimelineEntry } from "../types";
import { hhmmToMinutes } from "../time";

const travel = { A: { A: 0, B: 10 }, B: { A: 10, B: 0 } };

const t1: Technician = { id: "t1", name: "T1", skills: ["plumbing"], shift_start: "09:00", shift_end: "17:00", home_area: "A" };
const t2: Technician = { id: "t2", name: "T2", skills: ["plumbing"], shift_start: "09:00", shift_end: "17:00", home_area: "A" };
const t3: Technician = { id: "t3", name: "T3", skills: ["plumbing"], shift_start: "09:00", shift_end: "17:00", home_area: "B" };

const jobA: Job = { id: "jobA", area: "A", skill: "plumbing", duration_minutes: 30, window_start: "09:00", window_end: "10:00" };
const jobB: Job = { id: "jobB", area: "A", skill: "plumbing", duration_minutes: 30, window_start: "10:30", window_end: "11:30" };

const kase: Case = {
  case_id: "fixture",
  today: "2026-01-01",
  areas: ["A", "B"],
  travel_minutes: travel,
  technicians: [t1, t2, t3],
  jobs: [jobA, jobB],
  manual_move: { job_id: "jobA", to_technician: "t2" },
};

describe("removeSickTechnician - controlled fixture", () => {
  it("keeps the sick technician's completed work, reassigns their future job, leaves other empty routes as-is", () => {
    const jobAEntry: TimelineEntry = { job: jobA, arrival: 540, start: 540, end: 570, travelFromPrev: 0 };
    const jobBEntry: TimelineEntry = { job: jobB, arrival: 570, start: 630, end: 660, travelFromPrev: 0 };
    const plan: Plan = { routes: { t1: [jobAEntry, jobBEntry], t2: [], t3: [] }, unassigned: [] };

    const result = removeSickTechnician(plan, "t1", hhmmToMinutes("10:00"), kase);

    // t1's completed job is untouched, frozen under their own id.
    expect(result.routes.t1).toEqual([jobAEntry]);
    expect(result.routes.t1[0]).toBe(jobAEntry);

    // jobB (not yet started) moves to t2 — home area A means zero added
    // travel, beating t3 (home B, 10min travel).
    expect(result.routes.t2).toEqual([{ job: jobB, arrival: 540, start: 630, end: 660, travelFromPrev: 0 }]);
    expect(result.routes.t3).toEqual([]);
    expect(result.unassigned).toEqual([]);
  });

  it("never inserts a reassigned job before a remaining technician's own locked entry", () => {
    const jobAEntry: TimelineEntry = { job: jobA, arrival: 540, start: 540, end: 570, travelFromPrev: 0 };
    // t2 already has a locked job identical in shape to jobA's slot.
    const t2LockedJob: Job = { ...jobA, id: "t2-locked" };
    const t2LockedEntry: TimelineEntry = { job: t2LockedJob, arrival: 540, start: 540, end: 570, travelFromPrev: 0 };
    const sickFutureJob: Job = { id: "sick-future", area: "A", skill: "plumbing", duration_minutes: 30, window_start: "09:00", window_end: "17:00" };
    const sickFutureEntry: TimelineEntry = { job: sickFutureJob, arrival: 600, start: 600, end: 630, travelFromPrev: 0 };

    const plan: Plan = {
      routes: { t1: [jobAEntry, sickFutureEntry], t2: [t2LockedEntry], t3: [] },
      unassigned: [],
    };

    const result = removeSickTechnician(plan, "t1", hhmmToMinutes("10:00"), kase);

    expect(result.routes.t2[0]).toBe(t2LockedEntry);
    const idx = result.routes.t2.findIndex((e) => e.job.id === "sick-future");
    if (idx !== -1) expect(idx).toBeGreaterThan(0);
  });

  it("reports a reassigned job as unassigned if no remaining technician can take it", () => {
    const jobAEntry: TimelineEntry = { job: jobA, arrival: 540, start: 540, end: 570, travelFromPrev: 0 };
    const onlyPlumberFuture: Job = { id: "elec-future", area: "A", skill: "electrical", duration_minutes: 30, window_start: "09:00", window_end: "17:00" };
    const futureEntry: TimelineEntry = { job: onlyPlumberFuture, arrival: 630, start: 630, end: 660, travelFromPrev: 0 };
    // Only t1 (going sick) can do electrical in this variant of the roster.
    const sickOnlyElectrical: Technician = { ...t1, skills: ["electrical"] };
    const localCase: Case = { ...kase, technicians: [sickOnlyElectrical, t2, t3], jobs: [jobA, onlyPlumberFuture] };
    const plan: Plan = { routes: { t1: [jobAEntry, futureEntry], t2: [], t3: [] }, unassigned: [] };

    const result = removeSickTechnician(plan, "t1", hhmmToMinutes("10:00"), localCase);

    expect(result.routes.t1).toEqual([jobAEntry]);
    expect(result.unassigned).toEqual([
      { jobId: "elec-future", reason: "NO_MATCHING_TECHNICIAN", detail: expect.stringContaining("electrical") },
    ]);
  });
});

describe("removeSickTechnician - real dataset invariants", () => {
  const datasetPath = path.join(__dirname, "../../../public/data/P11_route_shift_public.json");
  const raw = JSON.parse(fs.readFileSync(datasetPath, "utf-8"));
  const dataset = DatasetSchema.parse(raw);

  it.each(dataset.cases.map((c) => [c.case_id, c] as const))(
    "case %s: everyone's locked history is untouched and every job is accounted for exactly once",
    (_caseId, realCase) => {
      const initialPlan = buildPlan(realCase);
      const cursor = hhmmToMinutes("13:00");
      const sickTechId = realCase.technicians[0]?.id;
      if (!sickTechId) return;

      const lockedByTech = new Map<string, TimelineEntry[]>();
      const expectedJobIds = new Set<string>();
      for (const tech of realCase.technicians) {
        const route = initialPlan.routes[tech.id] ?? [];
        lockedByTech.set(
          tech.id,
          route.filter((e) => e.start <= cursor)
        );
        route.forEach((e) => expectedJobIds.add(e.job.id));
      }
      initialPlan.unassigned.forEach((u) => expectedJobIds.add(u.jobId));

      const result = removeSickTechnician(initialPlan, sickTechId, cursor, realCase);

      for (const tech of realCase.technicians) {
        const locked = lockedByTech.get(tech.id)!;
        expect(result.routes[tech.id].slice(0, locked.length)).toEqual(locked);
      }

      // The sick technician must never receive anything beyond their own locked prefix.
      expect(result.routes[sickTechId]).toEqual(lockedByTech.get(sickTechId));

      const resultJobIds = new Set<string>();
      for (const route of Object.values(result.routes)) {
        for (const entry of route) resultJobIds.add(entry.job.id);
      }
      result.unassigned.forEach((u) => resultJobIds.add(u.jobId));

      expect(resultJobIds).toEqual(expectedJobIds);
    }
  );
});
