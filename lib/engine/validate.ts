import { Case } from "./types";

// Zod only checks shape (types/required keys), not that area references are
// internally consistent. getTravel() throws when it hits a missing area —
// correct fail-loud behavior for the engine, but callers should never reach
// that path: bad area references are a file problem to reject at upload
// time, not a rule violation to surface mid-plan.
export function findAreaReferenceIssues(kase: Case): string[] {
  const areaSet = new Set(kase.areas);
  const issues: string[] = [];

  for (const from of kase.areas) {
    if (!(from in kase.travel_minutes)) {
      issues.push(`travel_minutes is missing a row for area "${from}".`);
      continue;
    }
    for (const to of kase.areas) {
      if (!(to in kase.travel_minutes[from])) {
        issues.push(`travel_minutes["${from}"] is missing an entry for "${to}".`);
      }
    }
  }

  for (const tech of kase.technicians) {
    if (!areaSet.has(tech.home_area)) {
      issues.push(`Technician "${tech.id}" has home_area "${tech.home_area}", which is not in areas[].`);
    }
  }

  for (const job of kase.jobs) {
    if (!areaSet.has(job.area)) {
      issues.push(`Job "${job.id}" has area "${job.area}", which is not in areas[].`);
    }
  }

  return issues;
}
