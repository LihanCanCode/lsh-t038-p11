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
        <button
          type="button"
          onClick={() => setAlternatePlan(clonePlan(baselinePlan))}
          className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 shadow-sm transition-colors hover:bg-stone-50"
        >
          Reset to baseline
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
            Baseline (greedy algorithm)
          </h3>
          <div className="px-2">
            <TimelineRuler startMinutes={globalRange.start} endMinutes={globalRange.end} />
          </div>
          <div className="flex flex-col divide-y divide-stone-100">
            {kase.technicians.map((tech) => (
              <TechnicianTimeline
                key={tech.id}
                technician={tech}
                entries={baselinePlan.routes[tech.id] ?? []}
                globalStart={globalRange.start}
                globalEnd={globalRange.end}
              />
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
            Your alternate plan — drag jobs between technicians
          </h3>
          <div className="px-2">
            <TimelineRuler startMinutes={globalRange.start} endMinutes={globalRange.end} />
          </div>
          <div className="flex flex-col divide-y divide-stone-100">
            {kase.technicians.map((tech) => {
              const isDropTarget = dragOverTechId === tech.id;
              const dropPreviewOk = isDropTarget && draggedJobId ? previewMove(draggedJobId, tech.id) : null;
              return (
                <TechnicianTimeline
                  key={tech.id}
                  technician={tech}
                  entries={alternatePlan.routes[tech.id] ?? []}
                  globalStart={globalRange.start}
                  globalEnd={globalRange.end}
                  draggedJobId={draggedJobId}
                  onJobDragStart={startDrag}
                  onJobDragEnd={endDrag}
                  isDropTarget={isDropTarget}
                  dropPreviewOk={dropPreviewOk}
                  onRowDragOver={() => setDragOverTechId(tech.id)}
                  onRowDragLeave={() => setDragOverTechId((id) => (id === tech.id ? null : id))}
                  onRowDrop={() => handleDrop(tech.id)}
                />
              );
            })}
          </div>

          {alternatePlan.unassigned.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5 rounded-lg border border-dashed border-stone-300 p-2">
              {alternatePlan.unassigned.map((u) => {
                const job = jobsById.get(u.jobId);
                if (!job) return null;
                return (
                  <div
                    key={u.jobId}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", job.id);
                      startDrag(job.id);
                    }}
                    onDragEnd={endDrag}
                    title={`${job.id} · ${job.skill} · ${job.area}`}
                    className={`cursor-grab rounded-full border border-stone-300 bg-white px-2.5 py-1 text-[11px] font-medium text-stone-600 shadow-sm active:cursor-grabbing ${
                      draggedJobId === job.id ? "opacity-30" : ""
                    }`}
                  >
                    {job.id}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
