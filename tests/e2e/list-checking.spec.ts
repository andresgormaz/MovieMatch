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

test.describe("MiSuper check/uncheck and finishing a purchase", () => {
  test("check an item, undo it, then finish the purchase", async ({ page }) => {
    const email = "e2e-misuper-checking@example.com";
    const output = runFixture("create-with-household", email, "Casa Compras");
    const { householdId } = JSON.parse(output.trim().split("\n").pop()!) as { householdId: string };
    const listOutput = runFixture("add-list", householdId, "Compra del súper", "ACTIVE");
    const { listId } = JSON.parse(listOutput.trim()) as { listId: string };
    runFixture("add-item", listId, householdId, "Leche");
    runFixture("add-item", listId, householdId, "Pan");

    try {
      await login(page, email);
      await page.goto(`/mi-super/listas/${listId}`);

      await expect(page.getByText("0/2 comprados")).toBeVisible();

      const lecheCheckbox = page.getByRole("checkbox", { name: "Marcar Leche como comprado" });
      await lecheCheckbox.check();
      await expect(page.getByText("1/2 comprados")).toBeVisible();
      await expect(lecheCheckbox).toBeChecked();

      // Checked items sink to the bottom of their group -- Leche should now
      // render after Pan even though it sorts first alphabetically.
      const nameInputs = await page.locator('li input:not([type="checkbox"])').all();
      const values = await Promise.all(nameInputs.map((el) => el.inputValue()));
      expect(values).toEqual(["Pan", "Leche"]);

      // Undo -- unchecking moves it back into alphabetical order.
      await lecheCheckbox.uncheck();
      await expect(page.getByText("0/2 comprados")).toBeVisible();
      const revertedInputs = await page.locator('li input:not([type="checkbox"])').all();
      const revertedValues = await Promise.all(revertedInputs.map((el) => el.inputValue()));
      expect(revertedValues).toEqual(["Leche", "Pan"]);

      // "Terminar compra" needs no items checked and no confirmation.
      await page.getByRole("button", { name: "Terminar compra" }).click();
      await page.waitForURL((url) => url.pathname === "/mi-super/listas");
      const completadasSection = page.locator("section", { has: page.getByRole("heading", { name: "Completadas" }) });
      await expect(completadasSection.getByText("Compra del súper")).toBeVisible();
    } finally {
      runFixture("delete", email);
    }
  });
});
