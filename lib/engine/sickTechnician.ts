import { Case, Job, Plan, TimelineEntry } from "./types";
import { runInsertionPass } from "./assign";

// Removes `sickTechId` from the roster. Their already-started/completed work
// (start <= cursorMinutes) is kept exactly as scheduled — it happened, that
// technician just isn't available for anything more today. Their not-yet-
// started jobs, plus anything already unassigned, are fed back through the
// same insertion loop against the remaining technicians' existing routes.
// Each remaining technician's own history before the cursor is protected the
// same way — nothing can be inserted into a slot that's already elapsed for
// them either.
export function removeSickTechnician(
  plan: Plan,
  sickTechId: string,
  cursorMinutes: number,
  kase: Case
): Plan {
  const remainingTechnicians = kase.technicians.filter((t) => t.id !== sickTechId);

  const sickRoute = plan.routes[sickTechId] ?? [];
  const workingRoutes: Record<string, TimelineEntry[]> = {
    [sickTechId]: sickRoute.filter((e) => e.start <= cursorMinutes),
  };
  const pool: Job[] = sickRoute.filter((e) => e.start > cursorMinutes).map((e) => e.job);

  const lockedCounts = new Map<string, number>();
  for (const tech of remainingTechnicians) {
    const route = plan.routes[tech.id] ?? [];
    workingRoutes[tech.id] = [...route];
    lockedCounts.set(tech.id, route.filter((e) => e.start <= cursorMinutes).length);
  }

  const jobsById = new Map(kase.jobs.map((j) => [j.id, j]));
  for (const entry of plan.unassigned) {
    const job = jobsById.get(entry.jobId);
    if (job) pool.push(job);
  }

  const unassigned = runInsertionPass(
    pool,
    remainingTechnicians,
    workingRoutes,
    kase.travel_minutes,
    (techId) => lockedCounts.get(techId) ?? 0
  );

  return { routes: workingRoutes, unassigned };
}
