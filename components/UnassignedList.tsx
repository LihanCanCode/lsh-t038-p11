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
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0">
          <path
            d="M4 10.5 8 14l8-8"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        All jobs were assigned in this case.
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {unassigned.map((entry) => {
        const job = jobsById.get(entry.jobId);
        return (
          <li
            key={entry.jobId}
            className="rounded-lg border border-red-200/80 bg-red-50/70 p-3 text-sm shadow-sm dark:border-red-900/30 dark:bg-red-950/20"
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-medium text-red-900 dark:text-red-200">{entry.jobId}</span>
              {job && (
                <span className="text-xs text-red-800/80 dark:text-red-300/80">
                  {job.skill} · {job.area} · {job.window_start}–{job.window_end}
                </span>
              )}
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-800 dark:bg-red-900/50 dark:text-red-200">
                {REASON_LABEL[entry.reason]}
              </span>
            </div>
            <p className="mt-1 text-xs text-red-700/90 dark:text-red-300/90">{entry.detail}</p>
          </li>
        );
      })}
    </ul>
  );
}
