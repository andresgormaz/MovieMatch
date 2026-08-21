"use client";

import { WATCH_PROGRESS_OPTIONS, type WatchProgress } from "@/lib/seriesStatus";

// Required step before a series can be marked "seen" anywhere in the app --
// shown in place of (before) the star picker until an answer is given, then
// stays out of the way for the actual rating. Movies never show this.
export function SeriesWatchProgressPicker({
  onPick,
  disabled = false,
}: {
  onPick: (value: WatchProgress) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-center text-xs text-muted">¿Cómo vas con esta serie?</p>
      <div className="flex flex-wrap justify-center gap-1.5">
        {WATCH_PROGRESS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onPick(opt.value)}
            className="rounded-md border border-white/15 px-3 py-2 text-xs font-medium text-neutral-300 transition-colors hover:border-accent hover:bg-accent hover:text-white disabled:opacity-50"
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
