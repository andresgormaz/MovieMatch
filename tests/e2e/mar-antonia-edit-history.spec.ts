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
      await page.fill("#milk-ounces", "4");
      await page.getByRole("button", { name: "Guardar" }).click();
      await expect(page.locator("ul li", { hasText: "Leche" })).toContainText("4 oz");
      await expect(page.locator("ul li", { hasText: "Leche" })).toContainText("Mamá");

      // Editing: click the row to reopen the panel pre-filled, switch the
      // caregiver and the ounces, save.
      await page.locator("ul li", { hasText: "Leche" }).click();
      await expect(page.locator("#milk-ounces")).toHaveValue("4");
      await page.getByRole("button", { name: "Papá" }).click();
      await page.fill("#milk-ounces", "6");
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
