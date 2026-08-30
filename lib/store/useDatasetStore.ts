import { create } from "zustand";
import { Case, Dataset } from "@/lib/engine/types";

type DatasetStore = {
  dataset: Dataset | null;
  selectedCaseId: string | null;
  error: string | null;
  setDataset: (dataset: Dataset) => void;
  setError: (error: string | null) => void;
  selectCase: (caseId: string) => void;
};

export const useDatasetStore = create<DatasetStore>((set) => ({
  dataset: null,
  selectedCaseId: null,
  error: null,
  setDataset: (dataset) =>
    set({
      dataset,
      selectedCaseId: dataset.cases[0]?.case_id ?? null,
      error: null,
    }),
  setError: (error) => set({ error, dataset: null, selectedCaseId: null }),
  selectCase: (caseId) => set({ selectedCaseId: caseId }),
}));

export function useSelectedCase(): Case | null {
  const dataset = useDatasetStore((s) => s.dataset);
  const selectedCaseId = useDatasetStore((s) => s.selectedCaseId);
  if (!dataset || !selectedCaseId) return null;
  return dataset.cases.find((c) => c.case_id === selectedCaseId) ?? null;
}
