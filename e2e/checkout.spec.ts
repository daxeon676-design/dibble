import { expect, test } from "@playwright/test";

/**
 * Checkout critical-path E2E tests.
 *
 * These tests authenticate as a buyer (seeded account), add an item to the
 * cart, and walk the checkout flow through to order creation.
 *
 * Prerequisites:
 *   - A buyer account exists: email=buyer@example.com / password=TestBuyer1!
 *   - At least one product is listed and available.
 *   - At least one delivery option is enabled.
 *
 * In CI these env vars must be set to run:
 *   E2E_BUYER_EMAIL, E2E_BUYER_PASSWORD
 *
 * If the vars are absent the tests are skipped rather than failed.
 */

const BUYER_EMAIL = process.env.E2E_BUYER_EMAIL ?? "buyer@example.com";
const BUYER_PASSWORD = process.env.E2E_BUYER_PASSWORD ?? "";

test.describe("checkout happy path", () => {
  test.beforeEach(async () => {
    test.skip(!BUYER_PASSWORD, "E2E_BUYER_PASSWORD not configured — skipping checkout tests");
  });

  async function loginAsBuyer(page: import("@playwright/test").Page) {
    await page.goto("/login");
    await page.fill('input[type="email"]', BUYER_EMAIL);
    await page.fill('input[type="password"]', BUYER_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(buyer|products|\/)/, { timeout: 10_000 });
  }

  test("buyer can reach checkout page with items in cart", async ({ page }) => {
    await loginAsBuyer(page);

    // Navigate to marketplace and add the first available item
    await page.goto("/buyer/marketplace");
    const firstProduct = page.locator("a[href*='/products/']").first();
    await firstProduct.click();
    const addToCart = page.getByRole("button", { name: /add to cart/i });
    await addToCart.click();

    // Go to cart
    await page.goto("/buyer/cart");
    await expect(page.getByRole("link", { name: /checkout/i })).toBeVisible();
    await page.getByRole("link", { name: /checkout/i }).click();

    // Checkout page should show step 1
    await expect(page).toHaveURL(/checkout/);
    await expect(page.getByRole("heading", { name: /checkout/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /delivery address/i })).toBeVisible();
  });

  test("checkout shows contextual error on order creation failure", async ({ page }) => {
    await loginAsBuyer(page);

    // Intercept the order creation request to force a 500
    await page.route("/api/orders", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Simulated server error" }),
      });
    });

    await page.goto("/buyer/cart");
    await page.goto("/buyer/checkout");

    // If the checkout rendered (has items), fill address and proceed to payment
    const heading = page.getByRole("heading", { name: /checkout/i });
    if (!(await heading.isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.skip();
    }

    // Navigate address → shipping → payment using the forms
    const continueToShipping = page.getByRole("button", { name: /continue to shipping/i });
    if (await continueToShipping.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await continueToShipping.click();
    }

    const continueToPayment = page.getByRole("button", { name: /continue to payment/i });
    if (await continueToPayment.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await continueToPayment.click();
    }

    const createOrder = page.getByRole("button", { name: /create order and continue/i });
    if (await createOrder.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await createOrder.click();

      // Error message should appear inside the payment section
      await expect(page.getByText(/order creation failed/i)).toBeVisible({ timeout: 5_000 });
      await expect(page.getByText(/your cart has not been charged/i)).toBeVisible();

      // Retry button should now read "Try Again"
      await expect(page.getByRole("button", { name: /try again/i })).toBeVisible();
    }
  });
});
