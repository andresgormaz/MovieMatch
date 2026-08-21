"use client";

const STARS = [1, 2, 3, 4, 5];

// How lit-up a filled star looks scales with how good the rating is: 1-2
// stars stay noticeably dimmer, 3 is the bright baseline, and 4-5 add an
// increasingly bigger "star-pop" animation (see globals.css) so a great
// rating visibly feels like one instead of looking identical to a so-so one.
function glowClass(score: number) {
  if (score <= 2) {
    return "border-yellow-400/60 bg-yellow-500/15 text-yellow-400/90 shadow-[0_0_8px_rgba(250,204,21,0.4)]";
  }
  if (score === 3) {
    return "border-yellow-300 bg-yellow-400/30 text-yellow-300 shadow-[0_0_18px_rgba(250,204,21,0.85)]";
  }
  if (score === 4) {
    return "star-pop border-yellow-200 bg-yellow-400/35 text-yellow-200 shadow-[0_0_26px_rgba(250,204,21,1)]";
  }
  return "star-pop-big border-yellow-100 bg-yellow-300/40 text-yellow-100 shadow-[0_0_20px_rgba(250,204,21,1),0_0_46px_rgba(250,204,21,0.6)]";
}

// Interactive 1-5 star picker -- the single input every rating surface in
// the app uses now, so "how do I rate something" always looks and behaves
// the same regardless of which screen it's on. `selected`, when set, lights
// up that many stars in gold -- used to confirm a tap actually registered
// the right count before whatever happens next (e.g. the card disappearing).
export function StarRating({
  onRate,
  disabled = false,
  size = "md",
  selected,
}: {
  onRate: (score: number) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  selected?: number;
}) {
  const starClass = size === "sm" ? "h-7 w-7 text-lg" : "h-9 w-9 text-xl";
  return (
    <div className="flex gap-1">
      {STARS.map((s) => {
        const filled = selected !== undefined && s <= selected;
        return (
          <button
            key={s}
            type="button"
            disabled={disabled}
            onClick={() => onRate(s)}
            aria-label={`${s} estrella${s > 1 ? "s" : ""}`}
            className={`flex ${starClass} items-center justify-center rounded-md border transition-colors duration-150 disabled:opacity-50 ${
              filled
                ? glowClass(selected!)
                : "border-white/15 text-neutral-500 hover:border-accent hover:bg-accent hover:text-white"
            }`}
          >
            ★
          </button>
        );
      })}
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
