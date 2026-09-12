import { execFileSync } from "node:child_process";
import { test, expect, type Page } from "@playwright/test";

const EMAIL = "e2e-hub@example.com";
const PASSWORD = "Test1234!";

function runFixture(action: "create" | "delete") {
  execFileSync("npx", ["tsx", "tests/e2e/fixtures/seed.ts", action, EMAIL], { stdio: "inherit" });
}

async function login(page: Page) {
  await page.goto("/login");
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => url.pathname === "/");
}

test.describe("Super-app hub", () => {
  test.beforeAll(() => {
    runFixture("create");
  });

  test.afterAll(() => {
    runFixture("delete");
  });

  test("logged out, \"/\" still shows the MovieMatch marketing page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /próxima.*favorita/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Empezar gratis" })).toBeVisible();
  });

  test("logged in, \"/\" shows the hub with a tile for each app", async ({ page }) => {
    await login(page);
    await expect(page.getByRole("link", { name: /MovieMatch/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /MiSuper/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /MarAntonia/ })).toBeVisible();
    await expect(page.getByText("MisCuentas")).toBeVisible();
    await expect(page.getByText("MiAgenda")).toBeVisible();
  });

  test("MovieMatch's own nav is untouched -- reached via the hub, not replaced", async ({ page }) => {
    await login(page);
    await page.getByRole("link", { name: /MovieMatch/ }).click();
    await page.waitForURL((url) => url.pathname === "/dashboard");

    // Bottom nav shows MovieMatch's 5 tabs, not MiSuper's -- scoped to that
    // one <nav> since the (CSS-hidden at this viewport, but still in the
    // DOM) desktop nav has some of the same link names.
    const bottomNav = page.locator('nav[aria-label="Navegación principal"]');
    await expect(bottomNav.getByRole("link", { name: "Para ti", exact: true })).toBeVisible();
    await expect(bottomNav.getByRole("link", { name: "Tus gustos", exact: true })).toBeVisible();
    await expect(bottomNav.getByRole("link", { name: "Social", exact: true })).toBeVisible();
    await expect(bottomNav.getByRole("link", { name: "Listas", exact: true })).toHaveCount(0);
  });
});
