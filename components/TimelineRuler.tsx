import { minutesToHhmm } from "@/lib/engine/time";

// Renders hour tick marks across [startMinutes, endMinutes]. The caller must
// use the same range when laying out timeline rows so the ticks line up.
export default function TimelineRuler({
  startMinutes,
  endMinutes,
}: {
  startMinutes: number;
  endMinutes: number;
}) {
  const total = Math.max(endMinutes - startMinutes, 1);
  const firstHour = Math.ceil(startMinutes / 60) * 60;
  const ticks: number[] = [];
  for (let t = firstHour; t <= endMinutes; t += 60) ticks.push(t);

  return (
    <div className="relative h-4 w-full select-none">
      {ticks.map((t) => (
        <span
          key={t}
          className="absolute top-0 -translate-x-1/2 font-mono text-[10px] tabular-nums text-stone-400"
          style={{ left: `${((t - startMinutes) / total) * 100}%` }}
        >
          {minutesToHhmm(t)}
        </span>
      ))}
    </div>
  );
}
