"use client";

const STARS = [1, 2, 3, 4, 5];

// Interactive 1-5 star picker -- the single input every rating surface in
// the app uses now, so "how do I rate something" always looks and behaves
// the same regardless of which screen it's on.
export function StarRating({
  onRate,
  disabled = false,
  size = "md",
}: {
  onRate: (score: number) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const starClass = size === "sm" ? "h-7 w-7 text-lg" : "h-9 w-9 text-xl";
  return (
    <div className="flex gap-1">
      {STARS.map((s) => (
        <button
          key={s}
          type="button"
          disabled={disabled}
          onClick={() => onRate(s)}
          aria-label={`${s} estrella${s > 1 ? "s" : ""}`}
          className={`flex ${starClass} items-center justify-center rounded-md border border-white/15 text-neutral-500 transition-colors hover:border-accent hover:bg-accent hover:text-white disabled:opacity-50`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

// Read-only display of a saved score, e.g. "★★★☆☆".
export function StarDisplay({ score, className = "" }: { score: number; className?: string }) {
  return (
    <span className={`tracking-tight ${className}`} aria-label={`${score} de 5 estrellas`}>
      {STARS.map((s) => (
        <span key={s} className={s <= score ? "text-accent-hover" : "text-neutral-700"}>
          ★
        </span>
      ))}
    </span>
  );
}
