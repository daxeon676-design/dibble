import { describe, expect, it } from "vitest";

import { OrderStatus, PaymentStatus } from "@/generated/prisma/enums";
import {
  canTransitionOrderStatus,
  requiresSuccessfulPaymentForStatus,
} from "./order-status";

describe("order status transitions", () => {
  it("allows processing to shipped", () => {
    expect(canTransitionOrderStatus(OrderStatus.PROCESSING, OrderStatus.SHIPPED)).toBe(true);
  });

  it("rejects pending payment to delivered", () => {
    expect(canTransitionOrderStatus(OrderStatus.PENDING_PAYMENT, OrderStatus.DELIVERED)).toBe(false);
  });

  it("requires successful payment before processing", () => {
    expect(
      requiresSuccessfulPaymentForStatus(OrderStatus.PROCESSING, PaymentStatus.PENDING),
    ).toBe(true);
    expect(
      requiresSuccessfulPaymentForStatus(OrderStatus.PROCESSING, PaymentStatus.SUCCEEDED),
    ).toBe(false);
  });
});
