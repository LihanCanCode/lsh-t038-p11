"use client";

import { useState } from "react";
import { Technician } from "@/lib/engine/types";

const fieldClass =
  "rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-sm text-stone-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30";
const labelClass = "flex flex-col gap-1 text-xs font-medium text-stone-500";

export default function SickTechnicianForm({
  technicians,
  defaultCursor,
  onSubmit,
}: {
  technicians: Technician[];
  defaultCursor: string;
  onSubmit: (techId: string, cursor: string) => { ok: boolean; message: string };
}) {
  const [techId, setTechId] = useState(technicians[0]?.id ?? "");
  const [cursor, setCursor] = useState(defaultCursor);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  if (technicians.length === 0) {
    return <p className="text-sm text-stone-500">Every technician in this case is already marked sick.</p>;
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!techId) return;
        const result = onSubmit(techId, cursor);
        setFeedback(result);
      }}
      className="flex flex-col gap-3"
    >
      <div className="grid grid-cols-1 gap-3">
        <label className={labelClass}>
          Technician
          <select value={techId} onChange={(e) => setTechId(e.target.value)} className={fieldClass}>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.id})
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Now (cursor)
          <input type="time" required value={cursor} onChange={(e) => setCursor(e.target.value)} className={fieldClass} />
        </label>
      </div>

      <button
        type="submit"
        className="self-start rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-rose-700"
      >
        Mark sick &amp; reassign
      </button>

      {feedback && (
        <div
          className={`rounded-lg px-3 py-2 text-xs font-medium ${
            feedback.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"
          }`}
        >
          {feedback.message}
        </div>
      )}
    </form>
  );
}
