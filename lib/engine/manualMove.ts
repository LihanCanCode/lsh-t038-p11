import { Case, Plan, TimelineEntry } from "./types";
import { canInsert, shiftBoundsFor } from "./feasibility";
import { recomputeRouteFrom } from "./route";

export type ManualMoveResult =
  | { ok: true; newPlan: Plan }
  | { ok: false; reason: "SKILL_MISMATCH" | "OUTSIDE_SHIFT" | "WINDOW_UNREACHABLE" | "BUMPS_LATER_JOB" };

// Moves `jobId` onto `toTechId`'s route, wherever it currently lives (another
// technician's route or the unassigned list). Reuses canInsert's reason
// codes verbatim — no new rule vocabulary for this path.
export function applyManualMove(plan: Plan, jobId: string, toTechId: string, kase: Case): ManualMoveResult {
  const job = kase.jobs.find((j) => j.id === jobId);
  if (!job) {
    throw new Error(`Unknown job id "${jobId}".`);
  }
  const targetTech = kase.technicians.find((t) => t.id === toTechId);
  if (!targetTech) {
    throw new Error(`Unknown technician id "${toTechId}".`);
  }

  const targetRouteWithoutJob = (plan.routes[toTechId] ?? []).filter((e) => e.job.id !== jobId);
  const result = canInsert(job, targetTech, targetRouteWithoutJob, kase.travel_minutes, shiftBoundsFor(targetTech));

  if (!result.ok) {
    return { ok: false, reason: result.reason };
  }

  const newRoutes: Record<string, TimelineEntry[]> = {};
  for (const [techId, route] of Object.entries(plan.routes)) {
    newRoutes[techId] = techId === toTechId ? [...targetRouteWithoutJob] : route.filter((e) => e.job.id !== jobId);
  }

  for (const [techId, route] of Object.entries(plan.routes)) {
    if (techId === toTechId) continue;
    const removedIndex = route.findIndex((e) => e.job.id === jobId);
    if (removedIndex !== -1) {
      const sourceTech = kase.technicians.find((t) => t.id === techId)!;
      recomputeRouteFrom(newRoutes[techId], removedIndex, sourceTech, kase.travel_minutes);
    }
  }

  const targetRoute = newRoutes[toTechId];
  const prevEnd =
    result.insertIndex === 0 ? shiftBoundsFor(targetTech).startMinutes : targetRoute[result.insertIndex - 1].end;

  const entry: TimelineEntry = {
    job,
    arrival: result.arrival,
    start: result.start,
    end: result.end,
    travelFromPrev: result.arrival - prevEnd,
  };
  targetRoute.splice(result.insertIndex, 0, entry);
  recomputeRouteFrom(targetRoute, result.insertIndex + 1, targetTech, kase.travel_minutes);

  const newUnassigned = plan.unassigned.filter((u) => u.jobId !== jobId);

  return { ok: true, newPlan: { routes: newRoutes, unassigned: newUnassigned } };
}
