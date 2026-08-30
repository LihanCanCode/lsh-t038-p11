import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { canInsert, shiftBoundsFor } from "../feasibility";
import { DatasetSchema, Job, Technician, TimelineEntry } from "../types";
import { TravelMatrix } from "../travel";
import { hhmmToMinutes } from "../time";

// A tiny hand-built fixture (areas A/B/C) lets us pin down exact reason codes
// for each branch of canInsert without depending on the specifics of the
// bundled dataset.
const FIXTURE_TRAVEL: TravelMatrix = {
  A: { A: 0, B: 10, C: 20 },
  B: { A: 10, B: 0, C: 15 },
  C: { A: 20, B: 15, C: 0 },
};

function makeTech(overrides: Partial<Technician> = {}): Technician {
  return {
    id: "t1",
    name: "Tech One",
    skills: ["plumbing"],
    shift_start: "09:00",
    shift_end: "17:00",
    home_area: "A",
    ...overrides,
  };
}

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "j1",
    area: "A",
    skill: "plumbing",
    duration_minutes: 30,
    window_start: "09:00",
    window_end: "10:00",
    ...overrides,
  };
}

describe("canInsert - controlled fixtures", () => {
  it("rejects when the technician lacks the required skill", () => {
    const tech = makeTech({ skills: ["electrical"] });
    const job = makeJob({ skill: "plumbing" });
    const result = canInsert(job, tech, [], FIXTURE_TRAVEL, shiftBoundsFor(tech));
    expect(result).toEqual({ ok: false, reason: "SKILL_MISMATCH" });
  });

  it("inserts into an empty route at the technician's earliest availability", () => {
    const tech = makeTech();
    const job = makeJob({ area: "A", window_start: "09:00", window_end: "10:00" });
    const result = canInsert(job, tech, [], FIXTURE_TRAVEL, shiftBoundsFor(tech));
    expect(result).toEqual({
      ok: true,
      insertIndex: 0,
      arrival: 540,
      start: 540,
      end: 570,
      addedTravelMinutes: 0,
    });
  });

  it("rejects a job that cannot be reached before its window closes", () => {
    const tech = makeTech();
    // Travel A->C is 20min; arriving at 09:20 is already past a 09:15 window close.
    const job = makeJob({ area: "C", window_start: "09:00", window_end: "09:15" });
    const result = canInsert(job, tech, [], FIXTURE_TRAVEL, shiftBoundsFor(tech));
    expect(result).toEqual({ ok: false, reason: "WINDOW_UNREACHABLE" });
  });

  it("rejects a job that would finish after the technician's shift ends", () => {
    const tech = makeTech();
    const job = makeJob({
      area: "A",
      duration_minutes: 600,
      window_start: "09:00",
      window_end: "19:00",
    });
    const result = canInsert(job, tech, [], FIXTURE_TRAVEL, shiftBoundsFor(tech));
    expect(result).toEqual({ ok: false, reason: "OUTSIDE_SHIFT" });
  });

  it("finds a later slot instead of bumping an already-placed job out of its window", () => {
    const tech = makeTech();
    const placed: Job = makeJob({
      id: "job2",
      area: "A",
      window_start: "09:20",
      window_end: "10:00",
      duration_minutes: 20,
    });
    const route: TimelineEntry[] = [
      { job: placed, arrival: 580, start: 580, end: 600, travelFromPrev: 0 },
    ];
    const candidate = makeJob({
      id: "job3",
      area: "A",
      duration_minutes: 50,
      window_start: "09:00",
      window_end: "19:00",
    });
    const result = canInsert(candidate, tech, route, FIXTURE_TRAVEL, shiftBoundsFor(tech));
    // Index 0 would push job2's start to 590 -> end 610, past its 10:00 window: rejected.
    // Index 1 (after job2) starts at 600, ends 650, still inside the 09:00-17:00 shift.
    expect(result).toEqual({
      ok: true,
      insertIndex: 1,
      arrival: 600,
      start: 600,
      end: 650,
      addedTravelMinutes: 0,
    });
  });

  it("reports BUMPS_LATER_JOB when every position conflicts with a placed job or the shift end", () => {
    const tech = makeTech({ shift_start: "09:00", shift_end: "11:00" });
    const placed: Job = makeJob({
      id: "job2",
      area: "A",
      window_start: "09:20",
      window_end: "10:20",
      duration_minutes: 20,
    });
    const route: TimelineEntry[] = [
      { job: placed, arrival: 590, start: 590, end: 610, travelFromPrev: 0 },
    ];
    const candidate = makeJob({
      id: "job3",
      area: "A",
      duration_minutes: 70,
      window_start: "09:00",
      window_end: "19:00",
    });
    const result = canInsert(candidate, tech, route, FIXTURE_TRAVEL, shiftBoundsFor(tech));
    expect(result).toEqual({ ok: false, reason: "BUMPS_LATER_JOB" });
  });
});

describe("canInsert - real dataset smoke checks", () => {
  const datasetPath = path.join(__dirname, "../../../public/data/P11_route_shift_public.json");
  const raw = JSON.parse(fs.readFileSync(datasetPath, "utf-8"));
  const dataset = DatasetSchema.parse(raw);
  const sampleCases = dataset.cases.slice(0, 3);

  it.each(sampleCases.map((c) => [c.case_id, c] as const))(
    "case %s: skill-mismatched pairs are always rejected",
    (_caseId, kase) => {
      let checked = 0;
      for (const tech of kase.technicians) {
        for (const job of kase.jobs) {
          if (tech.skills.includes(job.skill)) continue;
          const result = canInsert(job, tech, [], kase.travel_minutes, shiftBoundsFor(tech));
          expect(result).toEqual({ ok: false, reason: "SKILL_MISMATCH" });
          checked++;
          if (checked >= 20) return;
        }
      }
    }
  );

  it.each(sampleCases.map((c) => [c.case_id, c] as const))(
    "case %s: feasible empty-route insertions respect the job window and shift bounds",
    (_caseId, kase) => {
      let checked = 0;
      for (const tech of kase.technicians) {
        for (const job of kase.jobs) {
          if (!tech.skills.includes(job.skill)) continue;
          const result = canInsert(job, tech, [], kase.travel_minutes, shiftBoundsFor(tech));
          if (result.ok) {
            expect(result.start).toBeGreaterThanOrEqual(hhmmToMinutes(job.window_start));
            expect(result.end).toBeLessThanOrEqual(hhmmToMinutes(job.window_end));
            expect(result.end).toBeLessThanOrEqual(hhmmToMinutes(tech.shift_end));
            expect(result.end - result.start).toBe(job.duration_minutes);
          } else {
            expect(["WINDOW_UNREACHABLE", "OUTSIDE_SHIFT", "BUMPS_LATER_JOB"]).toContain(
              result.reason
            );
          }
          checked++;
          if (checked >= 50) return;
        }
      }
    }
  );

  it.each(sampleCases.map((c) => [c.case_id, c] as const))(
    "case %s: the scripted manual_move never throws and yields a well-formed result",
    (_caseId, kase) => {
      const job = kase.jobs.find((j) => j.id === kase.manual_move.job_id);
      const tech = kase.technicians.find((t) => t.id === kase.manual_move.to_technician);
      expect(job).toBeDefined();
      expect(tech).toBeDefined();
      const result = canInsert(job as Job, tech as Technician, [], kase.travel_minutes, shiftBoundsFor(tech as Technician));
      if (result.ok) {
        expect(tech!.skills).toContain(job!.skill);
      } else {
        expect(["SKILL_MISMATCH", "WINDOW_UNREACHABLE", "OUTSIDE_SHIFT", "BUMPS_LATER_JOB"]).toContain(
          result.reason
        );
      }
    }
  );
});
