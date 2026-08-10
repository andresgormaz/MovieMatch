export function ProgressBar({ value, total, label }: { value: number; total: number; label: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className="w-full">
      <div className="mb-1 flex justify-between text-xs text-neutral-500">
        <span>{label}</span>
        <span>
          {value}
          {total > 0 ? ` / ${total}` : ""}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
        <div className="h-full rounded-full bg-white transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
