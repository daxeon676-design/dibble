import { describe, expect, it } from "vitest";

import { OrderStatus, PaymentStatus } from "@/generated/prisma/enums";
import { buildPaymentMutationPlan } from "./payment-state";

describe("payment finalization plan", () => {
  it("moves pending payment order to processing on success", () => {
    const plan = buildPaymentMutationPlan(
      PaymentStatus.PENDING,
      OrderStatus.PENDING_PAYMENT,
      "SUCCEEDED",
    );

    expect(plan.nextPaymentStatus).toBe(PaymentStatus.SUCCEEDED);
    expect(plan.nextOrderStatus).toBe(OrderStatus.PROCESSING);
  });

  it("does not downgrade succeeded payment on failed event", () => {
    const plan = buildPaymentMutationPlan(
      PaymentStatus.SUCCEEDED,
      OrderStatus.PROCESSING,
      "FAILED",
    );

    expect(plan.nextPaymentStatus).toBe(PaymentStatus.SUCCEEDED);
    expect(plan.nextOrderStatus).toBe(OrderStatus.PROCESSING);
  });
});
