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

test.describe("MarAntonia Crecimiento", () => {
  test("without birth info, a warning shows but a measurement can still be logged", async ({ page }) => {
    const email = "e2e-marantonia-growth-nobirth@example.com";
    runFixture("create-with-child", email, "Bebé Crecimiento", "MAMA");

    try {
      await login(page, email);
      await page.goto("/mar-antonia/crecimiento");

      await expect(page.getByText(/necesitamos la fecha de nacimiento y el sexo/)).toBeVisible();

      await page.getByRole("button", { name: "+ Registrar medida" }).click();
      await page.fill("#growth-weight", "4.2");
      await page.getByRole("button", { name: "Guardar" }).click();

      await expect(page.getByText("4.2 kg")).toBeVisible();
      // No birthDate/sex yet -- no chart should render.
      await expect(page.getByText("Peso para la edad")).not.toBeVisible();
    } finally {
      runFixture("delete", email);
    }
  });

  test("with birth info set, logging measurements renders the growth charts and supports edit/delete", async ({
    page,
  }) => {
    const email = "e2e-marantonia-growth@example.com";
    runFixture("create-with-child", email, "Bebé Crecimiento 2", "MAMA");

    try {
      await login(page, email);

      // Set birth info first (Ajustes).
      await page.goto("/mar-antonia/ajustes");
      await page.fill("#child-birthdate", "2025-06-01");
      await page.getByRole("button", { name: "Niña" }).click();
      await page.locator("form", { has: page.locator("#child-birthdate") }).getByRole("button", { name: "Guardar" }).click();
      await expect(page.locator("#child-birthdate")).toHaveValue("2025-06-01");

      await page.goto("/mar-antonia/crecimiento");
      await expect(page.getByText(/necesitamos la fecha de nacimiento y el sexo/)).not.toBeVisible();

      // Log a first measurement (2 months old).
      await page.getByRole("button", { name: "+ Registrar medida" }).click();
      await page.fill("#growth-date", "2025-08-01");
      await page.fill("#growth-weight", "5.6");
      await page.fill("#growth-height", "58");
      await page.fill("#growth-head", "39");
      await page.getByRole("button", { name: "Guardar" }).click();

      await expect(page.getByText("Peso para la edad")).toBeVisible();
      await expect(page.getByText("Estatura para la edad")).toBeVisible();
      await expect(page.getByText("Circunferencia de cabeza para la edad")).toBeVisible();
      await expect(page.getByText(/5\.6 kg/)).toBeVisible();

      // Edit it -- fix a typo'd weight.
      await page.getByText(/5\.6 kg/).click();
      await page.fill("#growth-weight", "5.8");
      await page.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(page.getByText(/5\.8 kg/)).toBeVisible();
      await expect(page.getByText(/5\.6 kg/)).not.toBeVisible();

      // Delete it.
      await page.getByText(/5\.8 kg/).click();
      await page.getByRole("button", { name: "Eliminar" }).click();
      await expect(page.getByText("Todavía no hay medidas registradas.")).toBeVisible();
    } finally {
      runFixture("delete", email);
    }
  });
});
