import { execFileSync } from "node:child_process";
import { test, expect, type Page } from "@playwright/test";

const PASSWORD = "Test1234!";

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

// Local midnight of "daysAgo days ago", offset by a fixed number of hours --
// matches how the app itself buckets days (see toDateInputValue/GET
// .../activities/days), so a night seeded at, say, 20:00 lands under that
// same calendar day.
function atHour(daysAgo: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d;
}

test.describe("MarAntonia sleep pattern analysis", () => {
  test("a factor with a clear difference across enough nights shows up as an insight", async ({ page }) => {
    // Seeds ~20 activities via separate fixture-script invocations -- each
    // one spawns its own node process, which comfortably blows past the
    // default 30s test timeout before login even starts.
    test.setTimeout(90_000);
    const email = "e2e-marantonia-analysis@example.com";
    const output = runFixture("create-with-child", email, "Bebé Análisis", "MAMA");
    const { childId, ownerUserId } = JSON.parse(output.trim().split("\n").pop()!) as {
      childId: string;
      ownerUserId: string;
    };

    try {
      // Three nights with a bath an hour before bedtime and few wake-ups,
      // three nights with no bath and several wake-ups -- a difference large
      // and consistent enough that the "Baño antes de dormir" insight should
      // pick it up (each side clears MIN_NIGHTS_PER_GROUP = 3).
      for (const daysAgo of [4, 5, 6]) {
        runFixture("add-activity", childId, ownerUserId, "BATH", atHour(daysAgo, 19).toISOString());
        runFixture(
          "add-activity",
          childId,
          ownerUserId,
          "SLEEP",
          atHour(daysAgo, 20).toISOString(),
          "sleepType",
          "NOCHE",
          "sleepEndedAt",
          atHour(daysAgo - 1, 7).toISOString(),
        );
        runFixture("add-activity", childId, ownerUserId, "NIGHT_WAKE", atHour(daysAgo, 23).toISOString(), "wakeMood", "CRYING");
      }
      for (const daysAgo of [1, 2, 3]) {
        runFixture(
          "add-activity",
          childId,
          ownerUserId,
          "SLEEP",
          atHour(daysAgo, 20).toISOString(),
          "sleepType",
          "NOCHE",
          "sleepEndedAt",
          atHour(daysAgo - 1, 7).toISOString(),
        );
        for (const hour of [22, 1, 3]) {
          runFixture(
            "add-activity",
            childId,
            ownerUserId,
            "NIGHT_WAKE",
            atHour(hour < 12 ? daysAgo - 1 : daysAgo, hour).toISOString(),
            "wakeMood",
            "CRYING",
          );
        }
      }

      await login(page, email);
      await page.goto("/mar-antonia/analisis");

      await expect(page.getByText("6 noches completas registradas")).toBeVisible();
      const card = page.locator("div", { hasText: "Baño antes de dormir" }).last();
      await expect(card).toBeVisible();
      await expect(card).toContainText("menos despertares");
      await expect(card.getByText(/Con baño.*n=3/)).toBeVisible();
      await expect(card.getByText(/Sin baño.*n=3/)).toBeVisible();
    } finally {
      runFixture("delete", email);
    }
  });

  test("with too little data, no insights are shown and the empty state explains why", async ({ page }) => {
    const email = "e2e-marantonia-analysis-empty@example.com";
    runFixture("create-with-child", email, "Bebé Análisis Vacío", "MAMA");

    try {
      await login(page, email);
      await page.goto("/mar-antonia/analisis");

      await expect(page.getByText("0 noches completas registradas")).toBeVisible();
      await expect(page.getByText(/Todavía no hay suficientes noches registradas/)).toBeVisible();
    } finally {
      runFixture("delete", email);
    }
  });
});
