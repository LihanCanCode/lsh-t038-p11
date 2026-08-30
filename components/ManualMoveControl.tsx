"use client";

import { useState } from "react";
import { Job, Technician } from "@/lib/engine/types";
import { REASON_LABEL } from "@/lib/ui/reasonLabel";

export type MoveOutcome =
  | { ok: true }
  | { ok: false; reason: "SKILL_MISMATCH" | "OUTSIDE_SHIFT" | "WINDOW_UNREACHABLE" | "BUMPS_LATER_JOB" }
  | { ok: false; error: string };

export default function ManualMoveControl({
  job,
  currentTechId,
  technicians,
  manualMove,
  onMove,
}: {
  job: Job | null;
  currentTechId: string | null;
  technicians: Technician[];
  manualMove: { job_id: string; to_technician: string };
  onMove: (jobId: string, toTechId: string) => MoveOutcome;
}) {
  const [trackedJobId, setTrackedJobId] = useState<string | null>(null);
  const [toTechId, setToTechId] = useState("");
  const [lastOutcome, setLastOutcome] = useState<{ jobId: string; toTechId: string; outcome: MoveOutcome } | null>(
    null
  );

  // Reset the form whenever a different job is selected. Done during render
  // (not an effect) so this render already reflects the cleared state.
  if ((job?.id ?? null) !== trackedJobId) {
    setTrackedJobId(job?.id ?? null);
    setToTechId("");
    setLastOutcome(null);
  }

  const scriptedJob = job?.id === manualMove.job_id;

  function runMove(targetId: string) {
    if (!job || !targetId) return;
    const outcome = onMove(job.id, targetId);
    setLastOutcome({ jobId: job.id, toTechId: targetId, outcome });
  }

  return (
    <div className="flex flex-col gap-3">
      {!job ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Click a job block in a timeline, or a job in the unassigned list, to reassign it.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="font-medium text-zinc-900 dark:text-zinc-100">{job.id}</span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {job.skill} · {job.area} · {job.window_start}–{job.window_end}
            </span>
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              currently: {currentTechId ?? "unassigned"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <select
                value={toTechId}
                onChange={(e) => setToTechId(e.target.value)}
                className="appearance-none rounded-lg border border-zinc-200 bg-white py-2 pl-3 pr-9 text-sm font-medium text-zinc-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              >
                <option value="" disabled>
                  Move to technician…
                </option>
                {technicians
                  .filter((t) => t.id !== currentTechId)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.id})
                    </option>
                  ))}
              </select>
              <svg
                viewBox="0 0 20 20"
                fill="none"
                className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
              >
                <path d="M5.5 7.5 10 12l4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <button
              type="button"
              disabled={!toTechId}
              onClick={() => runMove(toTechId)}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Move
            </button>

            {scriptedJob && (
              <button
                type="button"
                onClick={() => {
                  setToTechId(manualMove.to_technician);
                  runMove(manualMove.to_technician);
                }}
                className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 shadow-sm transition-colors hover:bg-indigo-100 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-300"
              >
                Run scripted move → {manualMove.to_technician}
              </button>
            )}
          </div>

          {lastOutcome && lastOutcome.jobId === job.id && (
            <div
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
                lastOutcome.outcome.ok
                  ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
                  : "bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300"
              }`}
            >
              {lastOutcome.outcome.ok
                ? `Moved ${lastOutcome.jobId} to ${lastOutcome.toTechId}.`
                : "reason" in lastOutcome.outcome
                  ? `Rejected: ${REASON_LABEL[lastOutcome.outcome.reason]} (${lastOutcome.outcome.reason})`
                  : `Rejected: ${lastOutcome.outcome.error}`}
            </div>
          )}
        </>
      )}
    </div>
  );
}
