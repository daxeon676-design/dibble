"use client";

import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type CartData = {
  id: string;
  items: Array<{
    id: string;
    quantity: number;
    unitPriceCts: number;
    variantId?: string | null;
    variantLabel?: string | null;
    product: {
      id: string;
      title: string;
      priceCents: number;
    };
  }>;
};

type DeliveryOption = {
  id: string;
  name: string;
  costPence: number;
  enabled: boolean;
};

type Address = {
  id?: string;
  fullName: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  postalCode: string;
  country: string;
  isDefault?: boolean;
};

type Props = {
  initialCart: CartData;
  initialUser: {
    email: string | null;
    displayName: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    postcode: string | null;
    country: string | null;
  } | null;
  initialSavedAddresses: Address[];
  initialSavedPaymentMethods: Array<{
    id: string;
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  }>;
  deliveryOptions: DeliveryOption[];
};

type CheckoutState = "address" | "shipping" | "payment";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

function shippingSurchargeByPostcode(postalCode: string): number {
  const normalized = postalCode.toUpperCase().replace(/\s+/g, "");
  if (/^(HS|IV|KW|PA|PH|ZE)/.test(normalized)) return 450;
  if (/^(BT)/.test(normalized)) return 300;
  if (/^(GY|JE|IM)/.test(normalized)) return 400;
  return 0;
}

// ── Stripe payment form ──────────────────────────────────────────────────────

type PaymentFormProps = {
  pendingCheckoutId: string | null;
  simMode: boolean;
  onError: (msg: string) => void;
  onConfirmFailure: (paymentIntentId: string, msg: string) => void;
};

function StripePaymentForm({ pendingCheckoutId, simMode, onError, onConfirmFailure }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    onError("");

    const result = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (result.error) {
      onError(result.error.message ?? "Card payment failed. Please try a different card.");
      setSubmitting(false);
      return;
    }

    if (result.paymentIntent?.status !== "succeeded") {
      onError("Payment has not completed. Please try again.");
      setSubmitting(false);
      return;
    }

    const confirmRes = await fetch("/api/checkout/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentIntentId: result.paymentIntent.id,
        pendingCheckoutId,
        simulate: false,
      }),
    });

    if (!confirmRes.ok) {
      const body = (await confirmRes.json().catch(() => null)) as { error?: string } | null;
      onConfirmFailure(
        result.paymentIntent.id,
        body?.error ?? "Your payment was received but we could not confirm your order. Please contact support.",
      );
      setSubmitting(false);
      return;
    }

    window.location.href = "/buyer/orders?checkout=success";
  }

  if (simMode) {
    return <SimulatePaymentForm pendingCheckoutId={pendingCheckoutId} onError={onError} />;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <PaymentElement />
      <button
        type="submit"
        disabled={submitting || !stripe || !elements}
        className="w-full rounded-md bg-(--accent-terra) px-4 py-3 font-semibold text-(--accent-beige) hover:opacity-90 disabled:opacity-60"
      >
        {submitting ? "Processing payment..." : "Pay Now"}
      </button>
    </form>
  );
}

function SimulatePaymentForm({
  pendingCheckoutId,
  onError,
}: {
  pendingCheckoutId: string | null;
  onError: (msg: string) => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  async function onSimulate() {
    setSubmitting(true);
    onError("");

    const res = await fetch("/api/checkout/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pendingCheckoutId, simulate: true }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      onError(body?.error ?? "Simulated payment failed.");
      setSubmitting(false);
      return;
    }

    window.location.href = "/buyer/orders?checkout=success";
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-amber-500 bg-amber-50 p-3 text-sm text-amber-800">
        Stripe is not configured — using simulation mode.
      </div>
      <button
        type="button"
        disabled={submitting}
        onClick={onSimulate}
        className="w-full rounded-md bg-(--accent-terra) px-4 py-3 font-semibold text-(--accent-beige) hover:opacity-90 disabled:opacity-60"
      >
        {submitting ? "Processing..." : "Simulate Payment"}
      </button>
    </div>
  );
}

// ── Payment step container ───────────────────────────────────────────────────

type PaymentStepProps = {
  address: Address;
  selectedDeliveryId: string;
  couponCode: string | null;
  onCouponResolved: (coupon: { code: string; discountCents: number } | null) => void;
};

function PaymentStep({ address, selectedDeliveryId, couponCode, onCouponResolved }: PaymentStepProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [pendingCheckoutId, setPendingCheckoutId] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [retryPaymentIntentId, setRetryPaymentIntentId] = useState<string | null>(null);
  const [retryingConfirmation, setRetryingConfirmation] = useState(false);
  const fetchedRef = useRef(false);
  const simMode = !stripePromise;

  async function retryConfirmationOnly() {
    if (!retryPaymentIntentId) {
      return;
    }

    setRetryingConfirmation(true);
    setPayError(null);

    const confirmRes = await fetch("/api/checkout/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentIntentId: retryPaymentIntentId,
        pendingCheckoutId,
        simulate: false,
      }),
    });

    if (!confirmRes.ok) {
      const body = (await confirmRes.json().catch(() => null)) as { error?: string } | null;
      setPayError(body?.error ?? "We still could not confirm your paid order. Please contact support.");
      setRetryingConfirmation(false);
      return;
    }

    window.location.href = "/buyer/orders?checkout=success";
  }

  const initSession = useCallback(async () => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    setLoadState("loading");
    setLoadError(null);

    const res = await fetch("/api/checkout/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deliveryOptionId: selectedDeliveryId,
        couponCode: couponCode ?? undefined,
        address: {
          fullName: address.fullName,
          addressLine1: address.addressLine1,
          addressLine2: address.addressLine2,
          city: address.city,
          postalCode: address.postalCode,
          country: address.country,
        },
      }),
    });

    const body = (await res.json().catch(() => null)) as {
      clientSecret?: string | null;
      pendingCheckoutId?: string;
      discountCents?: number;
      appliedCouponCode?: string | null;
      error?: string;
    } | null;

    if (!res.ok || !body) {
      setLoadError(body?.error ?? "Failed to initialise payment. Please try again.");
      setLoadState("error");
      onCouponResolved(null);
      fetchedRef.current = false;
      return;
    }

    setClientSecret(body.clientSecret ?? null);
    setPendingCheckoutId(body.pendingCheckoutId ?? null);
    if (body.appliedCouponCode && (body.discountCents ?? 0) > 0) {
      onCouponResolved({
        code: body.appliedCouponCode,
        discountCents: body.discountCents ?? 0,
      });
    } else {
      onCouponResolved(null);
    }
    setLoadState("ready");
  }, [address, couponCode, onCouponResolved, selectedDeliveryId]);

  useEffect(() => {
    fetchedRef.current = false;
    const timer = setTimeout(() => {
      void initSession();
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [initSession]);

  if (loadState === "loading") {
    return <p className="text-sm text-foreground/60">Preparing secure payment...</p>;
  }

  if (loadState === "error") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-500">{loadError}</p>
        <button
          type="button"
          onClick={() => {
            fetchedRef.current = false;
            void initSession();
          }}
          className="rounded-md border border-foreground/20 px-3 py-1 text-sm"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {payError ? (
        <div className="rounded-md border border-red-500 bg-red-50 p-3 text-sm text-red-700">
          {payError}
        </div>
      ) : null}

      {retryPaymentIntentId ? (
        <button
          type="button"
          onClick={() => void retryConfirmationOnly()}
          disabled={retryingConfirmation}
          className="w-full rounded-md border border-(--accent-terra)/40 px-4 py-3 text-sm font-semibold text-(--accent-terra) hover:bg-(--accent-beige)/60 disabled:opacity-60"
        >
          {retryingConfirmation ? "Confirming paid order..." : "Retry order confirmation"}
        </button>
      ) : null}

      {simMode ? (
        <SimulatePaymentForm pendingCheckoutId={pendingCheckoutId} onError={setPayError} />
      ) : clientSecret ? (
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <p className="text-xs text-foreground/60">
            Apple Pay or Google Pay will appear automatically on supported devices.
          </p>
          <StripePaymentForm
            pendingCheckoutId={pendingCheckoutId}
            simMode={false}
            onError={setPayError}
            onConfirmFailure={(paymentIntentId, message) => {
              setRetryPaymentIntentId(paymentIntentId);
              setPayError(message);
            }}
          />
        </Elements>
      ) : (
        <SimulatePaymentForm pendingCheckoutId={pendingCheckoutId} onError={setPayError} />
      )}
    </div>
  );
}

// ── Main checkout component ──────────────────────────────────────────────────

export function CheckoutClient({
  initialCart,
  initialUser,
  initialSavedAddresses,
  initialSavedPaymentMethods,
  deliveryOptions,
}: Props) {
  const [currentStep, setCurrentStep] = useState<CheckoutState>("address");
  const [error, setError] = useState<string | null>(null);

  const hasSavedAddresses = initialSavedAddresses.length > 0;
  const defaultSaved = initialSavedAddresses.find((addr) => addr.isDefault) ?? initialSavedAddresses[0];

  const [selectedAddressMode, setSelectedAddressMode] = useState<"saved" | "new">(
    hasSavedAddresses ? "saved" : "new",
  );
  const [selectedAddressId, setSelectedAddressId] = useState(defaultSaved?.id ?? "");
  const [newAddress, setNewAddress] = useState<Address>({
    fullName: initialUser?.displayName ?? "",
    addressLine1: initialUser?.addressLine1 ?? "",
    addressLine2: initialUser?.addressLine2 ?? "",
    city: initialUser?.city ?? "",
    postalCode: initialUser?.postcode ?? "",
    country: initialUser?.country ?? "United Kingdom",
  });

  const [selectedDeliveryId, setSelectedDeliveryId] = useState(deliveryOptions[0]?.id ?? "");
  const [couponInput, setCouponInput] = useState("");
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [resolvedCoupon, setResolvedCoupon] = useState<{ code: string; discountCents: number } | null>(null);

  const selectedDelivery = deliveryOptions.find((d) => d.id === selectedDeliveryId);

  const selectedAddress =
    selectedAddressMode === "saved"
      ? (initialSavedAddresses.find((a) => a.id === selectedAddressId) ?? defaultSaved ?? newAddress)
      : newAddress;

  const subtotal = useMemo(
    () => initialCart.items.reduce((sum, item) => sum + item.unitPriceCts * item.quantity, 0),
    [initialCart.items],
  );

  const postcodeSurcharge = useMemo(
    () => shippingSurchargeByPostcode(selectedAddress.postalCode ?? ""),
    [selectedAddress.postalCode],
  );

  const deliveryCost = (selectedDelivery?.costPence ?? 0) + postcodeSurcharge;
  const total = subtotal + deliveryCost;
  const totalAfterDiscount = Math.max(0, total - (resolvedCoupon?.discountCents ?? 0));

  function validateAddress(address: Address) {
    return Boolean(
      address.fullName && address.addressLine1 && address.city && address.postalCode && address.country,
    );
  }

  function handleAddressSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const addressToValidate =
      selectedAddressMode === "saved"
        ? initialSavedAddresses.find((addr) => addr.id === selectedAddressId)
        : newAddress;

    if (!addressToValidate || !validateAddress(addressToValidate)) {
      setError("Please complete a valid delivery address.");
      return;
    }

    setCurrentStep("shipping");
  }

  function handleShippingSubmit() {
    if (!selectedDeliveryId) {
      setError("Please select a shipping option.");
      return;
    }
    setError(null);
    setCurrentStep("payment");
  }

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-16 text-foreground">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Checkout</h1>
        <Link href="/buyer/cart" className="text-sm text-foreground/60 hover:text-foreground/80">
          Cancel and return to cart
        </Link>
      </div>

      {error ? (
        <div className="mb-6 rounded-md border border-red-500 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">

          <section
            className={`rounded-md border p-6 ${
              currentStep === "address"
                ? "border-(--accent-terra) bg-(--accent-beige)"
                : "border-(--accent-terra)/30 bg-(--accent-beige)/40"
            }`}
          >
            <h2 className="mb-4 text-xl font-semibold">1. Delivery Address</h2>

            {currentStep !== "address" ? (
              <div className="text-sm">
                <p>{selectedAddress.fullName}</p>
                <p>{selectedAddress.addressLine1}</p>
                {selectedAddress.addressLine2 ? <p>{selectedAddress.addressLine2}</p> : null}
                <p>{selectedAddress.city}, {selectedAddress.postalCode}</p>
                <button
                  type="button"
                  onClick={() => setCurrentStep("address")}
                  className="mt-2 text-sm text-(--accent-terra) underline hover:opacity-80"
                >
                  Change address
                </button>
              </div>
            ) : (
              <form onSubmit={handleAddressSubmit} className="space-y-4">
                {hasSavedAddresses ? (
                  <div className="rounded-md border border-(--accent-terra)/30 p-3">
                    <label className="mb-2 block text-sm font-medium">Use a saved address</label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          checked={selectedAddressMode === "saved"}
                          onChange={() => setSelectedAddressMode("saved")}
                        />
                        Saved addresses
                      </label>
                      {selectedAddressMode === "saved" ? (
                        <select
                          value={selectedAddressId}
                          onChange={(e) => setSelectedAddressId(e.target.value)}
                          className="w-full rounded-md border border-(--accent-terra)/30 bg-(--accent-beige) px-3 py-2"
                        >
                          {initialSavedAddresses.map((addr) => (
                            <option key={addr.id} value={addr.id}>
                              {addr.fullName} -- {addr.addressLine1}, {addr.postalCode}
                            </option>
                          ))}
                        </select>
                      ) : null}
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          checked={selectedAddressMode === "new"}
                          onChange={() => setSelectedAddressMode("new")}
                        />
                        Enter a new address
                      </label>
                    </div>
                  </div>
                ) : null}

                {selectedAddressMode === "new" || !hasSavedAddresses ? (
                  <>
                    <label className="block text-sm">
                      <span className="font-medium">Full Name *</span>
                      <input
                        type="text"
                        required
                        value={newAddress.fullName}
                        onChange={(e) => setNewAddress({ ...newAddress, fullName: e.target.value })}
                        className="mt-1 w-full rounded-md border border-(--accent-terra)/40 bg-(--accent-beige) px-3 py-2"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="font-medium">Address Line 1 *</span>
                      <input
                        type="text"
                        required
                        value={newAddress.addressLine1}
                        onChange={(e) => setNewAddress({ ...newAddress, addressLine1: e.target.value })}
                        className="mt-1 w-full rounded-md border border-(--accent-terra)/40 bg-(--accent-beige) px-3 py-2"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="font-medium">Address Line 2</span>
                      <input
                        type="text"
                        value={newAddress.addressLine2 ?? ""}
                        onChange={(e) => setNewAddress({ ...newAddress, addressLine2: e.target.value })}
                        className="mt-1 w-full rounded-md border border-(--accent-terra)/40 bg-(--accent-beige) px-3 py-2"
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <label className="block text-sm">
                        <span className="font-medium">City *</span>
                        <input
                          type="text"
                          required
                          value={newAddress.city}
                          onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                          className="mt-1 w-full rounded-md border border-(--accent-terra)/40 bg-(--accent-beige) px-3 py-2"
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="font-medium">Postal Code *</span>
                        <input
                          type="text"
                          required
                          value={newAddress.postalCode}
                          onChange={(e) => setNewAddress({ ...newAddress, postalCode: e.target.value })}
                          className="mt-1 w-full rounded-md border border-(--accent-terra)/40 bg-(--accent-beige) px-3 py-2"
                        />
                      </label>
                    </div>
                    <label className="block text-sm">
                      <span className="font-medium">Country *</span>
                      <input
                        type="text"
                        required
                        value={newAddress.country}
                        onChange={(e) => setNewAddress({ ...newAddress, country: e.target.value })}
                        className="mt-1 w-full rounded-md border border-(--accent-terra)/40 bg-(--accent-beige) px-3 py-2"
                      />
                    </label>
                    <p className="text-xs text-foreground/50">
                      Tip: save this address later from{" "}
                      <Link href="/buyer/saved-addresses" className="underline">
                        Saved Addresses
                      </Link>.
                    </p>
                  </>
                ) : null}

                <button
                  type="submit"
                  className="rounded-md bg-(--accent-terra) px-4 py-2 font-semibold text-(--accent-beige) hover:opacity-90"
                >
                  Continue to Shipping
                </button>
              </form>
            )}
          </section>

          <section
            className={`rounded-md border p-6 ${
              currentStep === "shipping"
                ? "border-(--accent-terra) bg-(--accent-beige)"
                : "border-(--accent-terra)/30 bg-(--accent-beige)/40"
            }`}
          >
            <h2 className="mb-4 text-xl font-semibold">2. Shipping Method</h2>

            {currentStep !== "shipping" ? (
              <div className="text-sm">
                <p>{selectedDelivery?.name ?? "No shipping selected"}</p>
                <p>{deliveryCost === 0 ? "Free delivery" : `£${(deliveryCost / 100).toFixed(2)}`}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {deliveryOptions.map((option) => (
                  <label
                    key={option.id}
                    className="flex cursor-pointer items-center rounded-md border border-(--accent-terra)/30 p-3 hover:bg-(--accent-beige)"
                  >
                    <input
                      type="radio"
                      name="delivery"
                      value={option.id}
                      checked={selectedDeliveryId === option.id}
                      onChange={(e) => setSelectedDeliveryId(e.target.value)}
                      className="mr-3"
                    />
                    <div className="flex-1">
                      <p className="font-medium">{option.name}</p>
                      <p className="text-sm text-foreground/60">
                        {option.costPence === 0 ? "Free" : `£${(option.costPence / 100).toFixed(2)}`}
                      </p>
                    </div>
                  </label>
                ))}

                {postcodeSurcharge > 0 ? (
                  <p className="text-sm text-amber-600">
                    Remote area surcharge for {selectedAddress.postalCode.toUpperCase()}: £{(postcodeSurcharge / 100).toFixed(2)}
                  </p>
                ) : null}

                <button
                  type="button"
                  onClick={handleShippingSubmit}
                  className="rounded-md bg-(--accent-terra) px-4 py-2 font-semibold text-(--accent-beige) hover:opacity-90"
                >
                  Continue to Payment
                </button>
              </div>
            )}
          </section>

          {currentStep === "payment" ? (
            <section className="rounded-md border border-(--accent-terra) bg-(--accent-beige) p-6">
              <h2 className="mb-4 text-xl font-semibold">3. Payment</h2>
              <p className="mb-4 text-sm text-foreground/70">
                Your order will be created after your payment is confirmed. Items stay in your basket until payment succeeds.
              </p>
              {initialSavedPaymentMethods.length > 0 ? (
                <div className="mb-4 rounded-md border border-(--accent-terra)/30 bg-(--accent-beige)/20 p-3">
                  <p className="text-sm font-medium">Saved cards</p>
                  <ul className="mt-2 space-y-1 text-xs text-foreground/70">
                    {initialSavedPaymentMethods.map((pm) => (
                      <li key={pm.id}>
                        {pm.brand.toUpperCase()} ending {pm.last4} (exp {String(pm.expMonth).padStart(2, "0")}/{pm.expYear})
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-foreground/60">Your saved cards appear automatically in secure payment where available.</p>
                </div>
              ) : null}
              <PaymentStep
                address={selectedAddress}
                selectedDeliveryId={selectedDeliveryId}
                couponCode={couponCode}
                onCouponResolved={setResolvedCoupon}
              />
              <Link
                href="/buyer/cart"
                className="mt-4 block text-center text-sm text-foreground/60 hover:text-foreground/80"
              >
                Cancel and return to cart
              </Link>
            </section>
          ) : null}
        </div>

        <aside className="h-fit rounded-md border border-(--accent-terra)/30 bg-(--accent-beige)/60 p-6">
          <h3 className="mb-4 text-lg font-semibold">Order Summary</h3>

          <div className="mb-4 space-y-2 border-b border-(--accent-terra)/20 pb-4">
            {initialCart.items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>{item.product.title}{item.variantLabel ? ` (${item.variantLabel})` : ""} x{item.quantity}</span>
                <span>£{((item.unitPriceCts * item.quantity) / 100).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>£{(subtotal / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Shipping</span>
              <span>{deliveryCost === 0 ? "Free" : `£${(deliveryCost / 100).toFixed(2)}`}</span>
            </div>
            <div className="rounded-md border border-(--accent-terra)/20 bg-(--accent-beige)/30 p-3">
              <label className="block text-xs font-medium">Promo code</label>
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={couponInput}
                  onChange={(event) => setCouponInput(event.target.value.toUpperCase())}
                  placeholder="Enter code"
                  className="w-full rounded-md border border-(--accent-terra)/40 bg-white px-3 py-1.5 text-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    const normalized = couponInput.trim().toUpperCase();
                    if (!normalized) {
                      setCouponCode(null);
                      setResolvedCoupon(null);
                      return;
                    }
                    setCouponCode(normalized);
                    setResolvedCoupon(null);
                  }}
                  className="rounded-md border border-(--accent-terra)/40 px-3 py-1.5 text-xs font-semibold text-(--accent-terra)"
                >
                  Apply
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCouponInput("");
                    setCouponCode(null);
                    setResolvedCoupon(null);
                  }}
                  className="rounded-md border border-foreground/20 px-3 py-1.5 text-xs"
                >
                  Remove
                </button>
              </div>
              {couponCode ? (
                <p className="mt-2 text-xs text-foreground/60">
                  Code <strong>{couponCode}</strong> will be validated during payment setup.
                </p>
              ) : null}
            </div>
            {resolvedCoupon ? (
              <div className="flex justify-between text-emerald-700">
                <span>Discount ({resolvedCoupon.code})</span>
                <span>-£{(resolvedCoupon.discountCents / 100).toFixed(2)}</span>
              </div>
            ) : null}
            {postcodeSurcharge > 0 ? (
              <div className="flex justify-between text-amber-600">
                <span>Surcharge</span>
                <span>Included</span>
              </div>
            ) : null}
            <div className="border-t border-(--accent-terra)/20 pt-2 text-base font-semibold">
              <div className="flex justify-between">
                <span>Total</span>
                <span>£{(totalAfterDiscount / 100).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
