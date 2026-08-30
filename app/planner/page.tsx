"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSelectedCase } from "@/lib/store/useDatasetStore";
import { buildPlan } from "@/lib/engine/assign";
import { applyManualMove } from "@/lib/engine/manualMove";
import { Plan } from "@/lib/engine/types";
import CaseSelector from "@/components/CaseSelector";
import TechnicianTimeline from "@/components/TechnicianTimeline";
import UnassignedList from "@/components/UnassignedList";
import SkillLegend from "@/components/SkillLegend";
import StatCard from "@/components/StatCard";
import ManualMoveControl, { MoveOutcome } from "@/components/ManualMoveControl";

export default function PlannerPage() {
  const kase = useSelectedCase();
  const [planCaseId, setPlanCaseId] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // Rebuild the plan whenever the selected case changes. Done during render
  // (not an effect) so the freshly-built plan is used for this render.
  if ((kase?.case_id ?? null) !== planCaseId) {
    setPlanCaseId(kase?.case_id ?? null);
    setPlan(kase ? buildPlan(kase) : null);
    setSelectedJobId(null);
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

  if (!kase || !plan || !stats) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">No case loaded yet.</p>
        <Link
          href="/"
          className="text-sm font-medium text-indigo-600 underline-offset-4 hover:underline dark:text-indigo-400"
        >
          Go upload a dataset
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center bg-gradient-to-b from-zinc-50 to-zinc-100 dark:from-black dark:to-zinc-950">
      <main className="flex w-full max-w-4xl flex-col gap-6 py-10 px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              <Link href="/" className="hover:text-indigo-600 dark:hover:text-indigo-400">
                Dispatch Planner
              </Link>
              <span>/</span>
              <span>{kase.today}</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {kase.case_id}
            </h1>
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

        <section className="rounded-2xl border border-zinc-200/70 bg-white/80 p-5 shadow-sm dark:border-zinc-800/70 dark:bg-zinc-950/60">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Technician timelines
            </h2>
            <SkillLegend skills={skills} />
          </div>
          <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-900">
            {kase.technicians.map((tech) => (
              <TechnicianTimeline
                key={tech.id}
                technician={tech}
                entries={plan.routes[tech.id] ?? []}
                selectedJobId={selectedJobId}
                onSelectJob={setSelectedJobId}
              />
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200/70 bg-white/80 p-5 shadow-sm dark:border-zinc-800/70 dark:bg-zinc-950/60">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Reassign a job
          </h2>
          <ManualMoveControl
            job={selectedJobId ? jobsById.get(selectedJobId) ?? null : null}
            currentTechId={selectedJobId ? currentTechIdOf(selectedJobId) : null}
            technicians={kase.technicians}
            manualMove={kase.manual_move}
            onMove={handleMove}
          />
        </section>

        <section className="rounded-2xl border border-zinc-200/70 bg-white/80 p-5 shadow-sm dark:border-zinc-800/70 dark:bg-zinc-950/60">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Unassigned jobs ({plan.unassigned.length})
          </h2>
          <UnassignedList
            unassigned={plan.unassigned}
            jobsById={jobsById}
            onSelectJob={setSelectedJobId}
          />
        </section>
      </main>
    </div>
  );
}
