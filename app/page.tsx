"use client";

import Link from "next/link";
import UploadDropzone from "@/components/UploadDropzone";
import CaseSelector from "@/components/CaseSelector";
import { useSelectedCase } from "@/lib/store/useDatasetStore";

export default function Home() {
  const selectedCase = useSelectedCase();

  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-col gap-6 py-16 px-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
            Technician Dispatch Planner
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Upload the route/shift dataset to get started.
          </p>
        </div>

        <UploadDropzone />

        <CaseSelector />

        {selectedCase && (
          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              {selectedCase.case_id}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Day: {selectedCase.today}
            </p>
            <dl className="mt-4 grid grid-cols-3 gap-4 text-center">
              <div>
                <dt className="text-xs text-zinc-500 dark:text-zinc-400">Technicians</dt>
                <dd className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
                  {selectedCase.technicians.length}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500 dark:text-zinc-400">Jobs</dt>
                <dd className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
                  {selectedCase.jobs.length}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500 dark:text-zinc-400">Areas</dt>
                <dd className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
                  {selectedCase.areas.length}
                </dd>
              </div>
            </dl>
            <Link
              href="/planner"
              className="mt-4 inline-block rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-950"
            >
              View plan
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
