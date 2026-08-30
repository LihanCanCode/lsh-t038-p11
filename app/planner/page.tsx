"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSelectedCase } from "@/lib/store/useDatasetStore";
import { buildPlan } from "@/lib/engine/assign";
import { applyManualMove } from "@/lib/engine/manualMove";
import { Plan } from "@/lib/engine/types";
import { hhmmToMinutes } from "@/lib/engine/time";
import CaseSelector from "@/components/CaseSelector";
import TechnicianTimeline from "@/components/TechnicianTimeline";
import TimelineRuler from "@/components/TimelineRuler";
import UnassignedList from "@/components/UnassignedList";
import SkillLegend from "@/components/SkillLegend";
import StatCard from "@/components/StatCard";
import ManualMoveControl, { MoveOutcome, MovePreview } from "@/components/ManualMoveControl";

export default function PlannerPage() {
  const kase = useSelectedCase();
  const [planCaseId, setPlanCaseId] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // Rebuild the plan whenever the selected case changes. Done during render
  // (not an effect) so the freshly-built plan is used for this render.
  // buildPlan can throw on malformed engine input (e.g. an area reference
  // getTravel can't resolve) — caught here so a bad case can never take down
  // the whole page with an uncaught exception.
  if ((kase?.case_id ?? null) !== planCaseId) {
    setPlanCaseId(kase?.case_id ?? null);
    setSelectedJobId(null);
    if (!kase) {
      setPlan(null);
      setPlanError(null);
    } else {
      try {
        setPlan(buildPlan(kase));
        setPlanError(null);
      } catch (e) {
        setPlan(null);
        setPlanError(e instanceof Error ? e.message : "Unknown error building this plan.");
      }
    }
  }

  const jobsById = useMemo(
    () => new Map((kase?.jobs ?? []).map((job) => [job.id, job])),
    [kase]
  );

  const stats = useMemo(() => {
    if (!kase || !plan) return null;
    const assigned = Object.values(plan.routes).reduce((sum, r) => sum + r.length, 0);
    const totalTravel = Object.values(plan.routes)
      .flat()
      .reduce((sum, entry) => sum + entry.travelFromPrev, 0);
    return { assigned, unassigned: plan.unassigned.length, totalTravel };
  }, [kase, plan]);

  const skills = useMemo(
    () => Array.from(new Set((kase?.jobs ?? []).map((job) => job.skill))).sort(),
    [kase]
  );

  const globalRange = useMemo(() => {
    const technicians = kase?.technicians ?? [];
    if (technicians.length === 0) return { start: 0, end: 24 * 60 };
    return {
      start: Math.min(...technicians.map((t) => hhmmToMinutes(t.shift_start))),
      end: Math.max(...technicians.map((t) => hhmmToMinutes(t.shift_end))),
    };
  }, [kase]);

  const currentTechIdOf = (jobId: string): string | null => {
    if (!plan) return null;
    for (const [techId, route] of Object.entries(plan.routes)) {
      if (route.some((e) => e.job.id === jobId)) return techId;
    }
    return null;
  };

  function handleMove(jobId: string, toTechId: string): MoveOutcome {
    if (!plan || !kase) return { ok: false, error: "No plan loaded." };
    try {
      const result = applyManualMove(plan, jobId, toTechId, kase);
      if (result.ok) {
        setPlan(result.newPlan);
        return { ok: true };
      }
      return { ok: false, reason: result.reason };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
  }

  function previewMove(jobId: string, toTechId: string): MovePreview {
    if (!plan || !kase) return { ok: false, reason: "OUTSIDE_SHIFT" };
    try {
      const result = applyManualMove(plan, jobId, toTechId, kase);
      return result.ok ? { ok: true } : { ok: false, reason: result.reason };
    } catch {
      return { ok: false, reason: "OUTSIDE_SHIFT" };
    }
  }

  if (planError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
        <p className="max-w-md text-sm text-rose-600">Couldn&apos;t build a plan for this case: {planError}</p>
        <Link href="/" className="text-sm font-medium text-violet-600 underline-offset-4 hover:underline">
          Go pick a different case
        </Link>
      </div>
    );
  }

  if (!kase || !plan || !stats) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
        <p className="text-sm text-stone-500">No case loaded yet.</p>
        <Link href="/" className="text-sm font-medium text-violet-600 underline-offset-4 hover:underline">
          Go upload a dataset
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center">
      <main className="flex w-full max-w-4xl flex-col gap-6 py-10 px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-stone-400">
              <Link href="/" className="hover:text-violet-600">
                Dispatch Planner
              </Link>
              <span>/</span>
              <span className="font-mono tabular-nums">{kase.today}</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{kase.case_id}</h1>
          </div>
          <CaseSelector />
        </div>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Technicians" value={kase.technicians.length} />
          <StatCard label="Assigned" value={`${stats.assigned}/${kase.jobs.length}`} accent="positive" />
          <StatCard
            label="Unassigned"
            value={stats.unassigned}
            accent={stats.unassigned > 0 ? "negative" : "default"}
          />
          <StatCard label="Total travel" value={`${stats.totalTravel}m`} />
        </dl>

        <section className="rounded-2xl border border-stone-200 bg-white p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">
              Technician timelines
            </h2>
            <SkillLegend skills={skills} />
          </div>
          <div className="px-2">
            <TimelineRuler startMinutes={globalRange.start} endMinutes={globalRange.end} />
          </div>
          <div className="flex flex-col divide-y divide-stone-100">
            {kase.technicians.map((tech) => (
              <TechnicianTimeline
                key={tech.id}
                technician={tech}
                entries={plan.routes[tech.id] ?? []}
                globalStart={globalRange.start}
                globalEnd={globalRange.end}
                selectedJobId={selectedJobId}
                onSelectJob={setSelectedJobId}
              />
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-400">
            Reassign a job
          </h2>
          <ManualMoveControl
            job={selectedJobId ? jobsById.get(selectedJobId) ?? null : null}
            currentTechId={selectedJobId ? currentTechIdOf(selectedJobId) : null}
            technicians={kase.technicians}
            manualMove={kase.manual_move}
            onMove={handleMove}
            previewMove={previewMove}
          />
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-400">
            Unassigned jobs ({plan.unassigned.length})
          </h2>
          <UnassignedList unassigned={plan.unassigned} jobsById={jobsById} onSelectJob={setSelectedJobId} />
        </section>
      </main>
    </div>
  );
}
