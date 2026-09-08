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

test.describe("MarAntonia edit/delete and day history", () => {
  test("edit an activity's caregiver and detail, then delete it", async ({ page }) => {
    const email = "e2e-marantonia-edit@example.com";
    const output = runFixture("create-with-child", email, "Bebé Edición", "MAMA");
    const { childId } = JSON.parse(output.trim().split("\n").pop()!) as { childId: string };
    runFixture("add-caregiver", childId, "e2e-marantonia-edit-papa@example.com", "PAPA");

    try {
      await login(page, email);
      await page.goto("/mar-antonia");

      await page.getByRole("button", { name: "Leche" }).click();
      await page.getByRole("button", { name: "4 oz" }).click();
      await page.getByRole("button", { name: "Guardar" }).click();
      await expect(page.locator("ul li", { hasText: "Leche" })).toContainText("4 oz");
      await expect(page.locator("ul li", { hasText: "Leche" })).toContainText("Mamá");

      // Editing: click the row to reopen the panel pre-filled, switch the
      // caregiver and the ounces, save.
      await page.locator("ul li", { hasText: "Leche" }).click();
      await expect(page.locator(".gap-3").getByRole("button", { name: "4 oz" })).toHaveClass(/border-accent/);
      await page.getByRole("button", { name: "Papá" }).click();
      await page.getByRole("button", { name: "6 oz" }).click();
      await page.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(page.locator("ul li", { hasText: "Leche" })).toContainText("6 oz");
      await expect(page.locator("ul li", { hasText: "Leche" })).toContainText("Papá");

      // Deleting.
      await page.locator("ul li", { hasText: "Leche" }).click();
      await page.getByRole("button", { name: "Eliminar" }).click();
      await expect(page.getByText("Todavía no registraste nada hoy.")).toBeVisible();
    } finally {
      runFixture("delete", "e2e-marantonia-edit-papa@example.com");
      runFixture("delete", email);
    }
  });

  test("either caregiver can see and edit/delete entries the other one logged", async ({ page }) => {
    const mamaEmail = "e2e-marantonia-shared-mama@example.com";
    const papaEmail = "e2e-marantonia-shared-papa@example.com";
    const output = runFixture("create-with-child", mamaEmail, "Bebé Compartido", "MAMA");
    const { childId } = JSON.parse(output.trim().split("\n").pop()!) as { childId: string };
    runFixture("add-caregiver", childId, papaEmail, "PAPA");

    try {
      await login(page, mamaEmail);
      await page.goto("/mar-antonia");
      await page.getByRole("button", { name: "Comida" }).click();
      await page.getByRole("button", { name: "Bien" }).click();
      await page.getByRole("button", { name: "Guardar" }).click();
      await expect(page.locator("ul li", { hasText: "Comida" })).toContainText("Mamá");

      // Switching to the other caregiver's own session -- clear the
      // cookie first, since /login redirects away when already
      // authenticated. No ownership check should hide or lock mamá's
      // entry from papá.
      await page.context().clearCookies();
      await login(page, papaEmail);
      await page.goto("/mar-antonia");
      await expect(page.locator("ul li", { hasText: "Comida" })).toContainText("Bien");
      await expect(page.locator("ul li", { hasText: "Comida" })).toContainText("Mamá");

      await page.locator("ul li", { hasText: "Comida" }).click();
      await page.getByRole("button", { name: "Regular" }).click();
      await page.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(page.locator("ul li", { hasText: "Comida" })).toContainText("Regular");

      // Confirm server-side, then delete an entry papá didn't create.
      await page.reload();
      await expect(page.locator("ul li", { hasText: "Comida" })).toContainText("Regular");
      await page.locator("ul li", { hasText: "Comida" }).click();
      await page.getByRole("button", { name: "Eliminar" }).click();
      await expect(page.getByText("Todavía no registraste nada hoy.")).toBeVisible();
    } finally {
      runFixture("delete", papaEmail);
      runFixture("delete", mamaEmail);
    }
  });

  test("editing a POOP diaper back to PEE clears its amount and consistency", async ({ page }) => {
    const email = "e2e-marantonia-diaper@example.com";
    runFixture("create-with-child", email, "Bebé Pañal", "MAMA");

    try {
      await login(page, email);
      await page.goto("/mar-antonia");

      await page.getByRole("button", { name: "Pañal" }).click();
      await page.getByRole("button", { name: "Caca" }).click();
      await page.getByRole("button", { name: "Mucha" }).click();
      await page.getByRole("button", { name: "Diarrea" }).click();
      await page.getByRole("button", { name: "Guardar" }).click();
      await expect(page.locator("ul li", { hasText: "Pañal" })).toContainText("Caca (mucha, diarrea)");

      // Switching back to Pipí should hide (and, on save, clear) the
      // amount/consistency pickers -- there's nothing to report for a pee
      // diaper.
      await page.locator("ul li", { hasText: "Pañal" }).click();
      await page.getByRole("button", { name: "Pipí" }).click();
      await expect(page.getByText("¿Cuánta?")).not.toBeVisible();
      await page.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(page.locator("ul li", { hasText: "Pañal" })).toContainText("Pipí");
      await expect(page.locator("ul li", { hasText: "Pañal" })).not.toContainText("Caca");

      // Confirm it stuck server-side, not just in the optimistic UI.
      await page.reload();
      await expect(page.locator("ul li", { hasText: "Pañal" })).toContainText("Pipí");
    } finally {
      runFixture("delete", email);
    }
  });

  test("a previous day's activities render collapsed and expand on demand", async ({ page }) => {
    const email = "e2e-marantonia-history@example.com";
    const output = runFixture("create-with-child", email, "Bebé Historial", "MAMA");
    const { childId, ownerUserId } = JSON.parse(output.trim().split("\n").pop()!) as {
      childId: string;
      ownerUserId: string;
    };
    const yesterday = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString();
    runFixture("add-activity", childId, ownerUserId, "MEAL", yesterday, "mealQuality", "GOOD");

    try {
      await login(page, email);
      await page.goto("/mar-antonia");

      const summary = page.locator("summary", { hasText: "(1)" });
      await expect(summary).toBeVisible();
      // Collapsed by default -- the row inside shouldn't be visible yet.
      await expect(page.getByText("Bien")).not.toBeVisible();

      await summary.click();
      await expect(page.locator("li", { hasText: "Comida" })).toContainText("Bien");
    } finally {
      runFixture("delete", email);
    }
  });
});
