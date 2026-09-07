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

test.describe("MarAntonia onboarding", () => {
  test("no child profile yet -- /mar-antonia redirects to onboarding, and creating one lands on Inicio", async ({
    page,
  }) => {
    const email = "e2e-marantonia-create@example.com";
    runFixture("create", email);
    try {
      await login(page, email);
      await page.goto("/mar-antonia");
      await page.waitForURL((url) => url.pathname === "/mar-antonia/onboarding");

      await page.getByRole("button", { name: "Soy mamá" }).click();
      await page.getByRole("button", { name: "Crear perfil" }).click();
      await page.waitForURL((url) => url.pathname === "/mar-antonia");
      await expect(page.getByText("MarAntonia")).toBeVisible();
    } finally {
      runFixture("delete", email);
    }
  });

  test("joining an existing child profile via invite code", async ({ page }) => {
    const ownerEmail = "e2e-marantonia-owner@example.com";
    const joinerEmail = "e2e-marantonia-joiner@example.com";
    const output = runFixture("create-with-child", ownerEmail, "Niña de Prueba", "MAMA");
    const { inviteCode } = JSON.parse(output.trim().split("\n").pop()!) as { inviteCode: string };
    runFixture("create", joinerEmail);

    try {
      await login(page, joinerEmail);
      await page.goto("/mar-antonia");
      await page.waitForURL((url) => url.pathname === "/mar-antonia/onboarding");

      await page.fill("#invite-code", inviteCode);
      await page.getByRole("button", { name: "Continuar" }).click();
      await page.waitForURL((url) => url.pathname === `/mar-antonia/join/${inviteCode}`);
      await expect(page.getByText('Unite al perfil de "Niña de Prueba"')).toBeVisible();

      await page.getByRole("button", { name: "Soy papá" }).click();
      await page.getByRole("button", { name: "Unirme" }).click();
      await page.waitForURL((url) => url.pathname === "/mar-antonia");
      await expect(page.getByText("Niña de Prueba")).toBeVisible();
    } finally {
      runFixture("delete", joinerEmail);
      runFixture("delete", ownerEmail);
    }
  });
});
