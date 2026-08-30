"use client";

import { useDatasetStore } from "@/lib/store/useDatasetStore";

export default function CaseSelector() {
  const dataset = useDatasetStore((s) => s.dataset);
  const selectedCaseId = useDatasetStore((s) => s.selectedCaseId);
  const selectCase = useDatasetStore((s) => s.selectCase);

  if (!dataset) return null;

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="case-select" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Case
      </label>
      <select
        id="case-select"
        value={selectedCaseId ?? ""}
        onChange={(e) => selectCase(e.target.value)}
        className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      >
        {dataset.cases.map((c) => (
          <option key={c.case_id} value={c.case_id}>
            {c.case_id}
          </option>
        ))}
      </select>
    </div>
  );
}
