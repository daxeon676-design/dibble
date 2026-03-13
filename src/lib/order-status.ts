import { OrderStatus, PaymentStatus } from "@/generated/prisma/enums";

export const allowedOrderTransitions: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: [OrderStatus.CANCELLED],
  PROCESSING: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  SHIPPED: [OrderStatus.DELIVERED],
  DELIVERED: [],
  CANCELLED: [],
};

export function canTransitionOrderStatus(
  currentStatus: OrderStatus,
  nextStatus: OrderStatus,
) {
  return allowedOrderTransitions[currentStatus].includes(nextStatus);
}

export function requiresSuccessfulPaymentForStatus(
  nextStatus: OrderStatus,
  paymentStatus: PaymentStatus | null | undefined,
) {
  if (nextStatus !== OrderStatus.PROCESSING) {
    return false;
  }

  return paymentStatus !== PaymentStatus.SUCCEEDED;
}
