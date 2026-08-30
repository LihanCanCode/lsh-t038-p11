import { Job, UnassignedEntry } from "@/lib/engine/types";

const REASON_LABEL: Record<UnassignedEntry["reason"], string> = {
  NO_MATCHING_TECHNICIAN: "No technician has this skill",
  SKILL_MISMATCH: "No technician has this skill",
  WINDOW_UNREACHABLE: "Unreachable within the job window",
  OUTSIDE_SHIFT: "Would run past shift end",
  BUMPS_LATER_JOB: "Would bump another scheduled job",
};

export default function UnassignedList({
  unassigned,
  jobsById,
}: {
  unassigned: UnassignedEntry[];
  jobsById: Map<string, Job>;
}) {
  if (unassigned.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        All jobs were assigned in this case.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {unassigned.map((entry) => {
        const job = jobsById.get(entry.jobId);
        return (
          <li
            key={entry.jobId}
            className="rounded-md border border-red-200 bg-red-50 p-3 text-sm dark:border-red-900/40 dark:bg-red-950/30"
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-medium text-red-900 dark:text-red-200">{entry.jobId}</span>
              {job && (
                <span className="text-xs text-red-800/80 dark:text-red-300/80">
                  {job.skill} · {job.area} · {job.window_start}–{job.window_end}
                </span>
              )}
              <span className="rounded-full bg-red-200 px-2 py-0.5 text-[10px] font-medium text-red-900 dark:bg-red-900/50 dark:text-red-200">
                {REASON_LABEL[entry.reason]}
              </span>
            </div>
            <p className="mt-1 text-xs text-red-800 dark:text-red-300">{entry.detail}</p>
          </li>
        );
      })}
    </ul>
  );
}
