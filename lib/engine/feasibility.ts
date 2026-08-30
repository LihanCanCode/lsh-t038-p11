import { Job, Technician, TimelineEntry, FeasibilityResult } from "./types";
import { getTravel, TravelMatrix } from "./travel";
import { hhmmToMinutes } from "./time";

export type ShiftBounds = {
  startMinutes: number;
  endMinutes: number;
  homeArea: string;
};

type FailureReason = "WINDOW_UNREACHABLE" | "BUMPS_LATER_JOB" | "OUTSIDE_SHIFT";

// Prefer the most specific/actionable reason when every position fails.
const FAILURE_PRIORITY: FailureReason[] = [
  "WINDOW_UNREACHABLE",
  "BUMPS_LATER_JOB",
  "OUTSIDE_SHIFT",
];

export function canInsert(
  job: Job,
  tech: Technician,
  currentRoute: TimelineEntry[],
  travelMatrix: TravelMatrix,
  shiftBounds: ShiftBounds
): FeasibilityResult {
  if (!tech.skills.includes(job.skill)) {
    return { ok: false, reason: "SKILL_MISMATCH" };
  }

  const jobWindowStart = hhmmToMinutes(job.window_start);
  const jobWindowEnd = hhmmToMinutes(job.window_end);

  let best:
    | { insertIndex: number; arrival: number; start: number; end: number; addedTravel: number }
    | null = null;
  const failureReasons = new Set<FailureReason>();

  for (let index = 0; index <= currentRoute.length; index++) {
    const prevArea = index === 0 ? shiftBounds.homeArea : currentRoute[index - 1].job.area;
    const prevEnd = index === 0 ? shiftBounds.startMinutes : currentRoute[index - 1].end;

    const travelToJob = getTravel(travelMatrix, prevArea, job.area);
    const arrival = prevEnd + travelToJob;
    const start = Math.max(arrival, jobWindowStart);
    const end = start + job.duration_minutes;

    if (end > jobWindowEnd) {
      failureReasons.add("WINDOW_UNREACHABLE");
      continue;
    }
    if (end > shiftBounds.endMinutes) {
      failureReasons.add("OUTSIDE_SHIFT");
      continue;
    }

    const nextEntry = currentRoute[index];
    let addedTravel = travelToJob;
    let cascadeOk = true;

    if (nextEntry) {
      const originalLeg = getTravel(travelMatrix, prevArea, nextEntry.job.area);

      let cursorEnd = end;
      let cursorArea = job.area;
      for (let i = index; i < currentRoute.length; i++) {
        const entry = currentRoute[i];
        const leg = getTravel(travelMatrix, cursorArea, entry.job.area);
        const entryArrival = cursorEnd + leg;
        const entryWindowStart = hhmmToMinutes(entry.job.window_start);
        const entryWindowEnd = hhmmToMinutes(entry.job.window_end);
        const entryStart = Math.max(entryArrival, entryWindowStart);
        const entryEnd = entryStart + entry.job.duration_minutes;

        if (entryEnd > entryWindowEnd || entryEnd > shiftBounds.endMinutes) {
          cascadeOk = false;
          failureReasons.add("BUMPS_LATER_JOB");
          break;
        }

        cursorEnd = entryEnd;
        cursorArea = entry.job.area;
      }

      const travelFromJob = getTravel(travelMatrix, job.area, nextEntry.job.area);
      addedTravel = travelToJob + travelFromJob - originalLeg;
    }

    if (!cascadeOk) continue;

    if (!best || addedTravel < best.addedTravel) {
      best = { insertIndex: index, arrival, start, end, addedTravel };
    }
  }

  if (best) {
    return {
      ok: true,
      insertIndex: best.insertIndex,
      arrival: best.arrival,
      start: best.start,
      end: best.end,
    };
  }

  for (const reason of FAILURE_PRIORITY) {
    if (failureReasons.has(reason)) {
      return { ok: false, reason };
    }
  }

  return { ok: false, reason: "OUTSIDE_SHIFT" };
}
