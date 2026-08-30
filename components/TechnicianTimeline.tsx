"use client";

import { Technician, TimelineEntry } from "@/lib/engine/types";
import { hhmmToMinutes, minutesToHhmm } from "@/lib/engine/time";
import { skillColor } from "@/lib/ui/skillColor";

type Segment =
  | { type: "job"; minutes: number; entry: TimelineEntry }
  | { type: "travel"; minutes: number }
  | { type: "idle"; minutes: number };

function buildSegments(entries: TimelineEntry[], shiftStart: number, shiftEnd: number): Segment[] {
  const segments: Segment[] = [];
  let cursor = shiftStart;

  for (const entry of entries) {
    if (entry.travelFromPrev > 0) {
      segments.push({ type: "travel", minutes: entry.travelFromPrev });
    }
    cursor += entry.travelFromPrev;

    const idleBeforeStart = entry.start - cursor;
    if (idleBeforeStart > 0) {
      segments.push({ type: "idle", minutes: idleBeforeStart });
    }

    segments.push({ type: "job", minutes: entry.end - entry.start, entry });
    cursor = entry.end;
  }

  const tailIdle = shiftEnd - cursor;
  if (tailIdle > 0) {
    segments.push({ type: "idle", minutes: tailIdle });
  }

  return segments;
}

export default function TechnicianTimeline({
  technician,
  entries,
  selectedJobId,
  onSelectJob,
}: {
  technician: Technician;
  entries: TimelineEntry[];
  selectedJobId?: string | null;
  onSelectJob?: (jobId: string) => void;
}) {
  const shiftStart = hhmmToMinutes(technician.shift_start);
  const shiftEnd = hhmmToMinutes(technician.shift_end);
  const totalMinutes = Math.max(shiftEnd - shiftStart, 1);
  const segments = buildSegments(entries, shiftStart, shiftEnd);

  return (
    <div className="flex flex-col gap-2 rounded-xl px-2 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600/10 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-400/10 dark:text-indigo-300">
            {technician.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {technician.name}
          </span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {technician.home_area}
          </span>
        </div>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {technician.shift_start}–{technician.shift_end}
        </span>
      </div>
      <div className="flex h-11 w-full overflow-hidden rounded-lg bg-zinc-100 shadow-inner ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/5">
        {segments.map((seg, i) => {
          const widthPercent = (seg.minutes / totalMinutes) * 100;

          if (seg.type === "job") {
            const job = seg.entry.job;
            const isSelected = selectedJobId === job.id;
            return (
              <button
                key={i}
                type="button"
                onClick={onSelectJob ? () => onSelectJob(job.id) : undefined}
                title={`${job.id} · ${job.area} · ${job.skill} · window ${job.window_start}-${job.window_end} · scheduled ${minutesToHhmm(seg.entry.start)}-${minutesToHhmm(seg.entry.end)}`}
                style={{ width: `${widthPercent}%`, backgroundColor: skillColor(job.skill) }}
                className={`flex items-center justify-center overflow-hidden border-r border-white/25 px-1 text-[10px] font-semibold text-white outline-none last:border-r-0 ${
                  onSelectJob ? "cursor-pointer" : ""
                } ${isSelected ? "ring-2 ring-inset ring-white" : ""}`}
              >
                <span className="truncate drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]">{job.id}</span>
              </button>
            );
          }

          if (seg.type === "travel") {
            return (
              <div
                key={i}
                title={`travel ${seg.minutes}min`}
                style={{ width: `${widthPercent}%` }}
                className="flex items-center justify-center overflow-hidden border-r border-white/40 bg-zinc-300 text-[9px] font-medium text-zinc-600 last:border-r-0 dark:border-black/20 dark:bg-zinc-700 dark:text-zinc-300"
              >
                {widthPercent > 4 ? `${seg.minutes}m` : ""}
              </div>
            );
          }

          return (
            <div
              key={i}
              title={`idle ${seg.minutes}min`}
              style={{ width: `${widthPercent}%` }}
              className="border-r border-white/40 last:border-r-0 dark:border-black/20"
            />
          );
        })}
      </div>
    </div>
  );
}
