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

test.describe("MarAntonia Vacunas", () => {
  test("renders the PNI schedule, and a dose can be marked given and unmarked", async ({ page }) => {
    const email = "e2e-marantonia-vaccines@example.com";
    runFixture("create-with-child", email, "Bebé Vacunas", "MAMA");

    try {
      await login(page, email);
      await page.goto("/mar-antonia/vacunas");

      await expect(page.getByText("Recién nacido")).toBeVisible();
      await expect(page.getByText("BCG")).toBeVisible();
      await expect(page.getByText(/0\/\d+ dosis marcadas/)).toBeVisible();

      const bcgRow = page.getByTestId("vaccine-dose-bcg-rn");
      await bcgRow.getByText("Pendiente").click();
      await page.fill('input[type="date"]', "2025-06-05");
      await page.getByRole("button", { name: "Marcar como puesta" }).click();

      await expect(page.getByText(/1\/\d+ dosis marcadas/)).toBeVisible();
      await expect(bcgRow.getByText(/✓/)).toBeVisible();

      // Reload to confirm it stuck server-side, not just optimistic UI.
      await page.reload();
      await expect(page.getByText(/1\/\d+ dosis marcadas/)).toBeVisible();

      // Unmark it.
      await page.getByTestId("vaccine-dose-bcg-rn").getByText(/✓/).click();
      await page.getByRole("button", { name: "Quitar" }).click();
      await expect(page.getByText(/0\/\d+ dosis marcadas/)).toBeVisible();
    } finally {
      runFixture("delete", email);
    }
  });
});
