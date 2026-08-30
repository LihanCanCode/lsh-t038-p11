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
    accent === "positive" ? "text-emerald-600" : accent === "negative" ? "text-rose-600" : "text-stone-900";

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-stone-400">{label}</dt>
      <dd className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${valueColor}`}>{value}</dd>
    </div>
  );
}
