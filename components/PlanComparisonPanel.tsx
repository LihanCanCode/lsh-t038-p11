"use client";

import { useMemo, useState } from "react";
import { Case, Plan } from "@/lib/engine/types";
import { buildPlan } from "@/lib/engine/assign";
import { applyManualMove } from "@/lib/engine/manualMove";
import { scorePlan } from "@/lib/engine/score";
import { hhmmToMinutes } from "@/lib/engine/time";
import TechnicianTimeline from "./TechnicianTimeline";
import TimelineRuler from "./TimelineRuler";

function clonePlan(plan: Plan): Plan {
  return {
    routes: Object.fromEntries(
      Object.entries(plan.routes).map(([techId, route]) => [techId, route.map((entry) => ({ ...entry }))])
    ),
    unassigned: plan.unassigned.map((u) => ({ ...u })),
  };
}

// A job "moved" if its assignment (which technician, or unassigned) differs
// between the two plans — used to flag what changed when viewing the
// alternate plan against the baseline it started from.
function findMovedJobIds(reference: Plan, current: Plan): Set<string> {
  const techOf = (plan: Plan) => {
    const map = new Map<string, string | null>();
    for (const [techId, route] of Object.entries(plan.routes)) {
      for (const entry of route) map.set(entry.job.id, techId);
    }
    for (const u of plan.unassigned) {
      if (!map.has(u.jobId)) map.set(u.jobId, null);
    }
    return map;
  };

  const refMap = techOf(reference);
  const curMap = techOf(current);
  const moved = new Set<string>();
  for (const jobId of new Set([...refMap.keys(), ...curMap.keys()])) {
    if ((refMap.get(jobId) ?? null) !== (curMap.get(jobId) ?? null)) moved.add(jobId);
  }
  return moved;
}

function ScoreRow({
  label,
  baseline,
  alternate,
  lowerIsBetter,
  suffix = "",
}: {
  label: string;
  baseline: number;
  alternate: number;
  lowerIsBetter?: boolean;
  suffix?: string;
}) {
  const diff = alternate - baseline;
  const better = lowerIsBetter ? diff < 0 : diff > 0;
  const worse = lowerIsBetter ? diff > 0 : diff < 0;
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-stone-500">{label}</span>
      <span className="flex items-center gap-2 font-mono tabular-nums">
        <span className="text-stone-400">
          {baseline}
          {suffix}
        </span>
        <span className="text-stone-300">→</span>
        <span className={`font-semibold ${better ? "text-emerald-600" : worse ? "text-rose-600" : "text-stone-900"}`}>
          {alternate}
          {suffix}
        </span>
        {diff !== 0 && (
          <span className={`text-xs ${better ? "text-emerald-600" : "text-rose-600"}`}>
            ({diff > 0 ? "+" : ""}
            {diff})
          </span>
        )}
      </span>
    </div>
  );
}

export default function PlanComparisonPanel({ kase }: { kase: Case }) {
  const baselinePlan = useMemo(() => buildPlan(kase), [kase]);
  const [alternatePlan, setAlternatePlan] = useState<Plan>(() => clonePlan(baselinePlan));
  const [view, setView] = useState<"baseline" | "alternate">("alternate");
  const [draggedJobId, setDraggedJobId] = useState<string | null>(null);
  const [dragOverTechId, setDragOverTechId] = useState<string | null>(null);

  const globalRange = useMemo(() => {
    if (kase.technicians.length === 0) return { start: 0, end: 24 * 60 };
    return {
      start: Math.min(...kase.technicians.map((t) => hhmmToMinutes(t.shift_start))),
      end: Math.max(...kase.technicians.map((t) => hhmmToMinutes(t.shift_end))),
    };
  }, [kase]);

  const jobsById = useMemo(() => new Map(kase.jobs.map((j) => [j.id, j])), [kase]);
  const baselineScore = useMemo(() => scorePlan(baselinePlan), [baselinePlan]);
  const alternateScore = useMemo(() => scorePlan(alternatePlan), [alternatePlan]);
  const movedJobIds = useMemo(() => findMovedJobIds(baselinePlan, alternatePlan), [baselinePlan, alternatePlan]);

  const isAlternate = view === "alternate";
  const activePlan = isAlternate ? alternatePlan : baselinePlan;

  function previewMove(jobId: string, toTechId: string): boolean {
    try {
      return applyManualMove(alternatePlan, jobId, toTechId, kase).ok;
    } catch {
      return false;
    }
  }

  function startDrag(jobId: string) {
    setDraggedJobId(jobId);
  }

  function endDrag() {
    setDraggedJobId(null);
    setDragOverTechId(null);
  }

  function handleDrop(toTechId: string) {
    const jobId = draggedJobId;
    endDrag();
    if (!jobId) return;
    try {
      const result = applyManualMove(alternatePlan, jobId, toTechId, kase);
      if (result.ok) setAlternatePlan(result.newPlan);
    } catch {
      // Dragged jobs always come from this panel's own known job ids — an
      // unknown-id throw here would indicate a bug, not user input.
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-stone-200 bg-stone-50 p-4">
        <div className="flex flex-col gap-1.5">
          <ScoreRow label="Assigned" baseline={baselineScore.assignedCount} alternate={alternateScore.assignedCount} />
          <ScoreRow
            label="Unassigned"
            baseline={baselineScore.unassignedCount}
            alternate={alternateScore.unassignedCount}
            lowerIsBetter
          />
          <ScoreRow
            label="Total travel"
            baseline={baselineScore.totalTravelMinutes}
            alternate={alternateScore.totalTravelMinutes}
            lowerIsBetter
            suffix="m"
          />
        </div>
        {isAlternate && (
          <button
            type="button"
            onClick={() => setAlternatePlan(clonePlan(baselinePlan))}
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 shadow-sm transition-colors hover:bg-stone-50"
          >
            Reset to baseline
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-stone-200 bg-stone-100 p-0.5">
          {(["baseline", "alternate"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                view === v ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"
              }`}
            >
              {v === "baseline" ? "Baseline (algorithm)" : "Alternate (yours)"}
            </button>
          ))}
        </div>
        {isAlternate && movedJobIds.size > 0 && (
          <span className="flex items-center gap-1.5 text-xs text-stone-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 ring-1 ring-white" />
            {movedJobIds.size} job{movedJobIds.size === 1 ? "" : "s"} differ from baseline
          </span>
        )}
      </div>

      <div>
        <div className="px-2">
          <TimelineRuler startMinutes={globalRange.start} endMinutes={globalRange.end} />
        </div>
        <div className="flex flex-col divide-y divide-stone-100">
          {kase.technicians.map((tech) => {
            const isDropTarget = dragOverTechId === tech.id;
            const dropPreviewOk =
              isAlternate && isDropTarget && draggedJobId ? previewMove(draggedJobId, tech.id) : null;
            return (
              <TechnicianTimeline
                key={tech.id}
                technician={tech}
                entries={activePlan.routes[tech.id] ?? []}
                globalStart={globalRange.start}
                globalEnd={globalRange.end}
                movedJobIds={isAlternate ? movedJobIds : undefined}
                draggedJobId={isAlternate ? draggedJobId : null}
                onJobDragStart={isAlternate ? startDrag : undefined}
                onJobDragEnd={isAlternate ? endDrag : undefined}
                isDropTarget={isAlternate && isDropTarget}
                dropPreviewOk={dropPreviewOk}
                onRowDragOver={isAlternate ? () => setDragOverTechId(tech.id) : undefined}
                onRowDragLeave={
                  isAlternate ? () => setDragOverTechId((id) => (id === tech.id ? null : id)) : undefined
                }
                onRowDrop={isAlternate ? () => handleDrop(tech.id) : undefined}
              />
            );
          })}
        </div>

        {activePlan.unassigned.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 rounded-lg border border-dashed border-stone-300 p-2">
            {activePlan.unassigned.map((u) => {
              const job = jobsById.get(u.jobId);
              if (!job) return null;
              const moved = isAlternate && movedJobIds.has(job.id);
              return (
                <div
                  key={u.jobId}
                  draggable={isAlternate}
                  onDragStart={
                    isAlternate
                      ? (e) => {
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", job.id);
                          startDrag(job.id);
                        }
                      : undefined
                  }
                  onDragEnd={isAlternate ? endDrag : undefined}
                  title={`${job.id} · ${job.skill} · ${job.area}`}
                  className={`flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-2.5 py-1 text-[11px] font-medium text-stone-600 shadow-sm ${
                    isAlternate ? "cursor-grab active:cursor-grabbing" : ""
                  } ${draggedJobId === job.id ? "opacity-30" : ""}`}
                >
                  {job.id}
                  {moved && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
