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

test.describe("MarAntonia quick-log", () => {
  test("log one of each activity type and see them in today's feed with the right detail", async ({ page }) => {
    const email = "e2e-marantonia-activities@example.com";
    runFixture("create-with-child", email, "Bebé de Prueba", "MAMA");

    try {
      await login(page, email);
      await page.goto("/mar-antonia");

      await page.getByRole("button", { name: "Comida" }).click();
      await page.getByRole("button", { name: "Bien" }).click();
      await page.getByRole("button", { name: "Guardar" }).click();
      await expect(page.locator("ul li", { hasText: "Comida" })).toContainText("Bien");

      // Siesta needs a phase (inicio/fin) before the usual caregiver+time
      // fields apply.
      await page.locator(".grid-cols-3").getByRole("button", { name: "Siesta" }).click();
      await page.locator(".gap-3").getByRole("button", { name: "Inicio" }).click();
      await page.getByRole("button", { name: "Guardar" }).click();
      await expect(page.locator("ul li", { hasText: "Siesta" })).toContainText("en curso");

      await page.getByRole("button", { name: "Leche" }).click();
      await page.getByRole("button", { name: "6 oz" }).click();
      await page.getByRole("button", { name: "Guardar" }).click();
      await expect(page.locator("ul li", { hasText: "Leche" })).toContainText("6 oz");

      await page.getByRole("button", { name: "Despertada" }).click();
      await page.getByRole("button", { name: "Llorando" }).click();
      await page.getByRole("button", { name: "Guardar" }).click();
      await expect(page.locator("ul li", { hasText: "Despertada" })).toContainText("Llorando");

      await page.getByRole("button", { name: "Pañal" }).click();
      await page.getByRole("button", { name: "Caca" }).click();
      await page.getByRole("button", { name: "Mucha" }).click();
      await page.getByRole("button", { name: "Dura" }).click();
      await page.getByRole("button", { name: "Guardar" }).click();
      await expect(page.locator("ul li", { hasText: "Pañal" })).toContainText("Caca (mucha, dura)");

      await page.getByRole("button", { name: "Baño" }).click();
      await page.getByRole("button", { name: "Guardar" }).click();
      await expect(page.locator("ul li", { hasText: "Baño" })).toBeVisible();

      await page.getByRole("button", { name: "Paseo" }).click();
      await page.getByRole("button", { name: "Parque" }).click();
      await page.getByRole("button", { name: "Guardar" }).click();
      await expect(page.locator("ul li", { hasText: "Paseo" })).toContainText("Parque");

      const rows = page.locator("ul li");
      await expect(rows).toHaveCount(7);
      for (const row of await rows.all()) {
        await expect(row).toContainText("Mamá");
      }
    } finally {
      runFixture("delete", email);
    }
  });

  test("the time can be adjusted manually on create and on edit", async ({ page }) => {
    const email = "e2e-marantonia-time@example.com";
    runFixture("create-with-child", email, "Bebé de Prueba", "MAMA");

    try {
      await login(page, email);
      await page.goto("/mar-antonia");

      // The time field defaults to "now" but is editable before saving.
      await page.getByRole("button", { name: "Leche" }).click();
      await expect(page.locator("#activity-time")).not.toHaveValue("");
      await page.fill("#activity-time", "08:15");
      await page.getByRole("button", { name: "4 oz" }).click();
      await page.getByRole("button", { name: "Guardar" }).click();
      await expect(page.locator("ul li", { hasText: "Leche" })).toBeVisible();

      // Reopening for edit pre-fills the time it was actually saved with.
      await page.locator("ul li", { hasText: "Leche" }).click();
      await expect(page.locator("#activity-time")).toHaveValue("08:15");

      // Changing it on edit and reloading confirms it persisted server-side.
      await page.fill("#activity-time", "20:45");
      await page.getByRole("button", { name: "Guardar cambios" }).click();
      // Wait for the save to actually land before reloading -- otherwise the
      // navigation can cancel the in-flight PATCH request.
      await expect(page.locator("#activity-time")).toHaveCount(0);
      await page.reload();
      await page.locator("ul li", { hasText: "Leche" }).click();
      await expect(page.locator("#activity-time")).toHaveValue("20:45");
    } finally {
      runFixture("delete", email);
    }
  });

  test("saving is blocked until the required detail for the type is picked", async ({ page }) => {
    const email = "e2e-marantonia-activities-validation@example.com";
    runFixture("create-with-child", email, "Bebé de Prueba", "PAPA");

    try {
      await login(page, email);
      await page.goto("/mar-antonia");

      await page.getByRole("button", { name: "Leche" }).click();
      await page.getByRole("button", { name: "Guardar" }).click();
      await expect(page.getByText("Elige cuántas onzas.")).toBeVisible();
      await expect(page.locator("ul li")).toHaveCount(0);

      await page.getByRole("button", { name: "Paseo" }).click();
      await page.getByRole("button", { name: "Guardar" }).click();
      await expect(page.getByText("Elige el tipo de paseo.")).toBeVisible();
      await expect(page.locator("ul li")).toHaveCount(0);
    } finally {
      runFixture("delete", email);
    }
  });

  test("editing a Baño entry reassigns its caregiver, and a Paseo entry can change its destination", async ({
    page,
  }) => {
    const email = "e2e-marantonia-bath-outing@example.com";
    const output = runFixture("create-with-child", email, "Bebé de Prueba", "MAMA");
    const { childId } = JSON.parse(output.trim().split("\n").pop()!) as { childId: string };
    runFixture("add-caregiver", childId, "e2e-marantonia-bath-outing-papa@example.com", "PAPA");

    try {
      await login(page, email);
      await page.goto("/mar-antonia");

      // Baño has no detail field at all -- just caregiver + time.
      await page.getByRole("button", { name: "Baño" }).click();
      await page.getByRole("button", { name: "Guardar" }).click();
      await expect(page.locator("ul li", { hasText: "Baño" })).toContainText("Mamá");

      await page.locator("ul li", { hasText: "Baño" }).click();
      await page.getByRole("button", { name: "Papá" }).click();
      await page.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(page.locator("ul li", { hasText: "Baño" })).toContainText("Papá");

      // Paseo's destination is editable like any other detail field.
      await page.getByRole("button", { name: "Paseo" }).click();
      await page.getByRole("button", { name: "En coche" }).click();
      await page.getByRole("button", { name: "Guardar" }).click();
      await expect(page.locator("ul li", { hasText: "Paseo" })).toContainText("En coche");

      await page.locator("ul li", { hasText: "Paseo" }).click();
      await page.getByRole("button", { name: "Otro" }).click();
      await page.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(page.locator("ul li", { hasText: "Paseo" })).toContainText("Otro");
    } finally {
      runFixture("delete", "e2e-marantonia-bath-outing-papa@example.com");
      runFixture("delete", email);
    }
  });
});
