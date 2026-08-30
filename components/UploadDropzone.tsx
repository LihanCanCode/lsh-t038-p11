"use client";

import { useCallback, useRef, useState } from "react";
import { DatasetSchema } from "@/lib/engine/types";
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
      className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-12 text-center transition-colors ${
        isDragging
          ? "border-indigo-500 bg-indigo-50/60 dark:border-indigo-400 dark:bg-indigo-950/20"
          : "border-zinc-300 bg-white/60 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950/40 dark:hover:border-zinc-600"
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
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600/10 text-indigo-600 dark:bg-indigo-400/10 dark:text-indigo-400">
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
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        Drop the dataset JSON here, or click to browse
      </p>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Expects the P11_route_shift dataset shape ({"{ schema_version, problem_id, cases[] }"})
      </p>
      {error && (
        <p className="mt-1 whitespace-pre-line text-left text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
