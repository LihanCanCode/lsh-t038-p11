import { z } from "zod";

export const TechnicianSchema = z.object({
  id: z.string(),
  name: z.string(),
  skills: z.array(z.string()),
  shift_start: z.string(),
  shift_end: z.string(),
  home_area: z.string(),
});

export const JobSchema = z.object({
  id: z.string(),
  area: z.string(),
  skill: z.string(),
  duration_minutes: z.number(),
  window_start: z.string(),
  window_end: z.string(),
});

export const ManualMoveSchema = z.object({
  job_id: z.string(),
  to_technician: z.string(),
});

export const CaseSchema = z.object({
  case_id: z.string(),
  today: z.string(),
  areas: z.array(z.string()),
  travel_minutes: z.record(z.string(), z.record(z.string(), z.number())),
  technicians: z.array(TechnicianSchema),
  jobs: z.array(JobSchema),
  manual_move: ManualMoveSchema,
});

export const DatasetSchema = z.object({
  schema_version: z.string(),
  problem_id: z.string(),
  format_note: z.string().optional(),
  cases: z.array(CaseSchema),
});

export type Technician = z.infer<typeof TechnicianSchema>;
export type Job = z.infer<typeof JobSchema>;
export type ManualMove = z.infer<typeof ManualMoveSchema>;
export type Case = z.infer<typeof CaseSchema>;
export type Dataset = z.infer<typeof DatasetSchema>;

export type TimelineEntry = {
  job: Job;
  arrival: number;
  start: number;
  end: number;
  travelFromPrev: number;
};

export type UnassignedEntry = {
  jobId: string;
  reason:
    | "SKILL_MISMATCH"
    | "OUTSIDE_SHIFT"
    | "WINDOW_UNREACHABLE"
    | "BUMPS_LATER_JOB"
    | "NO_MATCHING_TECHNICIAN";
  detail: string;
};

export type Plan = {
  routes: Record<string, TimelineEntry[]>;
  unassigned: UnassignedEntry[];
};

export type FeasibilityResult =
  | { ok: true; insertIndex: number; arrival: number; start: number; end: number }
  | {
      ok: false;
      reason:
        | "SKILL_MISMATCH"
        | "OUTSIDE_SHIFT"
        | "WINDOW_UNREACHABLE"
        | "BUMPS_LATER_JOB";
    };
