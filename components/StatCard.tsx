export default function StatCard({
  label,
  value,
  accent = "default",
}: {
  label: string;
  value: string | number;
  accent?: "default" | "positive" | "negative";
}) {
  const valueColor =
    accent === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : accent === "negative"
        ? "text-red-600 dark:text-red-400"
        : "text-zinc-950 dark:text-zinc-50";

  return (
    <div className="rounded-xl border border-zinc-200/70 bg-white/80 p-4 shadow-sm dark:border-zinc-800/70 dark:bg-zinc-950/60">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </dt>
      <dd className={`mt-1 text-2xl font-semibold tabular-nums ${valueColor}`}>{value}</dd>
    </div>
  );
}
