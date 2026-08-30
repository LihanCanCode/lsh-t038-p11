import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { injectEmergencyJob } from "../emergency";
import { buildPlan } from "../assign";
import { Case, DatasetSchema, Job, Plan, Technician, TimelineEntry } from "../types";
import { hhmmToMinutes } from "../time";

const travel = { A: { A: 0, B: 10 }, B: { A: 10, B: 0 } };

const t1: Technician = { id: "t1", name: "T1", skills: ["plumbing"], shift_start: "09:00", shift_end: "17:00", home_area: "A" };
const t2: Technician = { id: "t2", name: "T2", skills: ["plumbing"], shift_start: "09:00", shift_end: "17:00", home_area: "B" };

const jobA: Job = { id: "jobA", area: "A", skill: "plumbing", duration_minutes: 30, window_start: "09:00", window_end: "10:00" };
const jobB: Job = { id: "jobB", area: "A", skill: "plumbing", duration_minutes: 30, window_start: "10:30", window_end: "11:30" };
const jobC: Job = { id: "jobC", area: "B", skill: "plumbing", duration_minutes: 20, window_start: "09:00", window_end: "17:00" };

const kase: Case = {
  case_id: "fixture",
  today: "2026-01-01",
  areas: ["A", "B"],
  travel_minutes: travel,
  technicians: [t1, t2],
  jobs: [jobA, jobB, jobC],
  manual_move: { job_id: "jobA", to_technician: "t2" },
};

describe("injectEmergencyJob - controlled fixture", () => {
  it("keeps started entries fixed and re-optimizes everything else, including the new job", () => {
    const jobAEntry: TimelineEntry = { job: jobA, arrival: 540, start: 540, end: 570, travelFromPrev: 0 };
    const jobBEntry: TimelineEntry = { job: jobB, arrival: 570, start: 630, end: 660, travelFromPrev: 0 };
    const plan: Plan = {
      routes: { t1: [jobAEntry, jobBEntry], t2: [] },
      unassigned: [{ jobId: "jobC", reason: "OUTSIDE_SHIFT", detail: "seeded as already unassigned" }],
    };

    const newJob: Job = { id: "EMG-1", area: "B", skill: "plumbing", duration_minutes: 15, window_start: "09:30", window_end: "17:00" };

    const result = injectEmergencyJob(plan, hhmmToMinutes("10:00"), newJob, kase);

    // jobA already started (10:00 cursor > its 09:00 start) — must be untouched, byte-identical.
    expect(result.routes.t1[0]).toEqual(jobAEntry);
    expect(result.routes.t1[0]).toBe(jobAEntry);

    // jobB hadn't started yet — re-inserted, still on t1, recomputed but same effective slot here.
    expect(result.routes.t1[1]).toEqual({ job: jobB, arrival: 570, start: 630, end: 660, travelFromPrev: 0 });
    expect(result.routes.t1).toHaveLength(2);

    // jobC (previously unassigned) and the new emergency job both land on t2.
    expect(result.routes.t2).toEqual([
      { job: jobC, arrival: 540, start: 540, end: 560, travelFromPrev: 0 },
      { job: newJob, arrival: 560, start: 570, end: 585, travelFromPrev: 0 },
    ]);

    expect(result.unassigned).toEqual([]);
  });

  it("never inserts a re-planned job before a technician's locked prefix", () => {
    const jobAEntry: TimelineEntry = { job: jobA, arrival: 540, start: 540, end: 570, travelFromPrev: 0 };
    const plan: Plan = { routes: { t1: [jobAEntry], t2: [] }, unassigned: [] };
    const newJob: Job = { id: "EMG-2", area: "A", skill: "plumbing", duration_minutes: 15, window_start: "09:00", window_end: "17:00" };

    const result = injectEmergencyJob(plan, hhmmToMinutes("09:15"), newJob, kase);

    expect(result.routes.t1[0]).toBe(jobAEntry);
    expect(result.routes.t1.some((e) => e.job.id === "EMG-2")).toBe(
      result.routes.t1.findIndex((e) => e.job.id === "EMG-2") !== 0
    );
    // If t1 took the new job at all, it must not be at index 0 (before the locked entry).
    const idx = result.routes.t1.findIndex((e) => e.job.id === "EMG-2");
    if (idx !== -1) expect(idx).toBeGreaterThan(0);
  });

  it("puts an unplaceable new job into unassigned without disturbing existing entries", () => {
    const jobAEntry: TimelineEntry = { job: jobA, arrival: 540, start: 540, end: 570, travelFromPrev: 0 };
    const plan: Plan = { routes: { t1: [jobAEntry], t2: [] }, unassigned: [] };
    const newJob: Job = { id: "EMG-3", area: "A", skill: "electrical", duration_minutes: 15, window_start: "09:00", window_end: "17:00" };

    const result = injectEmergencyJob(plan, hhmmToMinutes("09:15"), newJob, kase);

    expect(result.routes.t1).toEqual([jobAEntry]);
    expect(result.unassigned).toEqual([
      { jobId: "EMG-3", reason: "NO_MATCHING_TECHNICIAN", detail: expect.stringContaining("electrical") },
    ]);
  });
});

describe("injectEmergencyJob - real dataset invariants", () => {
  const datasetPath = path.join(__dirname, "../../../public/data/P11_route_shift_public.json");
  const raw = JSON.parse(fs.readFileSync(datasetPath, "utf-8"));
  const dataset = DatasetSchema.parse(raw);

  it.each(dataset.cases.map((c) => [c.case_id, c] as const))(
    "case %s: locked entries are untouched and every pooled job is accounted for exactly once",
    (_caseId, realCase) => {
      const initialPlan = buildPlan(realCase);
      const cursor = hhmmToMinutes("13:00");

      const lockedByTech = new Map<string, TimelineEntry[]>();
      const expectedJobIds = new Set<string>();
      for (const tech of realCase.technicians) {
        const route = initialPlan.routes[tech.id] ?? [];
        const locked = route.filter((e) => e.start <= cursor);
        lockedByTech.set(tech.id, locked);
        route.forEach((e) => expectedJobIds.add(e.job.id));
      }
      initialPlan.unassigned.forEach((u) => expectedJobIds.add(u.jobId));

      const newJob: Job = {
        id: "EMG-TEST",
        area: realCase.areas[0],
        skill: realCase.jobs[0]?.skill ?? "plumbing",
        duration_minutes: 20,
        window_start: "00:00",
        window_end: "23:59",
      };
      expectedJobIds.add(newJob.id);

      const result = injectEmergencyJob(initialPlan, cursor, newJob, realCase);

      for (const tech of realCase.technicians) {
        const locked = lockedByTech.get(tech.id)!;
        const resultRoute = result.routes[tech.id];
        expect(resultRoute.slice(0, locked.length)).toEqual(locked);
      }

      const resultJobIds = new Set<string>();
      for (const route of Object.values(result.routes)) {
        for (const entry of route) resultJobIds.add(entry.job.id);
      }
      result.unassigned.forEach((u) => resultJobIds.add(u.jobId));

      expect(resultJobIds).toEqual(expectedJobIds);
    }
  );
});
