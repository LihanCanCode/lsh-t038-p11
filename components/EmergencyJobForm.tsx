"use client";

import { useState } from "react";

export type EmergencyJobInput = {
  area: string;
  skill: string;
  duration_minutes: number;
  window_start: string;
  window_end: string;
  cursor: string;
};

const fieldClass =
  "rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-sm text-stone-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30";
const labelClass = "flex flex-col gap-1 text-xs font-medium text-stone-500";

export default function EmergencyJobForm({
  areas,
  defaultCursor,
  onSubmit,
}: {
  areas: string[];
  defaultCursor: string;
  onSubmit: (input: EmergencyJobInput) => { ok: boolean; message: string };
}) {
  const [area, setArea] = useState(areas[0] ?? "");
  const [skill, setSkill] = useState("");
  const [duration, setDuration] = useState(30);
  const [windowStart, setWindowStart] = useState("09:00");
  const [windowEnd, setWindowEnd] = useState("17:00");
  const [cursor, setCursor] = useState(defaultCursor);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!area || !skill.trim()) return;
        setFeedback(
          onSubmit({
            area,
            skill: skill.trim(),
            duration_minutes: duration,
            window_start: windowStart,
            window_end: windowEnd,
            cursor,
          })
        );
      }}
      className="flex flex-col gap-3"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className={labelClass}>
          Now (cursor)
          <input type="time" required value={cursor} onChange={(e) => setCursor(e.target.value)} className={fieldClass} />
        </label>
        <label className={labelClass}>
          Area
          <select value={area} onChange={(e) => setArea(e.target.value)} className={fieldClass}>
            {areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Skill
          <input
            value={skill}
            onChange={(e) => setSkill(e.target.value)}
            placeholder="e.g. plumbing"
            required
            className={fieldClass}
          />
        </label>
        <label className={labelClass}>
          Duration (min)
          <input
            type="number"
            min={5}
            step={5}
            required
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className={fieldClass}
          />
        </label>
        <label className={labelClass}>
          Window start
          <input type="time" required value={windowStart} onChange={(e) => setWindowStart(e.target.value)} className={fieldClass} />
        </label>
        <label className={labelClass}>
          Window end
          <input type="time" required value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} className={fieldClass} />
        </label>
      </div>

      <button
        type="submit"
        className="self-start rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-violet-700"
      >
        Inject emergency job &amp; replan
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
