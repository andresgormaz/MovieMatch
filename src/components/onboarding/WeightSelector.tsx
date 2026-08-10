"use client";

const LEVELS: { value: -2 | -1 | 0 | 1 | 2; label: string }[] = [
  { value: -2, label: "😠" },
  { value: -1, label: "🙁" },
  { value: 0, label: "😐" },
  { value: 1, label: "🙂" },
  { value: 2, label: "😍" },
];

export function WeightSelector({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-2.5">
      <span className="truncate text-sm text-white">{label}</span>
      <div className="flex gap-1">
        {LEVELS.map((l) => (
          <button
            key={l.value}
            onClick={() => onChange(l.value)}
            className={`rounded-full px-2 py-1 text-base transition-colors ${
              value === l.value ? "bg-accent" : "hover:bg-surface-hover"
            }`}
            aria-label={String(l.value)}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}
