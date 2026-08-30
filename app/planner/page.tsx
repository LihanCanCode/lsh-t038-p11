"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSelectedCase } from "@/lib/store/useDatasetStore";
import { buildPlan } from "@/lib/engine/assign";
import TechnicianTimeline from "@/components/TechnicianTimeline";
import UnassignedList from "@/components/UnassignedList";

export default function PlannerPage() {
  const kase = useSelectedCase();
  const plan = useMemo(() => (kase ? buildPlan(kase) : null), [kase]);
  const jobsById = useMemo(
    () => new Map((kase?.jobs ?? []).map((job) => [job.id, job])),
    [kase]
  );

  if (!kase || !plan) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">No case loaded yet.</p>
        <Link href="/" className="text-sm font-medium text-zinc-950 underline dark:text-zinc-50">
          Go upload a dataset
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 dark:bg-black">
      <main className="flex w-full max-w-4xl flex-col gap-6 py-10 px-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">{kase.case_id}</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{kase.today}</p>
          </div>
          <Link href="/" className="text-sm font-medium text-zinc-700 underline dark:text-zinc-300">
            Change case
          </Link>
        </div>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Technician timelines
          </h2>
          <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-900">
            {kase.technicians.map((tech) => (
              <TechnicianTimeline
                key={tech.id}
                technician={tech}
                entries={plan.routes[tech.id] ?? []}
              />
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Unassigned jobs ({plan.unassigned.length})
          </h2>
          <UnassignedList unassigned={plan.unassigned} jobsById={jobsById} />
        </section>
      </main>
    </div>
  );
}
