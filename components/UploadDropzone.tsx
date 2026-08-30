"use client";

import { useCallback, useRef, useState } from "react";
import { DatasetSchema } from "@/lib/engine/types";
import { findAreaReferenceIssues } from "@/lib/engine/validate";
import { useDatasetStore } from "@/lib/store/useDatasetStore";

export default function UploadDropzone() {
  const setDataset = useDatasetStore((s) => s.setDataset);
  const setError = useDatasetStore((s) => s.setError);
  const error = useDatasetStore((s) => s.error);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        const result = DatasetSchema.safeParse(json);
        if (!result.success) {
          const issues = result.error.issues
            .slice(0, 3)
            .map((i) => `• ${i.path.join(".") || "(root)"}: ${i.message}`)
            .join("\n");
          setError(`This file doesn't match the expected dataset shape.\n${issues}`);
          return;
        }

        const areaIssuesByCase = result.data.cases
          .map((kase) => ({ caseId: kase.case_id, issues: findAreaReferenceIssues(kase) }))
          .filter((c) => c.issues.length > 0);
        if (areaIssuesByCase.length > 0) {
          const { caseId, issues } = areaIssuesByCase[0];
          const preview = issues
            .slice(0, 3)
            .map((i) => `• ${i}`)
            .join("\n");
          const more = areaIssuesByCase.length > 1 ? `\n…and ${areaIssuesByCase.length - 1} more case(s) affected.` : "";
          setError(`Case "${caseId}" has inconsistent area references.\n${preview}${more}`);
          return;
        }

        setDataset(result.data);
      } catch (e) {
        setError(
          e instanceof Error
            ? `Couldn't read this file as JSON: ${e.message}`
            : "Couldn't read this file as JSON."
        );
      }
    },
    [setDataset, setError]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFile(file);
      }}
      onClick={() => inputRef.current?.click()}
      className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-12 text-center transition-all duration-200 ${
        isDragging ? "border-violet-400 bg-violet-50/60" : "border-stone-200 bg-white hover:border-stone-300"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-50 text-violet-600 transition-transform duration-200">
        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
          <path
            d="M12 16V4m0 0-4 4m4-4 4 4M5 16.8V19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2.2"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <p className="text-sm font-medium text-stone-900">Drop the dataset JSON here, or click to browse</p>
      <p className="text-xs text-stone-400">
        Expects the P11_route_shift dataset shape ({"{ schema_version, problem_id, cases[] }"})
      </p>
      {error && (
        <p className="mt-1 whitespace-pre-line text-left text-xs font-medium text-rose-600">{error}</p>
      )}
    </div>
  );
}
