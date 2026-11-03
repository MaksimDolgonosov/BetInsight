import { expect, test } from "@playwright/test";

test("shows the English home page", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("heading", { name: "BetInsight" })).toBeVisible();
  await expect(
    page.getByText("Transparent AI forecasts for sports events."),
  ).toBeVisible();
});

test("shows the Russian home page", async ({ page }) => {
  await page.goto("/ru");
  await expect(page.getByRole("heading", { name: "BetInsight" })).toBeVisible();
  await expect(
    page.getByText("Прозрачные AI-прогнозы на спортивные события."),
  ).toBeVisible();
});

test("switches locale from the header", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("link", { name: "Русский" }).click();
  await expect(page).toHaveURL(/\/ru$/);
  await expect(
    page.getByText("Прозрачные AI-прогнозы на спортивные события."),
  ).toBeVisible();
});
