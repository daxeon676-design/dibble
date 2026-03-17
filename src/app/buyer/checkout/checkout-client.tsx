"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

type CartData = {
  id: string;
  items: Array<{
    id: string;
    quantity: number;
    unitPriceCts: number;
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
  deliveryOptions: DeliveryOption[];
};

type CheckoutState = "address" | "shipping" | "payment";

function shippingSurchargeByPostcode(postalCode: string): number {
  const normalized = postalCode.toUpperCase().replace(/\s+/g, "");

  // Practical surcharge bands for remote UK regions.
  if (/^(HS|IV|KW|PA|PH|ZE)/.test(normalized)) return 450;
  if (/^(BT)/.test(normalized)) return 300;
  if (/^(GY|JE|IM)/.test(normalized)) return 400;

  return 0;
}

export function CheckoutClient({
  initialCart,
  initialUser,
  initialSavedAddresses,
  deliveryOptions,
}: Props) {
  const [currentStep, setCurrentStep] = useState<CheckoutState>("address");
  const [error, setError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

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

  const selectedDelivery = deliveryOptions.find((d) => d.id === selectedDeliveryId);

  const selectedAddress = selectedAddressMode === "saved"
    ? initialSavedAddresses.find((a) => a.id === selectedAddressId) ?? defaultSaved ?? newAddress
    : newAddress;

  const subtotal = useMemo(() => {
    return initialCart.items.reduce((sum, item) => sum + item.unitPriceCts * item.quantity, 0);
  }, [initialCart.items]);

  const postcodeSurcharge = useMemo(
    () => shippingSurchargeByPostcode(selectedAddress.postalCode ?? ""),
    [selectedAddress.postalCode],
  );

  const deliveryCost = (selectedDelivery?.costPence ?? 0) + postcodeSurcharge;
  const total = subtotal + deliveryCost;

  function validateAddress(address: Address) {
    return Boolean(address.fullName && address.addressLine1 && address.city && address.postalCode && address.country);
  }

  function handleAddressSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPaymentError(null);

    const addressToValidate = selectedAddressMode === "saved"
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

  async function handlePayment() {
    setIsProcessing(true);
    setPaymentError(null);
    setError(null);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryOptionId: selectedDeliveryId,
          address: {
            fullName: selectedAddress.fullName,
            addressLine1: selectedAddress.addressLine1,
            addressLine2: selectedAddress.addressLine2,
            city: selectedAddress.city,
            postalCode: selectedAddress.postalCode,
            country: selectedAddress.country,
          },
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Could not create your order.");
      }

      // Order creation succeeded, continue to payment from orders page.
      window.location.href = "/buyer/orders";
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Checkout failed.";
      setPaymentError(message);
      setIsProcessing(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-16 text-slate-100">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Checkout</h1>
        <Link href="/buyer/cart" className="text-sm text-slate-400 hover:text-slate-300">
          Cancel and return to cart
        </Link>
      </div>

      {error ? <div className="mb-6 rounded-md border border-red-700 bg-red-950 p-4 text-red-300">{error}</div> : null}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className={`rounded-md border p-6 ${currentStep === "address" ? "border-emerald-700 bg-slate-900" : "border-slate-800 bg-slate-950"}`}>
            <h2 className="mb-4 text-xl font-semibold">1. Delivery Address</h2>

            {currentStep !== "address" ? (
              <div className="text-slate-300">
                <p>{selectedAddress.fullName}</p>
                <p>{selectedAddress.addressLine1}</p>
                {selectedAddress.addressLine2 ? <p>{selectedAddress.addressLine2}</p> : null}
                <p>{selectedAddress.city}, {selectedAddress.postalCode}</p>
                <button type="button" onClick={() => setCurrentStep("address")} className="mt-2 text-sm text-slate-300 underline hover:text-slate-200">
                  Change address
                </button>
              </div>
            ) : (
              <form onSubmit={handleAddressSubmit} className="space-y-4">
                {hasSavedAddresses ? (
                  <div className="rounded-md border border-slate-700 p-3">
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
                          onChange={(event) => setSelectedAddressId(event.target.value)}
                          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
                        >
                          {initialSavedAddresses.map((address) => (
                            <option key={address.id} value={address.id}>
                              {address.fullName} - {address.addressLine1}, {address.postalCode}
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
                        onChange={(event) => setNewAddress({ ...newAddress, fullName: event.target.value })}
                        className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="font-medium">Address Line 1 *</span>
                      <input
                        type="text"
                        required
                        value={newAddress.addressLine1}
                        onChange={(event) => setNewAddress({ ...newAddress, addressLine1: event.target.value })}
                        className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="font-medium">Address Line 2</span>
                      <input
                        type="text"
                        value={newAddress.addressLine2 ?? ""}
                        onChange={(event) => setNewAddress({ ...newAddress, addressLine2: event.target.value })}
                        className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <label className="block text-sm">
                        <span className="font-medium">City *</span>
                        <input
                          type="text"
                          required
                          value={newAddress.city}
                          onChange={(event) => setNewAddress({ ...newAddress, city: event.target.value })}
                          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="font-medium">Postal Code *</span>
                        <input
                          type="text"
                          required
                          value={newAddress.postalCode}
                          onChange={(event) => setNewAddress({ ...newAddress, postalCode: event.target.value })}
                          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
                        />
                      </label>
                    </div>
                    <label className="block text-sm">
                      <span className="font-medium">Country *</span>
                      <input
                        type="text"
                        required
                        value={newAddress.country}
                        onChange={(event) => setNewAddress({ ...newAddress, country: event.target.value })}
                        className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
                      />
                    </label>
                    <p className="text-xs text-slate-400">
                      Tip: save this address later from <Link href="/buyer/saved-addresses" className="underline">Saved Addresses</Link>.
                    </p>
                  </>
                ) : null}

                <button type="submit" className="rounded-md bg-emerald-600 px-4 py-2 font-semibold text-slate-950 hover:bg-emerald-500">
                  Continue to Shipping
                </button>
              </form>
            )}
          </section>

          <section className={`rounded-md border p-6 ${currentStep === "shipping" ? "border-emerald-700 bg-slate-900" : "border-slate-800 bg-slate-950"}`}>
            <h2 className="mb-4 text-xl font-semibold">2. Shipping Method</h2>

            {currentStep !== "shipping" ? (
              <div className="text-slate-300">
                <p>{selectedDelivery?.name ?? "No shipping selected"}</p>
                <p>£{(deliveryCost / 100).toFixed(2)}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {deliveryOptions.map((option) => (
                  <label key={option.id} className="flex items-center rounded-md border border-slate-700 p-3 hover:bg-slate-800">
                    <input
                      type="radio"
                      name="delivery"
                      value={option.id}
                      checked={selectedDeliveryId === option.id}
                      onChange={(event) => setSelectedDeliveryId(event.target.value)}
                      className="mr-3"
                    />
                    <div className="flex-1">
                      <p className="font-medium">{option.name}</p>
                      <p className="text-sm text-slate-400">Base £{(option.costPence / 100).toFixed(2)}</p>
                    </div>
                  </label>
                ))}

                {postcodeSurcharge > 0 ? (
                  <p className="text-sm text-amber-300">
                    Remote area surcharge for {selectedAddress.postalCode.toUpperCase()}: £{(postcodeSurcharge / 100).toFixed(2)}
                  </p>
                ) : null}

                <button type="button" onClick={handleShippingSubmit} className="rounded-md bg-emerald-600 px-4 py-2 font-semibold text-slate-950 hover:bg-emerald-500">
                  Continue to Payment
                </button>
              </div>
            )}
          </section>

          {currentStep === "payment" ? (
            <section className="rounded-md border border-emerald-700 bg-slate-900 p-6">
              <h2 className="mb-4 text-xl font-semibold">3. Payment</h2>
              <p className="mb-3 text-sm text-slate-300">
                We will create your order now, then you can securely complete card payment on your orders page.
              </p>

              {paymentError ? (
                <div className="mb-4 rounded-md border border-red-700 bg-red-950 p-4 text-sm">
                  <p className="font-semibold text-red-300">Order creation failed</p>
                  <p className="mt-1 text-red-400">{paymentError}</p>
                  <p className="mt-2 text-red-500">Your cart has not been charged. You can try again below or{" "}
                    <Link href="/buyer/cart" className="underline hover:text-red-400">return to your cart</Link>.</p>
                </div>
              ) : null}

              <button
                type="button"
                onClick={handlePayment}
                disabled={isProcessing}
                className="w-full rounded-md bg-emerald-600 px-4 py-3 font-semibold text-slate-950 hover:bg-emerald-500 disabled:opacity-60"
              >
                {isProcessing ? "Creating order..." : paymentError ? "Try Again" : "Create Order and Continue"}
              </button>
              <Link href="/buyer/cart" className="mt-3 block text-center text-sm text-slate-400 hover:text-slate-300">
                Cancel and return to cart
              </Link>
            </section>
          ) : null}
        </div>

        <aside className="h-fit rounded-md border border-slate-800 bg-slate-950 p-6">
          <h3 className="mb-4 text-lg font-semibold">Order Summary</h3>

          <div className="mb-4 space-y-2 border-b border-slate-700 pb-4">
            {initialCart.items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>{item.product.title} x {item.quantity}</span>
                <span>£{((item.unitPriceCts * item.quantity) / 100).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>£{(subtotal / 100).toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Shipping</span><span>£{(deliveryCost / 100).toFixed(2)}</span></div>
            {postcodeSurcharge > 0 ? (
              <div className="flex justify-between text-amber-300"><span>Surcharge</span><span>Included</span></div>
            ) : null}
            <div className="border-t border-slate-700 pt-2 text-base font-semibold">
              <div className="flex justify-between"><span>Total</span><span>£{(total / 100).toFixed(2)}</span></div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
