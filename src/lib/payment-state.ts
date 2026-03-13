import { OrderStatus, PaymentStatus } from "@/generated/prisma/enums";

type FinalizeStatus = "SUCCEEDED" | "FAILED";

export function buildPaymentMutationPlan(
  currentPaymentStatus: PaymentStatus,
  currentOrderStatus: OrderStatus,
  incomingStatus: FinalizeStatus,
) {
  let nextPaymentStatus = currentPaymentStatus;
  let nextOrderStatus = currentOrderStatus;

  if (incomingStatus === "SUCCEEDED") {
    nextPaymentStatus = PaymentStatus.SUCCEEDED;
    if (currentOrderStatus === OrderStatus.PENDING_PAYMENT) {
      nextOrderStatus = OrderStatus.PROCESSING;
    }
  } else if (currentPaymentStatus !== PaymentStatus.SUCCEEDED) {
    // Never overwrite a successful payment with failed.
    nextPaymentStatus = PaymentStatus.FAILED;
  }

  return { nextPaymentStatus, nextOrderStatus };
}
