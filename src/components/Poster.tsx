// Deterministic gradient placeholder for titles without a TMDB poster image,
// so the catalog still looks like a real poster wall before a TMDB API key
// is configured.
const PALETTES: [string, string][] = [
  ["#7f1d1d", "#0a0a0a"],
  ["#3b0764", "#0a0a0a"],
  ["#1e3a8a", "#0a0a0a"],
  ["#064e3b", "#0a0a0a"],
  ["#78350f", "#0a0a0a"],
  ["#831843", "#0a0a0a"],
  ["#312e81", "#0a0a0a"],
  ["#134e4a", "#0a0a0a"],
  ["#7c2d12", "#0a0a0a"],
  ["#1e1b4b", "#0a0a0a"],
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function Poster({
  name,
  posterUrl,
  type = "MOVIE",
  className = "",
}: {
  name: string;
  posterUrl?: string | null;
  type?: "MOVIE" | "SERIES";
  className?: string;
}) {
  if (posterUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={posterUrl}
        alt={name}
        loading="lazy"
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }

  const [from, to] = PALETTES[hashString(name) % PALETTES.length];

  return (
    <div
      className={`relative flex h-full w-full items-end overflow-hidden ${className}`}
      style={{ backgroundImage: `linear-gradient(160deg, ${from}, ${to})` }}
    >
      <span className="absolute top-2 right-2 text-base opacity-70">
        {type === "MOVIE" ? "🎬" : "📺"}
      </span>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
      <span className="relative z-10 line-clamp-4 p-2.5 text-[13px] font-semibold leading-tight text-white/95">
        {name}
      </span>
    </div>
  );
}
