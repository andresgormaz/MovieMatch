// Day-boundary math for a caregiver's actual calendar day, not whatever
// timezone the server process happens to run in. Vercel's Node runtime has
// no family-specific timezone configured, so a server-side `new
// Date().getFullYear()`-style computation silently uses UTC -- for a family
// well behind UTC (e.g. Chile, UTC-3/-4), that's wrong for a chunk of every
// evening: once UTC has already rolled over to the next calendar date but
// it's still "today" locally, "today's" query window shifts out from under
// whatever was just logged, and it silently doesn't show up until the
// *server's* day catches up. Every route that buckets activities by day
// takes the caregiver's UTC offset (minutes, exactly what the browser's own
// `Date.prototype.getTimezoneOffset()` returns) as a query param and uses
// these helpers instead of the server's own local-time getters.

// Shifts `date` by `offsetMinutes` so that reading its *UTC* components back
// off the result gives the wall-clock date/time in the caregiver's own
// timezone -- sidesteps ever needing the server to know real IANA timezone
// rules, at the cost of not tracking DST transitions exactly at the instant
// they happen (irrelevant here: this only ever needs "which offset does the
// browser report right now").
function shiftToLocal(date: Date, offsetMinutes: number): Date {
  return new Date(date.getTime() - offsetMinutes * 60_000);
}

// The "YYYY-MM-DD" the given instant falls on on a caregiver's own calendar.
export function localDateKey(date: Date, offsetMinutes: number): string {
  const shifted = shiftToLocal(date, offsetMinutes);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}

// The real-world (UTC) instant of local midnight on the given Y-M-D.
export function localMidnightUtc(year: number, month: number, day: number, offsetMinutes: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) + offsetMinutes * 60_000);
}

// [start, end) for "today" (or, with a dateKey, that specific "YYYY-MM-DD")
// in the caregiver's own timezone.
export function localDayBounds(offsetMinutes: number, dateKey?: string): { start: Date; end: Date } {
  const key = dateKey ?? localDateKey(new Date(), offsetMinutes);
  const [year, month, day] = key.split("-").map(Number);
  const start = localMidnightUtc(year, month, day, offsetMinutes);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

// Parses the `tz` query param (the caregiver's UTC offset in minutes, as
// sent by the client) -- 0 (UTC) if missing or not a finite number, which
// keeps every route's old behavior for any caller that hasn't been updated
// to send it yet.
export function parseTzOffsetParam(value: string | null): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
