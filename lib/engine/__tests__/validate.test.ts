import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { findAreaReferenceIssues } from "../validate";
import { buildPlan } from "../assign";
import { Case, DatasetSchema } from "../types";

const baseCase: Case = {
  case_id: "fixture",
  today: "2026-01-01",
  areas: ["A", "B"],
  travel_minutes: { A: { A: 0, B: 10 }, B: { A: 10, B: 0 } },
  technicians: [
    { id: "t1", name: "T1", skills: ["plumbing"], shift_start: "09:00", shift_end: "17:00", home_area: "A" },
  ],
  jobs: [
    { id: "j1", area: "A", skill: "plumbing", duration_minutes: 30, window_start: "09:00", window_end: "10:00" },
  ],
  manual_move: { job_id: "j1", to_technician: "t1" },
};

describe("findAreaReferenceIssues", () => {
  it("reports nothing for an internally-consistent case", () => {
    expect(findAreaReferenceIssues(baseCase)).toEqual([]);
  });

  it("flags a job area that isn't in areas[]", () => {
    const kase: Case = { ...baseCase, jobs: [{ ...baseCase.jobs[0], area: "Nowhere" }] };
    const issues = findAreaReferenceIssues(kase);
    expect(issues.some((i) => i.includes('Job "j1"') && i.includes("Nowhere"))).toBe(true);
  });

  it("flags a technician home_area that isn't in areas[]", () => {
    const kase: Case = { ...baseCase, technicians: [{ ...baseCase.technicians[0], home_area: "Nowhere" }] };
    const issues = findAreaReferenceIssues(kase);
    expect(issues.some((i) => i.includes('Technician "t1"') && i.includes("Nowhere"))).toBe(true);
  });

  it("flags a travel_minutes matrix missing a row or cell for a declared area", () => {
    const kase: Case = { ...baseCase, travel_minutes: { A: { A: 0, B: 10 } } };
    const issues = findAreaReferenceIssues(kase);
    expect(issues.some((i) => i.includes("missing a row for area \"B\""))).toBe(true);
  });

  it("confirms buildPlan throws on a case with an unvalidated bad area (why this guard exists)", () => {
    const kase: Case = { ...baseCase, jobs: [{ ...baseCase.jobs[0], area: "Nowhere" }] };
    expect(findAreaReferenceIssues(kase).length).toBeGreaterThan(0);
    expect(() => buildPlan(kase)).toThrow(/Nowhere/);
  });

  it("real dataset: every bundled case is internally consistent", () => {
    const datasetPath = path.join(__dirname, "../../../public/data/P11_route_shift_public.json");
    const raw = JSON.parse(fs.readFileSync(datasetPath, "utf-8"));
    const dataset = DatasetSchema.parse(raw);
    for (const kase of dataset.cases) {
      expect(findAreaReferenceIssues(kase)).toEqual([]);
    }
  });
});
