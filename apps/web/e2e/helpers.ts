import { expect, type Page } from "@playwright/test";

export const DEMO_PASSWORD = "Demo123!";
export const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:8000";

export async function login(
  page: Page,
  email: string,
  password: string = DEMO_PASSWORD,
) {
  await page.goto("/login");
  await page.getByLabel("Adres e-mail").fill(email);
  await page.getByLabel("Hasło").fill(password);
  await page.getByRole("button", { name: "Zaloguj się" }).click();
  // po zalogowaniu następuje przekierowanie na panel właściwy dla roli
  await expect(page).not.toHaveURL(/\/login/);
}

/** Następny poniedziałek (dzień roboczy) w formacie YYYY-MM-DD. */
export function nextMonday(): string {
  const date = new Date();
  const delta = ((8 - date.getDay()) % 7) || 7;
  date.setDate(date.getDate() + delta);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
