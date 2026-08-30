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
          setError(
            `Invalid file: ${result.error.issues
              .slice(0, 3)
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("; ")}`
          );
          return;
        }
        setDataset(result.data);
      } catch (e) {
        setError(e instanceof Error ? `Could not parse file: ${e.message}` : "Could not parse file.");
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
      className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
        isDragging
          ? "border-zinc-950 bg-zinc-100 dark:border-zinc-50 dark:bg-zinc-900"
          : "border-zinc-300 dark:border-zinc-700"
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
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        Drop the dataset JSON here, or click to browse
      </p>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Expects the P11_route_shift dataset shape ({"{ schema_version, problem_id, cases[] }"})
      </p>
      {error && (
        <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
