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

  test("hacer dormir (inicio) then despertar updates the same Dormir row", async ({ page }) => {
    const email = "e2e-marantonia-dormir-start-end@example.com";
    runFixture("create-with-child", email, "Bebé Sueño", "MAMA");

    try {
      await login(page, email);
      await page.goto("/mar-antonia");

      await gridButton(page, "Dormir").click();
      await panelButton(page, "Hacer dormir").click();
      await panelButton(page, "Inicio").click();
      await panelButton(page, "Guardar").click();
      await expect(page.locator("ul li")).toHaveCount(1);
      await expect(page.locator("ul li", { hasText: "Dormir" })).toContainText("intentando dormir");

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

  test("logrado marks when the child fell asleep, shown as time-to-sleep once ended", async ({ page }) => {
    const email = "e2e-marantonia-dormir-logrado@example.com";
    runFixture("create-with-child", email, "Bebé Sueño", "MAMA");

    try {
      await login(page, email);
      await page.goto("/mar-antonia");

      await gridButton(page, "Dormir").click();
      await panelButton(page, "Hacer dormir").click();
      await panelButton(page, "Inicio").click();
      await panelButton(page, "Guardar").click();
      await expect(page.locator("ul li", { hasText: "Dormir" })).toContainText("intentando dormir");

      // Marking it achieved: no time field either, shows who/when it
      // started trying and updates the same row instead of adding one.
      await gridButton(page, "Dormir").click();
      await panelButton(page, "Hacer dormir").click();
      await panelButton(page, "Logrado").click();
      await expect(page.getByText(/Empezó a intentar dormir a las/)).toBeVisible();
      await panelButton(page, "Guardar").click();
      await expect(page.locator("ul li")).toHaveCount(1);
      await expect(page.locator("ul li", { hasText: "Dormir" })).toContainText("tardó");
      await expect(page.locator("ul li", { hasText: "Dormir" })).toContainText("durmiendo");

      // Ending it now also carries the time-to-sleep detail alongside "hasta".
      await gridButton(page, "Dormir").click();
      await panelButton(page, "Despertar").click();
      await panelButton(page, "Guardar").click();
      await expect(page.locator("ul li")).toHaveCount(1);
      await expect(page.locator("ul li", { hasText: "Dormir" })).toContainText("tardó");
      await expect(page.locator("ul li", { hasText: "Dormir" })).toContainText("hasta");
    } finally {
      runFixture("delete", email);
    }
  });

  test("logrado is blocked with no open dormir session, and can't be marked twice", async ({ page }) => {
    const email = "e2e-marantonia-dormir-logrado-guard@example.com";
    runFixture("create-with-child", email, "Bebé Sueño", "MAMA");

    try {
      await login(page, email);
      await page.goto("/mar-antonia");

      // No session started yet.
      await gridButton(page, "Dormir").click();
      await panelButton(page, "Hacer dormir").click();
      await panelButton(page, "Logrado").click();
      await expect(page.getByText("No hay ninguna sesión de dormir en curso.")).toBeVisible();
      await expect(page.locator(".gap-3").getByRole("button", { name: "Guardar" })).toBeDisabled();

      await panelButton(page, "Inicio").click();
      await panelButton(page, "Guardar").click();

      await gridButton(page, "Dormir").click();
      await panelButton(page, "Hacer dormir").click();
      await panelButton(page, "Logrado").click();
      await panelButton(page, "Guardar").click();
      await expect(page.locator("ul li", { hasText: "Dormir" })).toContainText("durmiendo");

      // Trying to mark it achieved again is blocked with an explanatory
      // message instead of silently overwriting the recorded time.
      await gridButton(page, "Dormir").click();
      await panelButton(page, "Hacer dormir").click();
      await panelButton(page, "Logrado").click();
      await expect(page.getByText(/Ya se registró que logró dormir a las/)).toBeVisible();
      await expect(page.locator(".gap-3").getByRole("button", { name: "Guardar" })).toBeDisabled();
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
      // Detected up front (before Guardar is even tapped) from the already-open
      // session, not just as a failed-save error after the fact.
      await expect(page.getByText(/Ya hay una sesión de siesta en curso/)).toBeVisible();
      await expect(panelButton(page, "Guardar")).toBeDisabled();
      await expect(page.locator("ul li")).toHaveCount(1);
    } finally {
      runFixture("delete", email);
    }
  });

  test("an open Dormir session blocks starting a new one, and switching to Logrado doesn't carry over a stale error", async ({
    page,
  }) => {
    const email = "e2e-marantonia-sleep-dormir-open@example.com";
    runFixture("create-with-child", email, "Bebé Sueño", "MAMA");

    try {
      await login(page, email);
      await page.goto("/mar-antonia");

      // Start a night's sleep and mark it achieved, but never end it (as if
      // "Despertar" was forgotten) -- this is the session that stays open.
      await gridButton(page, "Dormir").click();
      await panelButton(page, "Hacer dormir").click();
      await panelButton(page, "Inicio").click();
      await panelButton(page, "Guardar").click();
      await expect(page.locator("ul li")).toHaveCount(1);

      await gridButton(page, "Dormir").click();
      await panelButton(page, "Hacer dormir").click();
      await panelButton(page, "Logrado").click();
      await panelButton(page, "Guardar").click();
      await expect(page.locator("ul li", { hasText: "Dormir" })).toContainText("durmiendo");

      // Trying to start a brand new Dormir session while that one is still
      // open is blocked up front, with a message that actually explains why
      // (not the old session's already-achieved status, and not a stale
      // error left over from a previous tab).
      await gridButton(page, "Dormir").click();
      await panelButton(page, "Hacer dormir").click();
      await panelButton(page, "Inicio").click();
      await expect(page.getByText(/Ya hay una sesión de dormir en curso, iniciada a las/)).toBeVisible();
      await expect(panelButton(page, "Guardar")).toBeDisabled();

      // Switching to "Logrado" replaces that message with the (unrelated)
      // reason *that* action is blocked -- it already happened -- instead of
      // leaving the "Inicio" one stuck on screen.
      await panelButton(page, "Logrado").click();
      await expect(page.getByText(/Ya se registró que logró dormir a las/)).toBeVisible();
      await expect(page.getByText(/Ya hay una sesión de dormir en curso, iniciada a las/)).not.toBeVisible();
      await expect(panelButton(page, "Guardar")).toBeDisabled();
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
      await panelButton(page, "Inicio").click();
      await panelButton(page, "Guardar").click();
      await expect(page.locator("ul li")).toHaveCount(2);
      await expect(page.locator("ul li", { hasText: "Siesta" })).toContainText("en curso");
      await expect(page.locator("ul li", { hasText: "Dormir" })).toContainText("intentando dormir");
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

  test("editing a Dormir entry can add or clear its logrado (achieved) time", async ({ page }) => {
    const email = "e2e-marantonia-dormir-edit-achieved@example.com";
    const output = runFixture("create-with-child", email, "Bebé Sueño", "MAMA");
    const { childId, ownerUserId } = JSON.parse(output.trim().split("\n").pop()!) as {
      childId: string;
      ownerUserId: string;
    };
    const start = new Date();
    start.setHours(20, 0, 0, 0);
    runFixture("add-activity", childId, ownerUserId, "SLEEP", start.toISOString(), "sleepType", "NOCHE");

    try {
      await login(page, email);
      await page.goto("/mar-antonia");

      await expect(page.locator("ul li", { hasText: "Dormir" })).toContainText("intentando dormir");
      await page.locator("ul li", { hasText: "Dormir" }).click();
      // Siesta doesn't get this toggle -- only visible for a NOCHE entry.
      await expect(page.locator("#sleep-achieved-time")).toHaveCount(0);

      await panelButton(page, "Sí, ya se durmió").click();
      await page.fill("#sleep-achieved-time", "20:15");
      await page.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(page.locator("ul li", { hasText: "Dormir" })).toContainText("tardó 15 min en dormirse");

      // Clearing it back via the toggle.
      await page.locator("ul li", { hasText: "Dormir" }).click();
      await expect(page.locator("#sleep-achieved-time")).toHaveValue("20:15");
      await panelButton(page, "No, aún no").click();
      await expect(page.locator("#sleep-achieved-time")).toHaveCount(0);
      await page.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(page.locator("ul li", { hasText: "Dormir" })).toContainText("intentando dormir");
    } finally {
      runFixture("delete", email);
    }
  });
});
