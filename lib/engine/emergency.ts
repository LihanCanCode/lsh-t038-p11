import { Case, Job, Plan, TimelineEntry } from "./types";
import { runInsertionPass } from "./assign";

// Injects `newJob` mid-day and re-plans only what hasn't happened yet.
// Entries whose scheduled start is at or before `cursorMinutes` are treated
// as already underway and kept exactly as-is; everything not yet started
// (assigned-but-future entries, previously unassigned jobs, and the new job)
// goes back into the same greedy insertion pool used for the initial plan.
// minInsertIndex pins each technician's route so nothing can be inserted
// before their locked prefix, however short the gap between "now" and their
// next already-scheduled job.
export function injectEmergencyJob(plan: Plan, cursorMinutes: number, newJob: Job, kase: Case): Plan {
  const workingRoutes: Record<string, TimelineEntry[]> = {};
  const lockedCounts = new Map<string, number>();
  const pool: Job[] = [newJob];

  for (const tech of kase.technicians) {
    const route = plan.routes[tech.id] ?? [];
    const locked = route.filter((e) => e.start <= cursorMinutes);
    const movable = route.filter((e) => e.start > cursorMinutes);

    workingRoutes[tech.id] = [...locked];
    lockedCounts.set(tech.id, locked.length);
    pool.push(...movable.map((e) => e.job));
  }

  const jobsById = new Map(kase.jobs.map((j) => [j.id, j]));
  for (const entry of plan.unassigned) {
    const job = jobsById.get(entry.jobId);
    if (job) pool.push(job);
  }

  const unassigned = runInsertionPass(
    pool,
    kase.technicians,
    workingRoutes,
    kase.travel_minutes,
    (techId) => lockedCounts.get(techId) ?? 0
  );

  return { routes: workingRoutes, unassigned };
}
