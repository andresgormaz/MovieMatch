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

test.describe("MiSuper Ajustes", () => {
  test("rename household, add/reorder/delete a category", async ({ page }) => {
    const email = "e2e-misuper-ajustes-owner@example.com";
    runFixture("create-with-household", email, "Casa Original");

    try {
      await login(page, email);
      await page.goto("/mi-super/ajustes");

      await page.fill('input[placeholder="Nombre del hogar (ej: Casa de Ana)"]', "Casa Renombrada");
      await page.getByRole("button", { name: "Guardar" }).click();
      await expect(page.locator('input[placeholder="Nombre del hogar (ej: Casa de Ana)"]')).toHaveValue(
        "Casa Renombrada",
      );

      await page.fill('input[placeholder="Nueva categoría"]', "Mascotas");
      await page.getByRole("button", { name: "Agregar" }).click();
      // Category names render inside an <input>, whose value isn't part of
      // its accessible text content -- match on the per-row action buttons'
      // aria-labels (which embed the name) instead of `li` text content.
      await expect(page.getByRole("button", { name: "Eliminar Mascotas" })).toBeVisible();

      // Brand-new category sorts last -- "Subir" nudges it up one slot,
      // ahead of whatever default category was previously last ("Otros").
      await page.getByRole("button", { name: "Subir Mascotas" }).click();
      await expect(page.getByRole("button", { name: "Eliminar Mascotas" })).toBeVisible();

      await page.getByRole("button", { name: "Eliminar Mascotas" }).click();
      await expect(page.getByRole("button", { name: "Eliminar Mascotas" })).toHaveCount(0);
    } finally {
      runFixture("delete", email);
    }
  });

  test("a member of one household cannot read or modify another household's categories", async ({ page }) => {
    const ownerEmail = "e2e-misuper-ajustes-owner2@example.com";
    const outsiderEmail = "e2e-misuper-ajustes-outsider@example.com";
    const outputA = runFixture("create-with-household", ownerEmail, "Hogar A");
    const { householdId, categoryId } = JSON.parse(outputA.trim().split("\n").pop()!) as {
      householdId: string;
      categoryId: string;
    };
    runFixture("create-with-household", outsiderEmail, "Hogar B");

    try {
      await login(page, outsiderEmail);

      const categoriesRes = await page.request.get(`/api/mi-super/households/${householdId}/categories`);
      expect(categoriesRes.status()).toBe(403);

      const renameRes = await page.request.patch(`/api/mi-super/categories/${categoryId}`, {
        data: { name: "Hackeado" },
      });
      expect(renameRes.status()).toBe(403);

      const deleteRes = await page.request.delete(`/api/mi-super/categories/${categoryId}`);
      expect(deleteRes.status()).toBe(403);
    } finally {
      runFixture("delete", outsiderEmail);
      runFixture("delete", ownerEmail);
    }
  });
});
