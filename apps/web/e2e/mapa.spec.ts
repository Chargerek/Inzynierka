import { expect, test } from "@playwright/test";

import { login } from "./helpers";

/**
 * Smoke E2E: lekarz otwiera kartotekę pacjenta i mapa ciała (canvas Konvy)
 * renderuje się w edytorze raportu; przełącznik przód/tył działa.
 * Test niczego nie zapisuje — zamyka bez tworzenia danych.
 */
test("lekarz widzi mapę ciała w nowym raporcie", async ({ page }) => {
  await login(page, "lekarz@gabinet.pl");
  await expect(page).toHaveURL(/\/doctor/);

  await page.getByRole("button", { name: "Kartoteka" }).click();
  await page.getByPlaceholder("Szukaj pacjenta…").fill("Nowak");
  await page.getByRole("button", { name: /^Jan Nowak \d+ raport/ }).click();

  await page.getByRole("button", { name: /Nowy raport/ }).click();

  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible();
  await expect(page.getByRole("button", { name: "Przód" })).toBeVisible();

  await page.getByRole("button", { name: "Tył" }).click();
  await expect(canvas).toBeVisible();

  await page.getByRole("button", { name: "Przód" }).click();
  await expect(canvas).toBeVisible();
});
