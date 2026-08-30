import { Case, Job, Plan, Technician, TimelineEntry, UnassignedEntry } from "./types";
import { canInsert, shiftBoundsFor } from "./feasibility";
import { recomputeRouteFrom } from "./route";
import { hhmmToMinutes } from "./time";

type BlockingReason = Exclude<UnassignedEntry["reason"], "NO_MATCHING_TECHNICIAN">;

// More specific/actionable reasons win over the generic "ran out of shift time".
const REASON_PRIORITY: BlockingReason[] = [
  "WINDOW_UNREACHABLE",
  "BUMPS_LATER_JOB",
  "OUTSIDE_SHIFT",
  "SKILL_MISMATCH",
];

function pickBlockingReason(reasons: Set<BlockingReason>): BlockingReason {
  for (const reason of REASON_PRIORITY) {
    if (reasons.has(reason)) return reason;
  }
  return "OUTSIDE_SHIFT";
}

function describeUnassigned(job: Job, reason: UnassignedEntry["reason"]): string {
  switch (reason) {
    case "NO_MATCHING_TECHNICIAN":
      return `No technician with skill "${job.skill}" exists in this case.`;
    case "WINDOW_UNREACHABLE":
      return `No ${job.skill} technician has a free slot in ${job.area} between ${job.window_start}–${job.window_end} without missing the window.`;
    case "OUTSIDE_SHIFT":
      return `No ${job.skill} technician can fit this ${job.duration_minutes}-minute job before their shift ends.`;
    case "BUMPS_LATER_JOB":
      return `Inserting this job would push an already scheduled job outside its window for every available ${job.skill} technician.`;
    case "SKILL_MISMATCH":
      return `No technician with skill "${job.skill}" is available.`;
  }
}

function jobWindowTightness(job: Job): number {
  return hhmmToMinutes(job.window_end) - hhmmToMinutes(job.window_start);
}

export function buildPlan(kase: Case): Plan {
  const routes: Record<string, TimelineEntry[]> = {};
  for (const tech of kase.technicians) {
    routes[tech.id] = [];
  }

  const sortedJobs = [...kase.jobs].sort((a, b) => jobWindowTightness(a) - jobWindowTightness(b));
  const unassigned: UnassignedEntry[] = [];

  for (const job of sortedJobs) {
    const eligibleTechs = kase.technicians.filter((t) => t.skills.includes(job.skill));

    if (eligibleTechs.length === 0) {
      unassigned.push({
        jobId: job.id,
        reason: "NO_MATCHING_TECHNICIAN",
        detail: describeUnassigned(job, "NO_MATCHING_TECHNICIAN"),
      });
      continue;
    }

    let best:
      | {
          tech: Technician;
          insertIndex: number;
          arrival: number;
          start: number;
          end: number;
          addedTravelMinutes: number;
        }
      | null = null;
    const blockingReasons = new Set<BlockingReason>();

    for (const tech of eligibleTechs) {
      const result = canInsert(job, tech, routes[tech.id], kase.travel_minutes, shiftBoundsFor(tech));
      if (result.ok) {
        if (!best || result.addedTravelMinutes < best.addedTravelMinutes) {
          best = {
            tech,
            insertIndex: result.insertIndex,
            arrival: result.arrival,
            start: result.start,
            end: result.end,
            addedTravelMinutes: result.addedTravelMinutes,
          };
        }
      } else {
        blockingReasons.add(result.reason);
      }
    }

    if (!best) {
      const reason = pickBlockingReason(blockingReasons);
      unassigned.push({ jobId: job.id, reason, detail: describeUnassigned(job, reason) });
      continue;
    }

    const route = routes[best.tech.id];
    const prevEnd =
      best.insertIndex === 0
        ? shiftBoundsFor(best.tech).startMinutes
        : route[best.insertIndex - 1].end;

    const entry: TimelineEntry = {
      job,
      arrival: best.arrival,
      start: best.start,
      end: best.end,
      travelFromPrev: best.arrival - prevEnd,
    };
    route.splice(best.insertIndex, 0, entry);
    recomputeRouteFrom(route, best.insertIndex + 1, best.tech, kase.travel_minutes);
  }

  return { routes, unassigned };
}
