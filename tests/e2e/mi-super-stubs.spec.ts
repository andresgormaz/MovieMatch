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

test.describe("MiSuper Historial/Aprendizaje stubs", () => {
  test("both stub pages render and their nav tabs highlight correctly", async ({ page }) => {
    const email = "e2e-misuper-stubs@example.com";
    runFixture("create-with-household", email, "Casa Stubs");

    try {
      await login(page, email);

      await page.goto("/mi-super/historial");
      await expect(page.getByRole("heading", { name: "Historial" })).toBeVisible();
      const nav = page.locator('nav[aria-label="Navegación principal"]');
      await expect(nav.getByRole("link", { name: "Historial" })).toHaveClass(/text-accent-hover/);

      await page.goto("/mi-super/aprendizaje");
      await expect(page.getByRole("heading", { name: "Aprendizaje" })).toBeVisible();
      await expect(nav.getByRole("link", { name: "Aprendizaje" })).toHaveClass(/text-accent-hover/);
    } finally {
      runFixture("delete", email);
    }
  });
});
