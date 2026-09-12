// Approximation, not a live theatrical listing: TMDB doesn't expose "still
// playing in theaters" directly, so this flags movies released within a
// typical exclusivity window. Series are never "in theaters".
const IN_THEATERS_WINDOW_DAYS = 45;

export function isInTheaters(type: "MOVIE" | "SERIES", releaseDate: Date | null | undefined): boolean {
  if (type !== "MOVIE" || !releaseDate) return false;
  const now = Date.now();
  const released = releaseDate.getTime();
  if (released > now) return false;
  const daysSince = (now - released) / (1000 * 60 * 60 * 24);
  return daysSince <= IN_THEATERS_WINDOW_DAYS;
}
