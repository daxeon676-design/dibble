import { describe, expect, it } from "vitest";

import { calculateOrderTotalCents, groupCartItemsBySeller } from "./checkout";

describe("checkout grouping and totals", () => {
  it("groups cart items by seller", () => {
    const grouped = groupCartItemsBySeller([
      { product: { sellerId: "seller-a" }, quantity: 2, unitPriceCts: 300 },
      { product: { sellerId: "seller-b" }, quantity: 1, unitPriceCts: 500 },
      { product: { sellerId: "seller-a" }, quantity: 3, unitPriceCts: 200 },
    ]);

    expect(grouped.get("seller-a")?.length).toBe(2);
    expect(grouped.get("seller-b")?.length).toBe(1);
  });

  it("calculates order total from quantity and price", () => {
    const total = calculateOrderTotalCents([
      { quantity: 2, unitPriceCts: 300 },
      { quantity: 1, unitPriceCts: 500 },
      { quantity: 3, unitPriceCts: 200 },
    ]);

    expect(total).toBe(1700);
  });
});
