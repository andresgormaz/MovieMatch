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

test.describe("MarAntonia quick-log", () => {
  test("log one of each activity type and see them in today's feed with the right detail", async ({ page }) => {
    const email = "e2e-marantonia-activities@example.com";
    runFixture("create-with-child", email, "Bebé de Prueba", "MAMA");

    try {
      await login(page, email);
      await page.goto("/mar-antonia");

      await page.getByRole("button", { name: "Comida" }).click();
      await page.getByRole("button", { name: "Bien" }).click();
      await page.getByRole("button", { name: "Guardar" }).click();
      await expect(page.locator("ul li", { hasText: "Comida" })).toContainText("Bien");

      // Siesta has no detail field -- just the caregiver toggle.
      await page.getByRole("button", { name: "Siesta" }).click();
      await page.getByRole("button", { name: "Guardar" }).click();
      await expect(page.locator("ul li", { hasText: "Siesta" })).toBeVisible();

      await page.getByRole("button", { name: "Leche" }).click();
      await page.fill("#milk-ounces", "4.5");
      await page.getByRole("button", { name: "Guardar" }).click();
      await expect(page.locator("ul li", { hasText: "Leche" })).toContainText("4.5 oz");

      await page.getByRole("button", { name: "Despertada" }).click();
      await page.getByRole("button", { name: "Llorando" }).click();
      await page.getByRole("button", { name: "Guardar" }).click();
      await expect(page.locator("ul li", { hasText: "Despertada" })).toContainText("Llorando");

      await page.getByRole("button", { name: "Pañal" }).click();
      await page.getByRole("button", { name: "Caca" }).click();
      await page.getByRole("button", { name: "Mucha" }).click();
      await page.getByRole("button", { name: "Dura" }).click();
      await page.getByRole("button", { name: "Guardar" }).click();
      await expect(page.locator("ul li", { hasText: "Pañal" })).toContainText("Caca (mucha, dura)");

      const rows = page.locator("ul li");
      await expect(rows).toHaveCount(5);
      for (const row of await rows.all()) {
        await expect(row).toContainText("Mamá");
      }
    } finally {
      runFixture("delete", email);
    }
  });

  test("saving is blocked until the required detail for the type is picked", async ({ page }) => {
    const email = "e2e-marantonia-activities-validation@example.com";
    runFixture("create-with-child", email, "Bebé de Prueba", "PAPA");

    try {
      await login(page, email);
      await page.goto("/mar-antonia");

      await page.getByRole("button", { name: "Leche" }).click();
      await page.getByRole("button", { name: "Guardar" }).click();
      await expect(page.getByText("Escribe cuántas onzas.")).toBeVisible();
      await expect(page.locator("ul li")).toHaveCount(0);
    } finally {
      runFixture("delete", email);
    }
  });
});
