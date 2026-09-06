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

test.describe("MiSuper list items", () => {
  test("add items across categories and see them grouped and sorted", async ({ page }) => {
    const email = "e2e-misuper-items@example.com";
    const output = runFixture("create-with-household", email, "Casa Items");
    const { householdId } = JSON.parse(output.trim().split("\n").pop()!) as { householdId: string };
    const listOutput = runFixture("add-list", householdId, "Compra semanal", "DRAFT");
    const { listId } = JSON.parse(listOutput.trim()) as { listId: string };

    try {
      await login(page, email);
      await page.goto(`/mi-super/listas/${listId}`);

      // No category selected -- lands in "Sin categoría".
      await page.fill('input[placeholder="Agregar producto (ej: Leche)"]', "Papel higiénico");
      await page.getByRole("button", { name: "Agregar" }).click();
      await expect(page.getByRole("button", { name: "Eliminar Papel higiénico" })).toBeVisible();

      // Two items in the same category, added out of alphabetical order --
      // the UI should still render them Manzanas-then-Peras.
      await page.fill('input[placeholder="Agregar producto (ej: Leche)"]', "Peras");
      await page.getByLabel("Categoría para el nuevo producto").selectOption({ label: "Frutas y verduras" });
      await page.getByRole("button", { name: "Agregar" }).click();
      await expect(page.getByRole("button", { name: "Eliminar Peras" })).toBeVisible();

      await page.fill('input[placeholder="Agregar producto (ej: Leche)"]', "Manzanas");
      await page.getByLabel("Categoría para el nuevo producto").selectOption({ label: "Frutas y verduras" });
      await page.getByRole("button", { name: "Agregar" }).click();
      await expect(page.getByRole("button", { name: "Eliminar Manzanas" })).toBeVisible();

      const fruitGroup = page.locator("details", { has: page.getByText("Frutas y verduras (2)") });
      const fruitInputs = await fruitGroup.locator("li input").all();
      const fruitNames = await Promise.all(fruitInputs.map((input) => input.inputValue()));
      expect(fruitNames).toEqual(["Manzanas", "Peras"]);

      await expect(page.getByText("Sin categoría (1)")).toBeVisible();

      await page.getByRole("button", { name: "Eliminar Papel higiénico" }).click();
      await expect(page.getByRole("button", { name: "Eliminar Papel higiénico" })).toHaveCount(0);
    } finally {
      runFixture("delete", email);
    }
  });
});
