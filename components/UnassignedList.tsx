import { Job, UnassignedEntry } from "@/lib/engine/types";
import { REASON_LABEL } from "@/lib/ui/reasonLabel";

export default function UnassignedList({
  unassigned,
  jobsById,
  onSelectJob,
}: {
  unassigned: UnassignedEntry[];
  jobsById: Map<string, Job>;
  onSelectJob?: (jobId: string) => void;
}) {
  if (unassigned.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
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
            onClick={onSelectJob ? () => onSelectJob(entry.jobId) : undefined}
            className={`rounded-lg border border-y-stone-200 border-r-stone-200 border-l-[3px] border-l-rose-400 bg-white p-3 text-sm shadow-sm ${
              onSelectJob ? "cursor-pointer transition-colors hover:bg-stone-50" : ""
            }`}
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-medium text-stone-900">{entry.jobId}</span>
              {job && (
                <span className="text-xs text-stone-500">
                  {job.skill} · {job.area} ·{" "}
                  <span className="font-mono tabular-nums">
                    {job.window_start}–{job.window_end}
                  </span>
                </span>
              )}
              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
                {REASON_LABEL[entry.reason]}
              </span>
            </div>
            <p className="mt-1 text-xs text-stone-500">{entry.detail}</p>
          </li>
        );
      })}
    </ul>
  );
}
