"use client";

import { useDatasetStore } from "@/lib/store/useDatasetStore";

export default function CaseSelector() {
  const dataset = useDatasetStore((s) => s.dataset);
  const selectedCaseId = useDatasetStore((s) => s.selectedCaseId);
  const selectCase = useDatasetStore((s) => s.selectCase);

  if (!dataset) return null;

  if (dataset.cases.length === 0) {
    return (
      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
        File loaded, but it has no cases
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="case-select"
        className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
      >
        Case
      </label>
      <div className="relative">
        <select
          id="case-select"
          value={selectedCaseId ?? ""}
          onChange={(e) => selectCase(e.target.value)}
          className="appearance-none rounded-lg border border-zinc-200 bg-white py-2 pl-3 pr-9 text-sm font-medium text-zinc-900 shadow-sm transition-colors hover:border-zinc-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-600"
        >
          {dataset.cases.map((c) => (
            <option key={c.case_id} value={c.case_id}>
              {c.case_id}
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
    </div>
  );
}
