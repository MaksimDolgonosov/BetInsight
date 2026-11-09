import { expect, test } from "@playwright/test";

test("shows the English home page", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("link", { name: "BetInsight" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Upcoming forecasts" })).toBeVisible();
  await expect(page.getByText("Information service. It does not take bets")).toBeVisible();
});

test("shows the Russian home page", async ({ page }) => {
  await page.goto("/ru");
  await expect(page.getByRole("link", { name: "BetInsight" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ближайшие прогнозы" })).toBeVisible();
  await expect(page.getByText("Информационный сервис. Не принимает ставки")).toBeVisible();
});

test("switches locale from the header", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("link", { name: "RU", exact: true }).click();
  await expect(page).toHaveURL(/\/ru$/);
  await expect(page.getByText("Информационный сервис. Не принимает ставки")).toBeVisible();
});

test("opens forecasts, methodology and a missing event", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("link", { name: "Forecasts" }).first().click();
  await expect(page).toHaveURL(/\/en\/forecasts$/);
  await expect(page.getByRole("heading", { name: "Forecasts" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Upcoming" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Archive" })).toBeVisible();
  await page.getByRole("link", { name: "Methodology" }).first().click();
  await expect(page).toHaveURL(/\/en\/methodology$/);
  await expect(page.getByRole("heading", { name: "Methodology" })).toBeVisible();
  await expect(page.getByText("18+").first()).toBeVisible();
  await page.goto("/en/events/missing-event");
  await expect(page.getByText(/not found|404/i)).toBeVisible();
});

test("opens public statistics in both languages", async ({ page }) => {
  await page.goto("/en/stats");
  await expect(page.getByRole("heading", { name: "Statistics" })).toBeVisible();
  await expect(page.getByRole("link", { name: "CSV", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "RU", exact: true }).click();
  await expect(page).toHaveURL(/\/ru\/stats$/);
  await expect(page.getByRole("heading", { name: "Статистика" })).toBeVisible();
});
