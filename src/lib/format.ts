// Presentational rounding for raw preference scores -- most contributions
// are whole numbers, but the "similar" boost's 6th-10th-place tier adds 0.5,
// so scores can come out fractional. Round to one decimal instead of
// showing float noise, and keep whole numbers clean.
export function formatScore(score: number): string {
  const rounded = Math.round(score * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

// Same, but with an explicit "+" on positive values -- for breakdown lines
// where the sign of each contribution needs to be unambiguous at a glance.
export function formatSignedScore(score: number): string {
  const formatted = formatScore(score);
  return score > 0 ? `+${formatted}` : formatted;
}
