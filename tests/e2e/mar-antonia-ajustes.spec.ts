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

test.describe("MarAntonia Ajustes", () => {
  test("rename the child profile and see the caregiver list", async ({ page }) => {
    const email = "e2e-marantonia-ajustes-owner@example.com";
    runFixture("create-with-child", email, "Perfil Original", "MAMA");

    try {
      await login(page, email);
      await page.goto("/mar-antonia/ajustes");

      await expect(page.getByText("Mamá")).toBeVisible();

      await page.fill("#child-name", "Perfil Renombrado");
      await page.getByRole("button", { name: "Guardar" }).click();
      await expect(page.locator("#child-name")).toHaveValue("Perfil Renombrado");
    } finally {
      runFixture("delete", email);
    }
  });

  test("a caregiver of one child cannot read or rename another child's profile", async ({ page }) => {
    const ownerEmail = "e2e-marantonia-ajustes-owner2@example.com";
    const outsiderEmail = "e2e-marantonia-ajustes-outsider@example.com";
    const outputA = runFixture("create-with-child", ownerEmail, "Perfil A", "MAMA");
    const { childId } = JSON.parse(outputA.trim().split("\n").pop()!) as { childId: string };
    runFixture("create-with-child", outsiderEmail, "Perfil B", "PAPA");

    try {
      await login(page, outsiderEmail);

      const caregiversRes = await page.request.get(`/api/mar-antonia/children/${childId}/caregivers`);
      expect(caregiversRes.status()).toBe(403);

      const renameRes = await page.request.patch(`/api/mar-antonia/children/${childId}`, {
        data: { name: "Hackeado" },
      });
      expect(renameRes.status()).toBe(403);
    } finally {
      runFixture("delete", outsiderEmail);
      runFixture("delete", ownerEmail);
    }
  });
});
