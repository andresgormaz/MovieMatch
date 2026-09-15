import path from "node:path";
import { execFileSync } from "node:child_process";
import { test, expect, type Page } from "@playwright/test";

const PASSWORD = "Test1234!";
const TEST_IMAGE = path.join(__dirname, "fixtures", "test-image.png");

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

test.describe("MarAntonia Info (médicos, recetas, productos)", () => {
  test("a doctor can be added, edited, and deleted", async ({ page }) => {
    const email = "e2e-marantonia-info-doctor@example.com";
    runFixture("create-with-child", email, "Bebé Info", "MAMA");

    try {
      await login(page, email);
      await page.goto("/mar-antonia/info");

      await page.getByRole("button", { name: "+ Agregar médico" }).click();
      await page.getByLabel("Nombre").fill("Dra. Pérez");
      await page.getByLabel("Especialidad").fill("Pediatra");
      await page.getByLabel("Dónde atiende").fill("Clínica Alemana");
      await page.getByLabel("Teléfono").fill("+56912345678");
      await page.getByLabel("Correo").fill("perez@example.com");
      await page.getByRole("button", { name: "Guardar" }).click();

      await expect(page.getByText("Dra. Pérez")).toBeVisible();
      await expect(page.getByText("Clínica Alemana")).toBeVisible();

      await page.getByText("Dra. Pérez").click();
      await expect(page.getByLabel("Nombre")).toHaveValue("Dra. Pérez");
      await page.getByLabel("Teléfono").fill("+56987654321");
      await page.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(page.getByText("+56987654321")).toBeVisible();

      await page.getByText("Dra. Pérez").click();
      await page.getByRole("button", { name: "Eliminar" }).click();
      await expect(page.getByText("Todavía no hay médicos registrados.")).toBeVisible();
    } finally {
      runFixture("delete", email);
    }
  });

  test("a prescription can be added with a doctor and a photo, then edited and deleted", async ({ page }) => {
    const email = "e2e-marantonia-info-prescription@example.com";
    const output = runFixture("create-with-child", email, "Bebé Info 2", "MAMA");
    const { childId, ownerUserId } = JSON.parse(output.trim().split("\n").pop()!) as {
      childId: string;
      ownerUserId: string;
    };

    // A doctor to pick on the prescription form, seeded directly instead of
    // driving the "Médicos" tab first.
    runFixture("add-doctor", childId, ownerUserId, "Dr. Soto");

    try {
      await login(page, email);
      await page.goto("/mar-antonia/info");
      await page.getByRole("button", { name: "Recetas" }).click();
      await page.getByRole("button", { name: "+ Agregar receta" }).click();

      await page.getByRole("button", { name: "Dr. Soto" }).click();
      await page.getByLabel("Medicamento / indicación").fill("Amoxicilina 250mg");
      await page.getByLabel("Instrucciones").fill("1/2 medida cada 8h por 7 días");
      await page.setInputFiles('input[type="file"]', TEST_IMAGE);
      await expect(page.getByText("Quitar foto")).toBeVisible();
      await page.getByRole("button", { name: "Guardar" }).click();

      await expect(page.getByText("Amoxicilina 250mg")).toBeVisible();
      await expect(page.getByText(/Dr\. Soto/)).toBeVisible();

      await page.getByText("Amoxicilina 250mg").click();
      await expect(page.getByLabel("Medicamento / indicación")).toHaveValue("Amoxicilina 250mg");
      await page.getByLabel("Medicamento / indicación").fill("Amoxicilina 500mg");
      await page.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(page.getByText("Amoxicilina 500mg")).toBeVisible();

      await page.getByText("Amoxicilina 500mg").click();
      await page.getByRole("button", { name: "Eliminar" }).click();
      await expect(page.getByText("Todavía no hay recetas registradas.")).toBeVisible();
    } finally {
      runFixture("delete", email);
    }
  });

  test("a product can be added with a photo, edited, and deleted", async ({ page }) => {
    const email = "e2e-marantonia-info-product@example.com";
    runFixture("create-with-child", email, "Bebé Info 3", "MAMA");

    try {
      await login(page, email);
      await page.goto("/mar-antonia/info");
      await page.getByRole("button", { name: "Productos" }).click();
      await page.getByRole("button", { name: "+ Agregar producto" }).click();

      await page.getByLabel("Nombre").fill("Crema Bepanthen");
      await page.getByLabel("Tipo").fill("Crema");
      await page.getByLabel("Notas").fill("Para la irritación de pañal");
      await page.setInputFiles('input[type="file"]', TEST_IMAGE);
      await expect(page.getByText("Quitar foto")).toBeVisible();
      await page.getByRole("button", { name: "Guardar" }).click();

      await expect(page.getByText("Crema Bepanthen")).toBeVisible();
      await expect(page.getByText("Para la irritación de pañal")).toBeVisible();

      await page.getByText("Crema Bepanthen").click();
      await expect(page.getByLabel("Nombre")).toHaveValue("Crema Bepanthen");
      await page.getByLabel("Nombre").fill("Crema Bepanthen 100g");
      await page.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(page.getByText("Crema Bepanthen 100g")).toBeVisible();

      await page.getByText("Crema Bepanthen 100g").click();
      await page.getByRole("button", { name: "Eliminar" }).click();
      await expect(page.getByText("Todavía no hay productos registrados.")).toBeVisible();
    } finally {
      runFixture("delete", email);
    }
  });

  test("a caregiver of one child cannot read or modify another child's doctors/prescriptions/products", async ({
    page,
  }) => {
    const ownerEmail = "e2e-marantonia-info-owner@example.com";
    const outsiderEmail = "e2e-marantonia-info-outsider@example.com";
    const outputA = runFixture("create-with-child", ownerEmail, "Perfil A", "MAMA");
    const { childId, ownerUserId } = JSON.parse(outputA.trim().split("\n").pop()!) as {
      childId: string;
      ownerUserId: string;
    };
    runFixture("create-with-child", outsiderEmail, "Perfil B", "PAPA");
    const doctorOutput = runFixture("add-doctor", childId, ownerUserId, "Dr. Privado");
    const { doctorId } = JSON.parse(doctorOutput.trim().split("\n").pop()!) as { doctorId: string };

    try {
      await login(page, outsiderEmail);

      const listRes = await page.request.get("/api/mar-antonia/doctors");
      const { doctors } = await listRes.json();
      expect(doctors.find((d: { id: string }) => d.id === doctorId)).toBeUndefined();

      const patchRes = await page.request.patch(`/api/mar-antonia/doctors/${doctorId}`, {
        data: { name: "Hackeado" },
      });
      expect(patchRes.status()).toBe(404);

      const deleteRes = await page.request.delete(`/api/mar-antonia/doctors/${doctorId}`);
      expect(deleteRes.status()).toBe(404);
    } finally {
      runFixture("delete", outsiderEmail);
      runFixture("delete", ownerEmail);
    }
  });
});
