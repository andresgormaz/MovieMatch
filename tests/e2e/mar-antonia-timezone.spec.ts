import { execFileSync } from "node:child_process";
import { test, expect, type Page } from "@playwright/test";

const PASSWORD = "Test1234!";
// Chile (non-DST), as minutes -- Date.prototype.getTimezoneOffset()'s sign
// convention: positive for timezones behind UTC.
const SANTIAGO_OFFSET = "240";

function runFixture(...args: string[]): string {
  return execFileSync("npx", ["tsx", "tests/e2e/fixtures/seed.ts", ...args], { encoding: "utf8" });
}

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => url.pathname === "/");
}

test.describe("MarAntonia day-boundary math respects the caregiver's own timezone", () => {
  test("an activity from Chile's evening (already tomorrow in UTC) shows under the right Chile day, not split across two", async ({
    page,
  }) => {
    const email = "e2e-marantonia-tz@example.com";
    const output = runFixture("create-with-child", email, "Bebé Zona Horaria", "MAMA");
    const { childId, ownerUserId } = JSON.parse(output.trim().split("\n").pop()!) as {
      childId: string;
      ownerUserId: string;
    };

    // Both fall on Chile's September 16th (UTC-4), but on two different UTC
    // calendar dates -- exactly the case that broke without a client-sent
    // timezone offset: a server bucketing "today" using its own (UTC) clock
    // would split these into two different days, or drop the evening one
    // out of "today" entirely once UTC ticked over.
    const chileEvening = "2026-09-17T02:00:00.000Z"; // Chile 2026-09-16 22:00
    const chileMorning = "2026-09-16T15:00:00.000Z"; // Chile 2026-09-16 11:00
    runFixture("add-activity", childId, ownerUserId, "MEAL", chileEvening, "mealQuality", "GOOD");
    runFixture("add-activity", childId, ownerUserId, "MEAL", chileMorning, "mealQuality", "REGULAR");

    try {
      await login(page, email);

      const sept16 = await page.request.get(
        `/api/mar-antonia/activities?date=2026-09-16&tz=${SANTIAGO_OFFSET}`,
      );
      const { activities: sept16Activities } = await sept16.json();
      expect(sept16Activities).toHaveLength(2);
      expect(sept16Activities.map((a: { mealQuality: string }) => a.mealQuality).sort()).toEqual([
        "GOOD",
        "REGULAR",
      ]);

      // Neither belongs to Chile's the 17th -- both are still the 16th there.
      const sept17 = await page.request.get(
        `/api/mar-antonia/activities?date=2026-09-17&tz=${SANTIAGO_OFFSET}`,
      );
      const { activities: sept17Activities } = await sept17.json();
      expect(sept17Activities).toHaveLength(0);

      // A UTC caller (tz=0) sees them on two different days instead --
      // confirms the split is really about which timezone is asked for, not
      // an unconditional merge.
      const utcSept16 = await page.request.get("/api/mar-antonia/activities?date=2026-09-16&tz=0");
      const { activities: utcSept16Activities } = await utcSept16.json();
      expect(utcSept16Activities).toHaveLength(1);
      expect(utcSept16Activities[0].mealQuality).toBe("REGULAR");

      const utcSept17 = await page.request.get("/api/mar-antonia/activities?date=2026-09-17&tz=0");
      const { activities: utcSept17Activities } = await utcSept17.json();
      expect(utcSept17Activities).toHaveLength(1);
      expect(utcSept17Activities[0].mealQuality).toBe("GOOD");
    } finally {
      runFixture("delete", email);
    }
  });

  test("the days summary groups a late-evening activity under the right Chile day", async ({ page }) => {
    const email = "e2e-marantonia-tz-summary@example.com";
    const output = runFixture("create-with-child", email, "Bebé Zona Horaria 2", "MAMA");
    const { childId, ownerUserId } = JSON.parse(output.trim().split("\n").pop()!) as {
      childId: string;
      ownerUserId: string;
    };

    // A handful of days ago in Chile evening terms, so it's safely outside
    // "today" (excluded from the summary) regardless of when this test runs.
    const chileEveningFiveDaysAgo = new Date();
    chileEveningFiveDaysAgo.setUTCDate(chileEveningFiveDaysAgo.getUTCDate() - 5);
    chileEveningFiveDaysAgo.setUTCHours(2, 0, 0, 0); // ~22:00 the previous evening in UTC-4
    runFixture(
      "add-activity",
      childId,
      ownerUserId,
      "MEAL",
      chileEveningFiveDaysAgo.toISOString(),
      "mealQuality",
      "GOOD",
    );
    const expectedChileKey = new Date(chileEveningFiveDaysAgo.getTime() - 4 * 60 * 60 * 1000);
    const expectedKey = `${expectedChileKey.getUTCFullYear()}-${String(expectedChileKey.getUTCMonth() + 1).padStart(2, "0")}-${String(expectedChileKey.getUTCDate()).padStart(2, "0")}`;

    try {
      await login(page, email);

      const res = await page.request.get(`/api/mar-antonia/activities/days?tz=${SANTIAGO_OFFSET}`);
      const { days } = await res.json();
      expect(days).toEqual([{ date: expectedKey, count: 1 }]);
    } finally {
      runFixture("delete", email);
    }
  });
});
