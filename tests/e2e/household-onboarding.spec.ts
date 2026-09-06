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

test.describe("MiSuper household onboarding", () => {
  test("no household yet -- /mi-super redirects to onboarding, and creating one lands on Inicio", async ({ page }) => {
    const email = "e2e-misuper-create@example.com";
    runFixture("create", email);
    try {
      await login(page, email);
      await page.goto("/mi-super");
      await page.waitForURL((url) => url.pathname === "/mi-super/onboarding");

      await page.fill("#household-name", "Casa de Prueba");
      await page.getByRole("button", { name: "Crear hogar" }).click();
      await page.waitForURL((url) => url.pathname === "/mi-super");
      await expect(page.getByText("Hogar: Casa de Prueba")).toBeVisible();
    } finally {
      runFixture("delete", email);
    }
  });

  test("joining an existing household via invite code", async ({ page }) => {
    const ownerEmail = "e2e-misuper-owner@example.com";
    const joinerEmail = "e2e-misuper-joiner@example.com";
    const output = runFixture("create-with-household", ownerEmail, "Hogar Compartido");
    const { inviteCode } = JSON.parse(output.trim().split("\n").pop()!) as { inviteCode: string };
    runFixture("create", joinerEmail);

    try {
      await login(page, joinerEmail);
      await page.goto("/mi-super");
      await page.waitForURL((url) => url.pathname === "/mi-super/onboarding");

      await page.fill("#invite-code", inviteCode);
      await page.getByRole("button", { name: "Continuar" }).click();
      await page.waitForURL((url) => url.pathname === `/mi-super/join/${inviteCode}`);
      await expect(page.getByText('Unite a "Hogar Compartido"')).toBeVisible();

      await page.getByRole("button", { name: "Unirme al hogar" }).click();
      await page.waitForURL((url) => url.pathname === "/mi-super");
      await expect(page.getByText("Hogar: Hogar Compartido")).toBeVisible();
    } finally {
      runFixture("delete", joinerEmail);
      runFixture("delete", ownerEmail);
    }
  });
});
