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
      // Scoped to the rename form specifically -- the birthDate/sex form
      // added below it has its own "Guardar" button too.
      await page.locator("form", { has: page.locator("#child-name") }).getByRole("button", { name: "Guardar" }).click();
      await expect(page.locator("#child-name")).toHaveValue("Perfil Renombrado");
    } finally {
      runFixture("delete", email);
    }
  });

  test("identity/emergency info (rut, pasaporte, tipo de sangre, notas) can be saved and edited", async ({ page }) => {
    const email = "e2e-marantonia-ajustes-identity@example.com";
    runFixture("create-with-child", email, "Bebé Identidad", "MAMA");

    try {
      await login(page, email);
      await page.goto("/mar-antonia/ajustes");

      const identityForm = page.locator("form", { has: page.locator("#child-legal-name") });
      await page.fill("#child-legal-name", "María Antonia Gormaz Rodríguez");
      await page.fill("#child-rut", "12.345.678-9");
      await page.fill("#child-passport", "P1234567");
      await page.selectOption("#child-blood-type", "O+");
      await page.fill("#child-medical-notes", "Alérgica a la penicilina");
      await identityForm.getByRole("button", { name: "Guardar" }).click();

      await expect(page.locator("#child-legal-name")).toHaveValue("María Antonia Gormaz Rodríguez");

      // Confirm it stuck server-side, not just optimistic UI.
      await page.reload();
      await expect(page.locator("#child-legal-name")).toHaveValue("María Antonia Gormaz Rodríguez");
      await expect(page.locator("#child-rut")).toHaveValue("12.345.678-9");
      await expect(page.locator("#child-passport")).toHaveValue("P1234567");
      await expect(page.locator("#child-blood-type")).toHaveValue("O+");
      await expect(page.locator("#child-medical-notes")).toHaveValue("Alérgica a la penicilina");
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
