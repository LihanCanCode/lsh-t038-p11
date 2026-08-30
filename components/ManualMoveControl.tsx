"use client";

import { useMemo, useState } from "react";
import { Job, Technician } from "@/lib/engine/types";
import { ManualMoveReason } from "@/lib/engine/manualMove";
import { REASON_LABEL } from "@/lib/ui/reasonLabel";

export type MoveOutcome = { ok: true } | { ok: false; reason: ManualMoveReason } | { ok: false; error: string };
export type MovePreview = { ok: true } | { ok: false; reason: ManualMoveReason };

export default function ManualMoveControl({
  job,
  currentTechId,
  technicians,
  manualMove,
  onMove,
  previewMove,
}: {
  job: Job | null;
  currentTechId: string | null;
  technicians: Technician[];
  manualMove: { job_id: string; to_technician: string };
  onMove: (jobId: string, toTechId: string) => MoveOutcome;
  previewMove: (jobId: string, toTechId: string) => MovePreview;
}) {
  const [trackedJobId, setTrackedJobId] = useState<string | null>(null);
  const [lastOutcome, setLastOutcome] = useState<{ toTechId: string; outcome: MoveOutcome } | null>(null);

  // Reset feedback whenever a different job is selected. Done during render
  // (not an effect) so this render already reflects the cleared state.
  if ((job?.id ?? null) !== trackedJobId) {
    setTrackedJobId(job?.id ?? null);
    setLastOutcome(null);
  }

  const candidates = useMemo(
    () => technicians.filter((t) => t.id !== currentTechId),
    [technicians, currentTechId]
  );

  const previews = useMemo(() => {
    const map = new Map<string, MovePreview>();
    if (!job) return map;
    for (const tech of candidates) {
      map.set(tech.id, previewMove(job.id, tech.id));
    }
    return map;
  }, [job, candidates, previewMove]);

  if (!job) {
    return (
      <p className="text-sm text-stone-500">
        Click a job block in a timeline, or a job in the unassigned list, to reassign it — or just drag a
        job block onto another technician&apos;s row.
      </p>
    );
  }

  function handleClick(toTechId: string) {
    const outcome = onMove(job!.id, toTechId);
    setLastOutcome({ toTechId, outcome });
  }

  const scriptedTarget = job.id === manualMove.job_id ? manualMove.to_technician : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-sm font-medium text-stone-900">{job.id}</span>
        <span className="text-xs text-stone-500">
          {job.skill} · {job.area} ·{" "}
          <span className="font-mono tabular-nums">
            {job.window_start}–{job.window_end}
          </span>
        </span>
        <span className="text-xs text-stone-400">currently: {currentTechId ?? "unassigned"}</span>
        {scriptedTarget && (
          <button
            type="button"
            onClick={() => handleClick(scriptedTarget)}
            className="ml-auto rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700 ring-1 ring-inset ring-violet-200 transition-colors hover:bg-violet-100"
          >
            Run scripted move → {scriptedTarget}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {candidates.map((tech) => {
          const preview = previews.get(tech.id);
          const isFeasible = preview?.ok === true;
          return (
            <button
              key={tech.id}
              type="button"
              onClick={() => handleClick(tech.id)}
              title={isFeasible ? "Feasible" : preview && !preview.ok ? REASON_LABEL[preview.reason] : ""}
              className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 shadow-sm transition-colors hover:border-stone-300 hover:bg-stone-50"
            >
              <span className={`h-1.5 w-1.5 rounded-full ${isFeasible ? "bg-emerald-500" : "bg-rose-400"}`} />
              {tech.name}
            </button>
          );
        })}
      </div>

      <p className="text-[11px] text-stone-400">
        Tip: you can also drag this job block directly onto another technician&apos;s row.
      </p>

      {lastOutcome && (
        <div
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
            lastOutcome.outcome.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"
          }`}
        >
          {lastOutcome.outcome.ok
            ? `Moved ${job.id} to ${lastOutcome.toTechId}.`
            : "reason" in lastOutcome.outcome
              ? `Rejected: ${REASON_LABEL[lastOutcome.outcome.reason]} (${lastOutcome.outcome.reason})`
              : `Rejected: ${lastOutcome.outcome.error}`}
        </div>
      )}
    </div>
  );
}
