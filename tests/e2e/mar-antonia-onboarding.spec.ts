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

  test("a caregiver who already has a profile can't create or join a second one", async ({ page }) => {
    const email = "e2e-marantonia-second-profile@example.com";
    const output = runFixture("create-with-child", email, "Perfil Propio", "PAPA");
    const { childId } = JSON.parse(output.trim().split("\n").pop()!) as { childId: string };
    const otherOwnerEmail = "e2e-marantonia-second-profile-other@example.com";
    const outputOther = runFixture("create-with-child", otherOwnerEmail, "Otro Perfil", "MAMA");
    const { inviteCode } = JSON.parse(outputOther.trim().split("\n").pop()!) as { inviteCode: string };

    try {
      await login(page, email);

      // The create endpoint rejects a second profile outright.
      const createRes = await page.request.post("/api/mar-antonia/children", {
        data: { name: "Segundo Intento", role: "PAPA" },
      });
      expect(createRes.status()).toBe(400);

      // Revisiting onboarding directly (e.g. a stale link) bounces straight
      // back to Inicio instead of showing the create/join screen again.
      await page.goto("/mar-antonia/onboarding");
      await page.waitForURL((url) => url.pathname === "/mar-antonia");

      // Trying to join someone else's profile is blocked in the UI...
      await page.goto(`/mar-antonia/join/${inviteCode}`);
      await expect(
        page.getByText("Ya perteneces a otro perfil de MarAntonia. No puedes unirte a este también."),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "Unirme" })).toHaveCount(0);

      // ...and at the API level too, so the block can't be bypassed.
      const joinRes = await page.request.post(`/api/mar-antonia/children/join/${inviteCode}`, {
        data: { role: "PAPA" },
      });
      expect(joinRes.status()).toBe(400);

      // Confirm nothing actually changed: still just the original profile's
      // caregiver, and the other profile still only has its own owner.
      const ownRes = await page.request.get("/api/mar-antonia/children/current");
      const ownBody = await ownRes.json();
      expect(ownBody.child.id).toBe(childId);
      expect(ownBody.caregivers).toHaveLength(1);
    } finally {
      runFixture("delete", email);
      runFixture("delete", otherOwnerEmail);
    }
  });
});
