import path from "node:path";

import { expect, test } from "@playwright/test";

import { login } from "./helpers";

/**
 * E2E: pozycja zmiany skórnej na liście jest domyślnie zwinięta,
 * kliknięcie rozwija ją (formularz edycji + sekcja zdjęć), a wgrane
 * zdjęcie jest widoczne od razu. Test sprząta po sobie — usuwa zdjęcie.
 */
test("zmiana skórna: zwijanie i zdjęcia widoczne od razu po wgraniu", async ({
  page,
}) => {
  await login(page, "lekarz@gabinet.pl");
  await page.getByRole("button", { name: "Kartoteka" }).click();

  // raport kontrolny Jana Nowaka (dane seed)
  await page.getByRole("button", { name: /Wyraźna poprawa/ }).click();

  const findingItem = page
    .locator("li")
    .filter({ has: page.getByRole("button", { name: "Usuń", exact: true }) })
    .first();
  const header = findingItem.getByRole("button").first();

  // domyślnie zwinięta
  await expect(header).toHaveAttribute("aria-expanded", "false");

  // rozwinięcie: formularz edycji i sekcja zdjęć wewnątrz pozycji
  await header.click();
  await expect(header).toHaveAttribute("aria-expanded", "true");
  await expect(findingItem.getByLabel("Typ zmiany")).toBeVisible();

  const photosHeader = findingItem.getByText(/^Zdjęcia \(\d+\)$/);
  await expect(photosHeader).toBeVisible();
  const countBefore = Number(
    (await photosHeader.textContent())?.match(/\((\d+)\)/)?.[1] ?? "0",
  );

  // wgranie zdjęcia — miniatura widoczna od razu, licznik rośnie
  await findingItem
    .locator('input[type="file"]')
    .setInputFiles(path.join(__dirname, "fixtures", "zmiana.jpg"));
  const thumb = findingItem
    .getByRole("img", { name: "Zdjęcie zmiany skórnej" })
    .first();
  await expect(thumb).toBeVisible();
  await expect(
    findingItem.getByText(new RegExp(`^Zdjęcia \\(${countBefore + 1}\\)$`)),
  ).toBeVisible();

  // ponowne kliknięcie nagłówka zwija zmianę
  await header.click();
  await expect(header).toHaveAttribute("aria-expanded", "false");
  await expect(findingItem.getByLabel("Typ zmiany")).toBeHidden();

  // sprzątanie: rozwinięcie i usunięcie wgranego zdjęcia
  await header.click();
  await thumb.hover();
  await findingItem.getByRole("button", { name: "×" }).first().click();
  await expect(
    findingItem.getByText(new RegExp(`^Zdjęcia \\(${countBefore}\\)$`)),
  ).toBeVisible();
});
