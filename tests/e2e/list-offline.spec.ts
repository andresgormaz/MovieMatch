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

test.describe("MiSuper offline check/uncheck", () => {
  test("a check made offline queues locally and syncs once back online", async ({ page }) => {
    const email = "e2e-misuper-offline@example.com";
    const output = runFixture("create-with-household", email, "Casa Offline");
    const { householdId } = JSON.parse(output.trim().split("\n").pop()!) as { householdId: string };
    const listOutput = runFixture("add-list", householdId, "Compra offline", "ACTIVE");
    const { listId } = JSON.parse(listOutput.trim()) as { listId: string };
    const itemOutput = runFixture("add-item", listId, householdId, "Leche");
    const { itemId } = JSON.parse(itemOutput.trim()) as { itemId: string };

    try {
      await login(page, email);
      await page.goto(`/mi-super/listas/${listId}`);
      await expect(page.getByText("0/1 comprados")).toBeVisible();

      await page.context().setOffline(true);

      const lecheCheckbox = page.getByRole("checkbox", { name: "Marcar Leche como comprado" });
      await lecheCheckbox.check();
      await expect(page.getByText("Sin conexión — 1 cambios pendientes")).toBeVisible();
      await expect(lecheCheckbox).toBeChecked();

      // Still queued locally -- nothing reached the server while offline.
      // (A full page reload isn't exercised here: without a service worker,
      // which is explicitly out of scope for this slice, the browser can't
      // serve the page itself while offline -- see plan section 6.)
      const stillUnsynced = JSON.parse(runFixture("get-item-checked", itemId).trim()) as { checked: boolean };
      expect(stillUnsynced.checked).toBe(false);

      await page.context().setOffline(false);
      await expect(page.getByText("Sin conexión — 1 cambios pendientes")).toHaveCount(0);
      await expect(page.getByText("1/1 comprados")).toBeVisible();

      const synced = JSON.parse(runFixture("get-item-checked", itemId).trim()) as { checked: boolean };
      expect(synced.checked).toBe(true);
    } finally {
      // setOffline(false) may not have been reached if an assertion above
      // failed -- make sure cleanup itself can still reach the network.
      await page.context().setOffline(false);
      runFixture("delete", email);
    }
  });
});
