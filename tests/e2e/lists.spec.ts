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

test.describe("MiSuper Listas", () => {
  test("create a list, rename it, start shopping, and see it grouped by status", async ({ page }) => {
    const email = "e2e-misuper-lists@example.com";
    const output = runFixture("create-with-household", email, "Casa Listas");
    const { householdId } = JSON.parse(output.trim().split("\n").pop()!) as { householdId: string };
    runFixture("add-list", householdId, "Compra de julio", "COMPLETED");

    try {
      await login(page, email);
      await page.goto("/mi-super/listas");

      // The seeded COMPLETED list shows up under "Completadas" without any
      // action on our part -- there's no UI to reach that status yet
      // ("Terminar compra" is PR7), so this is the only way to cover it.
      await expect(
        page.locator("section", { has: page.getByRole("heading", { name: "Completadas" }) }).getByText("Compra de julio"),
      ).toBeVisible();

      await page.fill('input[placeholder="Nombre de la lista (ej: Compra del mes)"]', "Compra semanal");
      await page.getByRole("button", { name: "Crear lista" }).click();
      const futurasSection = page.locator("section", { has: page.getByRole("heading", { name: "Futuras" }) });
      await expect(futurasSection.getByText("Compra semanal")).toBeVisible();

      await page.getByText("Compra semanal").click();
      await page.waitForURL((url) => /\/mi-super\/listas\/[a-z0-9]+$/.test(url.pathname));

      const titleInput = page.getByRole("textbox").first();
      await titleInput.fill("Compra semanal renovada");
      await page.getByRole("button", { name: "Guardar" }).click();
      await expect(titleInput).toHaveValue("Compra semanal renovada");

      await page.getByRole("button", { name: "Empezar a comprar" }).click();
      await expect(page.getByText("En curso")).toBeVisible();

      await page.goto("/mi-super/listas");
      const activasSection = page.locator("section", { has: page.getByRole("heading", { name: "Activas" }) });
      await expect(activasSection.getByText("Compra semanal renovada")).toBeVisible();
    } finally {
      runFixture("delete", email);
    }
  });
});
