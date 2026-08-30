"use client";

import { Technician, TimelineEntry } from "@/lib/engine/types";
import { hhmmToMinutes, minutesToHhmm } from "@/lib/engine/time";
import { skillColor, skillTint } from "@/lib/ui/skillColor";

type Segment =
  | { type: "job"; minutes: number; entry: TimelineEntry }
  | { type: "travel"; minutes: number }
  | { type: "idle"; minutes: number }
  | { type: "off-shift"; minutes: number };

const OFF_SHIFT_TEXTURE = {
  backgroundImage:
    "repeating-linear-gradient(135deg, rgba(28,25,23,0.07) 0px, rgba(28,25,23,0.07) 1px, transparent 1px, transparent 7px)",
};

function buildSegments(
  entries: TimelineEntry[],
  globalStart: number,
  shiftStart: number,
  shiftEnd: number,
  globalEnd: number
): Segment[] {
  const segments: Segment[] = [];

  if (shiftStart > globalStart) {
    segments.push({ type: "off-shift", minutes: shiftStart - globalStart });
  }

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

  if (globalEnd > shiftEnd) {
    segments.push({ type: "off-shift", minutes: globalEnd - shiftEnd });
  }

  return segments;
}

export default function TechnicianTimeline({
  technician,
  entries,
  globalStart,
  globalEnd,
  selectedJobId,
  onSelectJob,
  isSick,
  draggedJobId,
  onJobDragStart,
  onJobDragEnd,
  isDropTarget,
  dropPreviewOk,
  onRowDragOver,
  onRowDragLeave,
  onRowDrop,
}: {
  technician: Technician;
  entries: TimelineEntry[];
  globalStart: number;
  globalEnd: number;
  selectedJobId?: string | null;
  onSelectJob?: (jobId: string) => void;
  isSick?: boolean;
  draggedJobId?: string | null;
  onJobDragStart?: (jobId: string) => void;
  onJobDragEnd?: () => void;
  isDropTarget?: boolean;
  dropPreviewOk?: boolean | null;
  onRowDragOver?: () => void;
  onRowDragLeave?: () => void;
  onRowDrop?: () => void;
}) {
  const shiftStart = hhmmToMinutes(technician.shift_start);
  const shiftEnd = hhmmToMinutes(technician.shift_end);
  const totalMinutes = Math.max(globalEnd - globalStart, 1);
  const segments = buildSegments(entries, globalStart, shiftStart, shiftEnd, globalEnd);
  const canDrop = Boolean(onRowDrop) && !isSick;

  const dropRingClass = !isDropTarget
    ? "ring-stone-200/80"
    : dropPreviewOk === false
      ? "ring-2 ring-rose-400 bg-rose-50/60"
      : "ring-2 ring-emerald-400 bg-emerald-50/60";

  return (
    <div
      onDragOver={
        canDrop
          ? (e) => {
              e.preventDefault();
              onRowDragOver?.();
            }
          : undefined
      }
      onDragLeave={
        canDrop
          ? (e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                onRowDragLeave?.();
              }
            }
          : undefined
      }
      onDrop={
        canDrop
          ? (e) => {
              e.preventDefault();
              onRowDrop?.();
            }
          : undefined
      }
      className={`group/row flex flex-col gap-2 rounded-xl px-2 py-3 transition-colors duration-200 hover:bg-stone-50 ${
        isSick ? "opacity-60" : ""
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-600/10 text-[10px] font-semibold text-violet-700 transition-transform duration-200 group-hover/row:scale-110">
            {technician.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="text-sm font-medium text-stone-900">{technician.name}</span>
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-500">
            {technician.home_area}
          </span>
          {isSick && (
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
              out sick
            </span>
          )}
        </div>
        <span className="font-mono text-[11px] tabular-nums text-stone-400">
          {technician.shift_start}–{technician.shift_end}
        </span>
      </div>
      <div className={`flex h-9 w-full rounded-lg bg-stone-100 ring-1 transition-all duration-150 ${dropRingClass}`}>
        {segments.map((seg, i) => {
          const widthPercent = (seg.minutes / totalMinutes) * 100;
          const rounding = i === 0 ? "rounded-l-lg" : i === segments.length - 1 ? "rounded-r-lg" : "";

          if (seg.type === "job") {
            const job = seg.entry.job;
            const isSelected = selectedJobId === job.id;
            const isBeingDragged = draggedJobId === job.id;
            return (
              <button
                key={i}
                type="button"
                draggable={Boolean(onJobDragStart)}
                onDragStart={
                  onJobDragStart
                    ? (e) => {
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", job.id);
                        onJobDragStart(job.id);
                      }
                    : undefined
                }
                onDragEnd={onJobDragEnd}
                onClick={onSelectJob ? () => onSelectJob(job.id) : undefined}
                title={`${job.id} · ${job.area} · ${job.skill} · window ${job.window_start}-${job.window_end} · scheduled ${minutesToHhmm(seg.entry.start)}-${minutesToHhmm(seg.entry.end)}`}
                style={{
                  width: `${widthPercent}%`,
                  backgroundColor: skillTint(job.skill),
                  borderLeft: `3px solid ${skillColor(job.skill)}`,
                  color: skillColor(job.skill),
                }}
                className={`relative flex items-center justify-center overflow-hidden px-1 text-[10px] font-bold outline-none transition-all duration-200 ease-out ${rounding} ${
                  onSelectJob ? "cursor-grab active:cursor-grabbing hover:z-10 hover:scale-[1.08] hover:shadow-lg" : ""
                } ${isSelected ? "z-10 shadow-lg ring-2 ring-violet-500" : ""} ${isBeingDragged ? "opacity-30" : ""}`}
              >
                <span className="truncate">{job.id}</span>
              </button>
            );
          }

          if (seg.type === "travel") {
            return (
              <div
                key={i}
                title={`travel ${seg.minutes}min`}
                style={{ width: `${widthPercent}%` }}
                className={`flex items-center justify-center overflow-hidden transition-all duration-300 ${rounding}`}
              >
                <span className="h-px w-full bg-stone-400" />
              </div>
            );
          }

          if (seg.type === "off-shift") {
            return (
              <div
                key={i}
                title="off shift"
                style={{ width: `${widthPercent}%`, ...OFF_SHIFT_TEXTURE }}
                className={`bg-stone-200 transition-all duration-300 ${rounding}`}
              />
            );
          }

          return (
            <div
              key={i}
              title={`idle ${seg.minutes}min`}
              style={{ width: `${widthPercent}%` }}
              className={`bg-stone-50 transition-all duration-300 ${rounding}`}
            />
          );
        })}
      </div>
    </div>
  );
}
