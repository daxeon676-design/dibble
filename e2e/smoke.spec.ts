import { expect, test } from "@playwright/test";

/**
 * Smoke tests — verify key pages render without 500/404 and expose
 * the minimum expected structure.  These run against the live dev/staging
 * server and do NOT require an authenticated session.
 */

test("homepage loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).not.toHaveTitle(/error|not found/i);
  await expect(page.locator("main, body")).toBeVisible();
});

test("login page renders form", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /sign in|log in|welcome/i })).toBeVisible();
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
});

test("register page renders form", async ({ page }) => {
  await page.goto("/register");
  await expect(page.locator('input[type="email"]')).toBeVisible();
});

test("terms page renders full content", async ({ page }) => {
  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: /terms/i })).toBeVisible();
  await expect(page.locator("main")).toContainText("Governing Law");
});

test("privacy page renders full content", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: /privacy/i })).toBeVisible();
  await expect(page.locator("main")).toContainText("Data Retention");
});

test("health endpoint returns ok", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  const body = await response.json() as { status?: string };
  expect(body.status).toBe("ok");
});

test("marketplace page loads", async ({ page }) => {
  await page.goto("/buyer/marketplace");
  await expect(page).not.toHaveTitle(/error/i);
});

test("unauthenticated buyer/cart redirects to login", async ({ page }) => {
  await page.goto("/buyer/cart");
  await expect(page).toHaveURL(/\/login/);
});

test("unauthenticated admin redirects to login", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/);
});
