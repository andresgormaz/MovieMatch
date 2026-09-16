import { describe, expect, it } from "vitest";
import { localDateKey, localDayBounds, localMidnightUtc, parseTzOffsetParam } from "./localDay";

// UTC-4 (Chile, non-DST) as minutes -- Date.prototype.getTimezoneOffset()'s
// sign convention: positive for timezones behind UTC.
const SANTIAGO_OFFSET = 240;

describe("localDateKey", () => {
  it("keys an instant by the UTC calendar date when offset is 0", () => {
    expect(localDateKey(new Date("2026-09-17T02:00:00.000Z"), 0)).toBe("2026-09-17");
  });

  it("keys a late-Chile-evening instant to the same day even though UTC has already rolled over", () => {
    // 2026-09-17T02:00:00Z is 2026-09-16 22:00 in UTC-4 -- still "today"
    // (the 16th) in Chile, despite UTC already being on the 17th. This is
    // exactly the case that broke without the offset: a server computing
    // "today" from its own (UTC) clock would put this activity in the
    // *next* day's bucket instead of today's.
    expect(localDateKey(new Date("2026-09-17T02:00:00.000Z"), SANTIAGO_OFFSET)).toBe("2026-09-16");
  });

  it("keys a Chile-morning instant correctly even though it's still the previous UTC date", () => {
    // 2026-09-16T02:00:00Z is 2026-09-15 22:00 in UTC-4.
    expect(localDateKey(new Date("2026-09-16T02:00:00.000Z"), SANTIAGO_OFFSET)).toBe("2026-09-15");
  });
});

describe("localMidnightUtc", () => {
  it("returns the UTC instant for local midnight at offset 0", () => {
    expect(localMidnightUtc(2026, 9, 16, 0).toISOString()).toBe("2026-09-16T00:00:00.000Z");
  });

  it("returns the UTC instant for local midnight at a positive (behind-UTC) offset", () => {
    // Midnight in UTC-4 on the 16th is 04:00 UTC on the 16th.
    expect(localMidnightUtc(2026, 9, 16, SANTIAGO_OFFSET).toISOString()).toBe("2026-09-16T04:00:00.000Z");
  });
});

describe("localDayBounds", () => {
  it("spans exactly 24 hours", () => {
    const { start, end } = localDayBounds(SANTIAGO_OFFSET, "2026-09-16");
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("for an explicit date, brackets every instant that localDateKey would key to that date", () => {
    const { start, end } = localDayBounds(SANTIAGO_OFFSET, "2026-09-16");
    const lateEvening = new Date("2026-09-17T02:00:00.000Z"); // Chile 2026-09-16 22:00
    const earlyMorning = new Date("2026-09-16T04:00:00.000Z"); // Chile 2026-09-16 00:00 exactly
    const justBefore = new Date("2026-09-16T03:59:59.999Z"); // Chile 2026-09-15 23:59:59.999
    expect(lateEvening.getTime() >= start.getTime() && lateEvening.getTime() < end.getTime()).toBe(true);
    expect(earlyMorning.getTime() >= start.getTime() && earlyMorning.getTime() < end.getTime()).toBe(true);
    expect(justBefore.getTime() >= start.getTime() && justBefore.getTime() < end.getTime()).toBe(false);
  });

  it("without a dateKey, uses today in the given offset (not the process's own timezone)", () => {
    const { start, end } = localDayBounds(SANTIAGO_OFFSET);
    const now = new Date();
    expect(now.getTime()).toBeGreaterThanOrEqual(start.getTime());
    expect(now.getTime()).toBeLessThan(end.getTime());
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });
});

describe("parseTzOffsetParam", () => {
  it("parses a numeric string", () => {
    expect(parseTzOffsetParam("240")).toBe(240);
    expect(parseTzOffsetParam("-120")).toBe(-120);
    expect(parseTzOffsetParam("0")).toBe(0);
  });

  it("defaults to 0 (UTC) for missing or invalid input", () => {
    expect(parseTzOffsetParam(null)).toBe(0);
    expect(parseTzOffsetParam("")).toBe(0);
    expect(parseTzOffsetParam("not-a-number")).toBe(0);
  });
});
