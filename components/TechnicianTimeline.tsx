"use client";

import { Technician, TimelineEntry } from "@/lib/engine/types";
import { hhmmToMinutes, minutesToHhmm } from "@/lib/engine/time";

// Skills are an open, data-driven vocabulary (never a fixed enum) — derive a
// stable color from the string instead of switching on known skill names.
function skillColor(skill: string): string {
  let hash = 0;
  for (let i = 0; i < skill.length; i++) {
    hash = skill.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 42%)`;
}

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
}: {
  technician: Technician;
  entries: TimelineEntry[];
}) {
  const shiftStart = hhmmToMinutes(technician.shift_start);
  const shiftEnd = hhmmToMinutes(technician.shift_end);
  const totalMinutes = Math.max(shiftEnd - shiftStart, 1);
  const segments = buildSegments(entries, shiftStart, shiftEnd);

  return (
    <div className="flex flex-col gap-1 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
        <span className="font-medium text-zinc-900 dark:text-zinc-100">{technician.name}</span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {technician.shift_start}–{technician.shift_end} · {technician.skills.join(", ")} · home:{" "}
          {technician.home_area}
        </span>
      </div>
      <div className="flex h-10 w-full overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800">
        {segments.map((seg, i) => {
          const widthPercent = (seg.minutes / totalMinutes) * 100;

          if (seg.type === "job") {
            const job = seg.entry.job;
            return (
              <div
                key={i}
                title={`${job.id} · ${job.area} · ${job.skill} · window ${job.window_start}-${job.window_end} · scheduled ${minutesToHhmm(seg.entry.start)}-${minutesToHhmm(seg.entry.end)}`}
                style={{ width: `${widthPercent}%`, backgroundColor: skillColor(job.skill) }}
                className="flex items-center justify-center overflow-hidden px-1 text-[10px] font-medium text-white"
              >
                <span className="truncate">{job.id}</span>
              </div>
            );
          }

          if (seg.type === "travel") {
            return (
              <div
                key={i}
                title={`travel ${seg.minutes}min`}
                style={{ width: `${widthPercent}%` }}
                className="flex items-center justify-center overflow-hidden bg-zinc-300 text-[9px] text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
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
              className="bg-zinc-50 dark:bg-zinc-900"
            />
          );
        })}
      </div>
    </div>
  );
}
