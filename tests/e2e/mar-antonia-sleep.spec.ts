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

// The quick-log grid button ("Siesta"/"Dormir") and the panel's own pills
// happen to share words with row text once a row exists (e.g. a Dormir row's
// own label, or a Siesta row's "en curso" detail) -- scoping to the grid
// (.grid-cols-3) and the panel (.gap-3) keeps these clicks unambiguous.
function gridButton(page: Page, name: string) {
  return page.locator(".grid-cols-3").getByRole("button", { name });
}
function panelButton(page: Page, name: string) {
  return page.locator(".gap-3").getByRole("button", { name });
}

test.describe("MarAntonia Siesta and Dormir (start-end sleep sessions)", () => {
  test("starting a siesta then ending it updates the same row instead of creating a new one", async ({ page }) => {
    const email = "e2e-marantonia-siesta-start-end@example.com";
    runFixture("create-with-child", email, "Bebé Sueño", "MAMA");

    try {
      await login(page, email);
      await page.goto("/mar-antonia");

      await gridButton(page, "Siesta").click();
      await panelButton(page, "Inicio").click();
      await panelButton(page, "Guardar").click();
      await expect(page.locator("ul li")).toHaveCount(1);
      await expect(page.locator("ul li", { hasText: "Siesta" })).toContainText("en curso");

      // Ending it: no time field, it shows when it started and saves with
      // the system clock.
      await gridButton(page, "Siesta").click();
      await panelButton(page, "Fin").click();
      await expect(page.getByText(/Empezó a las/)).toBeVisible();
      await panelButton(page, "Guardar").click();

      // Same row updated in place, not a second one.
      await expect(page.locator("ul li")).toHaveCount(1);
      await expect(page.locator("ul li", { hasText: "Siesta" })).toContainText("hasta");
      await expect(page.locator("ul li", { hasText: "Siesta" })).not.toContainText("en curso");
    } finally {
      runFixture("delete", email);
    }
  });

  test("hacer dormir then despertar updates the same Dormir row", async ({ page }) => {
    const email = "e2e-marantonia-dormir-start-end@example.com";
    runFixture("create-with-child", email, "Bebé Sueño", "MAMA");

    try {
      await login(page, email);
      await page.goto("/mar-antonia");

      await gridButton(page, "Dormir").click();
      await panelButton(page, "Hacer dormir").click();
      await panelButton(page, "Guardar").click();
      await expect(page.locator("ul li")).toHaveCount(1);
      await expect(page.locator("ul li", { hasText: "Dormir" })).toContainText("en curso");

      await gridButton(page, "Dormir").click();
      await panelButton(page, "Despertar").click();
      await expect(page.getByText(/Empezó a las/)).toBeVisible();
      await panelButton(page, "Guardar").click();

      await expect(page.locator("ul li")).toHaveCount(1);
      await expect(page.locator("ul li", { hasText: "Dormir" })).toContainText("hasta");
      await expect(page.locator("ul li", { hasText: "Dormir" })).not.toContainText("en curso");
    } finally {
      runFixture("delete", email);
    }
  });

  test("cannot start a second siesta while one is already in progress", async ({ page }) => {
    const email = "e2e-marantonia-sleep-duplicate@example.com";
    runFixture("create-with-child", email, "Bebé Sueño", "MAMA");

    try {
      await login(page, email);
      await page.goto("/mar-antonia");

      await gridButton(page, "Siesta").click();
      await panelButton(page, "Inicio").click();
      await panelButton(page, "Guardar").click();
      await expect(page.locator("ul li")).toHaveCount(1);

      await gridButton(page, "Siesta").click();
      await panelButton(page, "Inicio").click();
      await panelButton(page, "Guardar").click();
      await expect(page.getByText(/en curso\. Termínalo antes de iniciar uno nuevo\./)).toBeVisible();
      await expect(page.locator("ul li")).toHaveCount(1);
    } finally {
      runFixture("delete", email);
    }
  });

  test("siesta and dormir are tracked independently", async ({ page }) => {
    const email = "e2e-marantonia-sleep-independent@example.com";
    runFixture("create-with-child", email, "Bebé Sueño", "MAMA");

    try {
      await login(page, email);
      await page.goto("/mar-antonia");

      await gridButton(page, "Siesta").click();
      await panelButton(page, "Inicio").click();
      await panelButton(page, "Guardar").click();
      await expect(page.locator("ul li")).toHaveCount(1);

      // Starting a Dormir (overnight) session while the Siesta is still open
      // should work fine -- they're independent "last open session" slots.
      await gridButton(page, "Dormir").click();
      await panelButton(page, "Hacer dormir").click();
      await panelButton(page, "Guardar").click();
      await expect(page.locator("ul li")).toHaveCount(2);
      await expect(page.locator("ul li", { hasText: "Siesta" })).toContainText("en curso");
      await expect(page.locator("ul li", { hasText: "Dormir" })).toContainText("en curso");
    } finally {
      runFixture("delete", email);
    }
  });

  test("editing a sleep entry can fix its times and clear an end time back to in-progress", async ({ page }) => {
    const email = "e2e-marantonia-sleep-edit@example.com";
    const output = runFixture("create-with-child", email, "Bebé Sueño", "MAMA");
    const { childId, ownerUserId } = JSON.parse(output.trim().split("\n").pop()!) as {
      childId: string;
      ownerUserId: string;
    };
    const start = new Date();
    start.setHours(9, 0, 0, 0);
    const end = new Date();
    end.setHours(10, 30, 0, 0);
    runFixture(
      "add-activity",
      childId,
      ownerUserId,
      "SLEEP",
      start.toISOString(),
      "sleepType",
      "SIESTA",
      "sleepEndedAt",
      end.toISOString(),
    );

    try {
      await login(page, email);
      await page.goto("/mar-antonia");

      await expect(page.locator("ul li", { hasText: "Siesta" })).toContainText("hasta");
      await page.locator("ul li", { hasText: "Siesta" }).click();
      // Editing doesn't offer a subtype switch -- siesta and dormir are
      // fully separate categories, not a picker inside one panel.
      await expect(page.locator(".gap-3").getByRole("button", { name: "Siesta" })).toHaveCount(0);
      await expect(page.locator("#activity-time")).toHaveValue("09:00");
      await expect(page.locator("#sleep-end-time")).toHaveValue("10:30");

      // Clearing it back to "en curso" via the ¿Terminó? toggle.
      await panelButton(page, "Todavía no").click();
      await expect(page.locator("#sleep-end-time")).toHaveCount(0);
      await page.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(page.locator("ul li", { hasText: "Siesta" })).toContainText("en curso");
    } finally {
      runFixture("delete", email);
    }
  });
});
