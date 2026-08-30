import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { applyManualMove } from "../manualMove";
import { buildPlan } from "../assign";
import { Case, DatasetSchema, Plan, Technician, TimelineEntry } from "../types";
import { minutesToHhmm } from "../time";
import { TravelMatrix } from "../travel";

const FIXTURE_TRAVEL: TravelMatrix = {
  A: { A: 0, B: 10, C: 20 },
  B: { A: 10, B: 0, C: 15 },
  C: { A: 20, B: 15, C: 0 },
};

const techA: Technician = {
  id: "techA",
  name: "Tech A",
  skills: ["plumbing"],
  shift_start: "09:00",
  shift_end: "17:00",
  home_area: "A",
};

const techB: Technician = {
  id: "techB",
  name: "Tech B",
  skills: ["plumbing", "electrical"],
  shift_start: "09:00",
  shift_end: "17:00",
  home_area: "B",
};

const job1 = {
  id: "job1",
  area: "A",
  skill: "plumbing",
  duration_minutes: 30,
  window_start: "09:00",
  window_end: "10:00",
};
const job2 = {
  id: "job2",
  area: "A",
  skill: "plumbing",
  duration_minutes: 30,
  window_start: "09:30",
  window_end: "10:30",
};
const job3 = {
  id: "job3",
  area: "B",
  skill: "electrical",
  duration_minutes: 20,
  window_start: "09:00",
  window_end: "17:00",
};

const kase: Case = {
  case_id: "fixture",
  today: "2026-01-01",
  areas: ["A", "B", "C"],
  travel_minutes: FIXTURE_TRAVEL,
  technicians: [techA, techB],
  jobs: [job1, job2, job3],
  manual_move: { job_id: "job1", to_technician: "techB" },
};

describe("applyManualMove - controlled fixtures", () => {
  it("moves a job between technicians and recomputes both the source and target routes", () => {
    const plan = buildPlan(kase);
    // Sanity-check the starting state this test depends on.
    expect(plan.routes.techA.map((e) => e.job.id)).toEqual(["job1", "job2"]);
    expect(plan.routes.techB.map((e) => e.job.id)).toEqual(["job3"]);

    const result = applyManualMove(plan, "job1", "techB", kase);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.newPlan.routes.techA).toEqual([
      { job: job2, arrival: 540, start: 570, end: 600, travelFromPrev: 0 },
    ]);
    expect(result.newPlan.routes.techB).toEqual([
      { job: job3, arrival: 540, start: 540, end: 560, travelFromPrev: 0 },
      { job: job1, arrival: 570, start: 570, end: 600, travelFromPrev: 10 },
    ]);
    expect(result.newPlan.unassigned).toEqual([]);
  });

  it("rejects a move to a technician without the required skill and leaves the plan untouched", () => {
    const plan = buildPlan(kase);
    const before = structuredClone(plan);

    const result = applyManualMove(plan, "job3", "techA", kase);
    expect(result).toEqual({ ok: false, reason: "SKILL_MISMATCH" });
    expect(plan).toEqual(before);
  });

  it("places a currently-unassigned job onto a technician's route", () => {
    const job1Entry: TimelineEntry = { job: job1, arrival: 540, start: 540, end: 570, travelFromPrev: 0 };
    const plan: Plan = {
      routes: { techA: [job1Entry], techB: [] },
      unassigned: [{ jobId: "job2", reason: "OUTSIDE_SHIFT", detail: "test detail" }],
    };

    const result = applyManualMove(plan, "job2", "techB", kase);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.newPlan.routes.techA).toEqual([job1Entry]);
    expect(result.newPlan.routes.techB).toEqual([
      { job: job2, arrival: 550, start: 570, end: 600, travelFromPrev: 10 },
    ]);
    expect(result.newPlan.unassigned).toEqual([]);
  });

  it("throws on an unknown job id", () => {
    const plan = buildPlan(kase);
    expect(() => applyManualMove(plan, "does-not-exist", "techB", kase)).toThrow();
  });

  it("throws on an unknown technician id", () => {
    const plan = buildPlan(kase);
    expect(() => applyManualMove(plan, "job1", "does-not-exist", kase)).toThrow();
  });
});

describe("applyManualMove - scripted manual_move (real dataset)", () => {
  const datasetPath = path.join(__dirname, "../../../public/data/P11_route_shift_public.json");
  const raw = JSON.parse(fs.readFileSync(datasetPath, "utf-8"));
  const dataset = DatasetSchema.parse(raw);

  function findEntry(plan: Plan, jobId: string): TimelineEntry | null {
    for (const route of Object.values(plan.routes)) {
      const found = route.find((e) => e.job.id === jobId);
      if (found) return found;
    }
    return null;
  }

  it.each(dataset.cases.map((c) => [c.case_id, c] as const))(
    "case %s: the scripted manual_move outcome is pinned",
    (_caseId, realCase) => {
      const plan = buildPlan(realCase);
      const result = applyManualMove(plan, realCase.manual_move.job_id, realCase.manual_move.to_technician, realCase);

      const summary = result.ok
        ? {
            outcome: "accepted" as const,
            scheduled: (() => {
              const entry = findEntry(result.newPlan, realCase.manual_move.job_id)!;
              return `${minutesToHhmm(entry.start)}-${minutesToHhmm(entry.end)}`;
            })(),
          }
        : { outcome: "rejected" as const, reason: result.reason };

      expect(summary).toMatchSnapshot();
    }
  );
});
