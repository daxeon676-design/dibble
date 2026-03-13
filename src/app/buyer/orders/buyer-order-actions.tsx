"use client";

import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { type FormEvent, useState } from "react";

type Props = {
  orderId: string;
  canPay: boolean;
};

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

type ConfirmPaymentFormProps = {
  orderId: string;
  onSuccess: () => void;
};

function ConfirmPaymentForm({ orderId, onSuccess }: ConfirmPaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setState("loading");
    setError(null);

    const result = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (result.error) {
      setState("error");
      setError(result.error.message ?? "Card payment failed.");
      return;
    }

    if (result.paymentIntent?.status !== "succeeded") {
      setState("error");
      setError("Payment has not completed yet.");
      return;
    }

    const response = await fetch("/api/payments/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId,
        paymentIntentId: result.paymentIntent.id,
        simulate: false,
      }),
    });

    if (!response.ok) {
      setState("error");
      setError("Payment was captured but order confirmation failed.");
      return;
    }

    onSuccess();
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 space-y-3">
      <PaymentElement />
      <button
        type="submit"
        disabled={state === "loading" || !stripe || !elements}
        className="rounded-md bg-emerald-500 px-3 py-1 text-sm font-semibold text-slate-950 disabled:opacity-60"
      >
        {state === "loading" ? "Processing..." : "Pay Now"}
      </button>
      {error ? <span className="block text-xs text-red-300">{error}</span> : null}
    </form>
  );
}

export function BuyerOrderActions({ orderId, canPay }: Props) {
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!canPay) {
    return null;
  }

  async function payNow() {
    if (!stripePromise) {
      const response = await fetch("/api/payments/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, simulate: true }),
      });

      if (!response.ok) {
        setState("error");
        setError("Payment failed.");
        return;
      }

      window.location.reload();
      return;
    }

    setState("loading");
    setError(null);

    const intentResponse = await fetch("/api/payments/intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    });

    const intentBody = (await intentResponse.json().catch(() => null)) as
      | { clientSecret?: string; error?: string }
      | null;

    if (!intentResponse.ok || !intentBody?.clientSecret) {
      setState("error");
      setError(intentBody?.error ?? "Could not initialize card payment.");
      return;
    }

    setClientSecret(intentBody.clientSecret);
    setState("ready");
  }

  function onPaymentSuccess() {
    window.location.reload();
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={payNow}
        disabled={state === "loading" || state === "ready"}
        className="rounded-md bg-emerald-500 px-3 py-1 text-sm font-semibold text-slate-950 disabled:opacity-60"
      >
        {state === "loading"
          ? "Initializing..."
          : stripePromise
            ? "Pay with Card"
            : "Pay Now (Test)"}
      </button>

      {state === "ready" && clientSecret && stripePromise ? (
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <ConfirmPaymentForm orderId={orderId} onSuccess={onPaymentSuccess} />
        </Elements>
      ) : null}

      {state === "error" ? <span className="ml-3 text-xs text-red-300">{error ?? "Payment failed"}</span> : null}
    </div>
  );
}
