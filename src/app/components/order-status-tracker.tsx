const STEPS = [
  { key: "PENDING_PAYMENT", label: "Payment Pending", icon: "💳" },
  { key: "PROCESSING", label: "Processing", icon: "📦" },
  { key: "SHIPPED", label: "Shipped", icon: "🚚" },
  { key: "DELIVERED", label: "Delivered", icon: "✅" },
] as const;

const CANCELLED_STEP = { key: "CANCELLED", label: "Cancelled", icon: "❌" };

type OrderStatus = "PENDING_PAYMENT" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED";

export default function OrderStatusTracker({ status }: { status: OrderStatus }) {
  if (status === "CANCELLED") {
    return (
      <div className="flex items-center gap-2 text-sm text-red-600 font-medium">
        <span>{CANCELLED_STEP.icon}</span>
        <span>{CANCELLED_STEP.label}</span>
      </div>
    );
  }

  const currentIndex = STEPS.findIndex((s) => s.key === status);

  return (
    <div className="w-full">
      <div className="flex items-center">
        {STEPS.map((step, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex;
          const future = i > currentIndex;

          return (
            <div key={step.key} className="flex items-center flex-1 last:flex-none">
              {/* Node */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm border-2 transition-colors ${
                    done
                      ? "bg-green-600 border-green-600 text-white"
                      : active
                      ? "bg-white border-green-600 text-green-700 font-bold"
                      : "bg-white border-gray-300 text-gray-400"
                  }`}
                >
                  {done ? "✓" : step.icon}
                </div>
                <span
                  className={`mt-1 text-xs text-center leading-tight max-w-15 ${
                    active ? "text-green-700 font-semibold" : future ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line (not after last step) */}
              {i < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-1 mb-5 ${
                    done ? "bg-green-500" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
