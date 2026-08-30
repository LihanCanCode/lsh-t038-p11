import { UnassignedEntry } from "@/lib/engine/types";

export const REASON_LABEL: Record<UnassignedEntry["reason"], string> = {
  NO_MATCHING_TECHNICIAN: "No technician has this skill",
  SKILL_MISMATCH: "No technician has this skill",
  WINDOW_UNREACHABLE: "Unreachable within the job window",
  OUTSIDE_SHIFT: "Would run past shift end",
  BUMPS_LATER_JOB: "Would bump another scheduled job",
};
