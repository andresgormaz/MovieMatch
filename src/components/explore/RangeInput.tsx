"use client";

export function RangeInput({
  label,
  from,
  to,
  onChange,
  step = 1,
  min,
  max,
}: {
  label: string;
  from: number | "";
  to: number | "";
  onChange: (from: number | "", to: number | "") => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-muted">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={from}
          step={step}
          min={min}
          max={max}
          placeholder="Desde"
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value), to)}
          className="w-full rounded-md border border-white/15 bg-black/40 px-2.5 py-2 text-sm outline-none focus:border-accent"
        />
        <span className="text-muted">–</span>
        <input
          type="number"
          value={to}
          step={step}
          min={min}
          max={max}
          placeholder="Hasta"
          onChange={(e) => onChange(from, e.target.value === "" ? "" : Number(e.target.value))}
          className="w-full rounded-md border border-white/15 bg-black/40 px-2.5 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
    </div>
  );
}
