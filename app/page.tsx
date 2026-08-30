"use client";

import Link from "next/link";
import UploadDropzone from "@/components/UploadDropzone";
import CaseSelector from "@/components/CaseSelector";
import StatCard from "@/components/StatCard";
import { useSelectedCase } from "@/lib/store/useDatasetStore";

export default function Home() {
  const selectedCase = useSelectedCase();

  return (
    <div className="flex flex-1 flex-col items-center bg-gradient-to-b from-zinc-50 to-zinc-100 font-sans dark:from-black dark:to-zinc-950">
      <main className="flex w-full max-w-2xl flex-col gap-8 py-20 px-6">
        <div className="text-center">
          <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white/70 px-3 py-1 text-xs font-medium text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
            Technician Dispatch Planner
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Plan the day&apos;s routes in seconds
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Upload the route/shift dataset and pick a case to generate an assignment plan.
          </p>
        </div>

        <UploadDropzone />

        {selectedCase && (
          <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200/70 bg-white/80 p-6 shadow-sm dark:border-zinc-800/70 dark:bg-zinc-950/60">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                  {selectedCase.case_id}
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{selectedCase.today}</p>
              </div>
              <CaseSelector />
            </div>

            <dl className="grid grid-cols-3 gap-3">
              <StatCard label="Technicians" value={selectedCase.technicians.length} />
              <StatCard label="Jobs" value={selectedCase.jobs.length} />
              <StatCard label="Areas" value={selectedCase.areas.length} />
            </dl>

            <Link
              href="/planner"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
            >
              View plan
              <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                <path
                  d="M4 10h12m0 0-5-5m5 5-5 5"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
