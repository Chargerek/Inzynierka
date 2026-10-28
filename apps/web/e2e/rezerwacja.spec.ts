import { expect, test } from "@playwright/test";

import { API_URL, DEMO_PASSWORD, login, nextMonday } from "./helpers";

/**
 * Smoke E2E: pacjent przechodzi cały kreator rezerwacji
 * (usługa → lekarz → termin → potwierdzenie).
 * Po teście nowa wizyta jest odwoływana przez API, żeby nie zostawiać śladów
 * w danych demo.
 */
test("pacjent rezerwuje wizytę przez kreator", async ({ page, request }) => {
  const authResponse = await request.post(`${API_URL}/auth/login`, {
    data: { email: "jan.nowak@gabinet.pl", password: DEMO_PASSWORD },
  });
  expect(authResponse.ok()).toBeTruthy();
  const { access_token: token } = await authResponse.json();
  const headers = { Authorization: `Bearer ${token}` };
  const appointmentIds = async (): Promise<number[]> => {
    const response = await request.get(`${API_URL}/appointments/me`, { headers });
    expect(response.ok()).toBeTruthy();
    return (await response.json()).map((item: { id: number }) => item.id);
  };

  const before = await appointmentIds();

  try {
    await login(page, "jan.nowak@gabinet.pl");
    await expect(page).toHaveURL(/\/panel/);

    await page.goto("/panel/umow");
    await expect(
      page.getByRole("heading", { name: "Umów wizytę" }),
    ).toBeVisible();

    await page.getByRole("button", { name: /Kontrola/ }).click();
    await page.getByRole("button", { name: "Dalej" }).click();

    await page.getByRole("button", { name: /Anna Kowalska/ }).click();
    await page.getByRole("button", { name: "Dalej" }).click();

    await page.locator('input[type="date"]').fill(nextMonday());
    const slot = page.getByRole("button", { name: /^\d{1,2}:\d{2}$/ }).first();
    await expect(slot).toBeVisible();
    await slot.click();
    await page.getByRole("button", { name: "Dalej" }).click();

    await page
      .getByRole("button", { name: "Potwierdź rezerwację" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Wizyta zarezerwowana" }),
    ).toBeVisible();

    // odwołanie przez dialog potwierdzający (sprzątanie po teście)
    await page.goto("/panel");
    await page.getByRole("button", { name: "Odwołaj" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Odwołać wizytę?" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Czy na pewno chcesz odwołać wizytę");
    await dialog.getByRole("button", { name: "Tak, odwołaj" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Odwołana").first()).toBeVisible();
  } finally {
    const after = await appointmentIds();
    for (const id of after.filter((id) => !before.includes(id))) {
      await request.post(`${API_URL}/appointments/${id}/cancel`, { headers });
    }
  }
});
