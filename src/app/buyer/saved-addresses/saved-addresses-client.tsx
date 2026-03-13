"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

type Address = {
  id: string;
  fullName: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  createdAt: Date;
};

type Props = {
  initialAddresses: Address[];
};

type FormState = "idle" | "adding" | "loading" | "error" | "success";

export function SavedAddressesClient({ initialAddresses }: Props) {
  const [addresses, setAddresses] = useState(initialAddresses);
  const [formState, setFormState] = useState<FormState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    postalCode: "",
    country: "GB",
    isDefault: false,
  });

  async function handleAddAddress(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormState("loading");
    setError(null);

    try {
      const response = await fetch("/api/buyer/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to add address");
      }

      const { address } = (await response.json()) as { address: Address };
      setAddresses([address, ...addresses]);
      setFormState("success");
      setShowForm(false);
      setFormData({
        fullName: "",
        addressLine1: "",
        addressLine2: "",
        city: "",
        postalCode: "",
        country: "GB",
        isDefault: false,
      });

      setTimeout(() => setFormState("idle"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setFormState("error");
    }
  }

  async function handleDeleteAddress(id: string) {
    if (!confirm("Are you sure you want to delete this address?")) {
      return;
    }

    try {
      const response = await fetch(`/api/buyer/addresses/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete address");
      }

      setAddresses(addresses.filter((a) => a.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete address");
    }
  }

  async function handleSetDefault(id: string) {
    try {
      const response = await fetch(`/api/buyer/addresses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });

      if (!response.ok) {
        throw new Error("Failed to update address");
      }

      setAddresses(
        addresses.map((a) => ({
          ...a,
          isDefault: a.id === id,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update address");
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-foreground">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Saved Addresses</h1>
        <Link
          href="/buyer/profile"
          className="text-sm text-slate-400 hover:text-slate-300"
        >
          ← Back to Account
        </Link>
      </div>

      {error && (
        <div className="mb-6 rounded-md border border-red-700 bg-red-950 p-4 text-red-300">
          {error}
        </div>
      )}

      {addresses.length === 0 && !showForm && (
        <div className="mb-6 rounded-md border border-slate-700 bg-slate-900 p-6 text-center">
          <p className="text-slate-300">No saved addresses yet</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 inline-block rounded-md bg-emerald-600 px-4 py-2 font-semibold text-slate-950 hover:bg-emerald-500"
          >
            Add Your First Address
          </button>
        </div>
      )}

      {addresses.length > 0 && (
        <div className="mb-6 space-y-3">
          {addresses.map((address) => (
            <div
              key={address.id}
              className={`rounded-md border p-4 ${
                address.isDefault
                  ? "border-emerald-700 bg-emerald-950/30"
                  : "border-slate-700 bg-slate-900"
              }`}
            >
              {address.isDefault && (
                <div className="mb-2 inline-block rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-slate-950">
                  Default
                </div>
              )}
              <h3 className="font-semibold text-foreground">{address.fullName}</h3>
              <p className="text-sm text-slate-300">{address.addressLine1}</p>
              {address.addressLine2 && (
                <p className="text-sm text-slate-300">{address.addressLine2}</p>
              )}
              <p className="text-sm text-slate-300">
                {address.city}, {address.postalCode}
              </p>
              <p className="text-xs text-slate-400">{address.country}</p>

              <div className="mt-3 flex gap-2">
                {!address.isDefault && (
                  <button
                    onClick={() => handleSetDefault(address.id)}
                    className="text-xs text-slate-400 hover:text-slate-300 underline"
                  >
                    Set as default
                  </button>
                )}
                <button
                  onClick={() => handleDeleteAddress(address.id)}
                  className="ml-auto text-xs text-red-400 hover:text-red-300 underline"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="rounded-md border border-slate-700 bg-slate-900 p-6 mb-6">
          <h2 className="mb-4 text-lg font-semibold">Add New Address</h2>

          <form onSubmit={handleAddAddress} className="space-y-4">
            <div>
              <label className="block text-sm font-medium">
                <span>Full Name *</span>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) =>
                    setFormData({ ...formData, fullName: e.target.value })
                  }
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
                />
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium">
                <span>Address Line 1 *</span>
                <input
                  type="text"
                  required
                  value={formData.addressLine1}
                  onChange={(e) =>
                    setFormData({ ...formData, addressLine1: e.target.value })
                  }
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
                />
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium">
                <span>Address Line 2</span>
                <input
                  type="text"
                  value={formData.addressLine2}
                  onChange={(e) =>
                    setFormData({ ...formData, addressLine2: e.target.value })
                  }
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium">
                  <span>City *</span>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) =>
                      setFormData({ ...formData, city: e.target.value })
                    }
                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
                  />
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium">
                  <span>Postal Code *</span>
                  <input
                    type="text"
                    required
                    value={formData.postalCode}
                    onChange={(e) =>
                      setFormData({ ...formData, postalCode: e.target.value })
                    }
                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
                  />
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium">
                <span>Country</span>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) =>
                    setFormData({ ...formData, country: e.target.value })
                  }
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
                />
              </label>
            </div>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isDefault}
                onChange={(e) =>
                  setFormData({ ...formData, isDefault: e.target.checked })
                }
                className="rounded"
              />
              <span className="text-sm">Set as default address</span>
            </label>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={formState === "loading"}
                className="rounded-md bg-emerald-600 px-4 py-2 font-semibold text-slate-950 disabled:opacity-60 hover:bg-emerald-500"
              >
                {formState === "loading" ? "Saving..." : "Save Address"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setFormState("idle");
                  setError(null);
                }}
                className="rounded-md border border-slate-700 px-4 py-2 font-semibold text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {addresses.length > 0 && !showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="rounded-md border border-emerald-600 px-4 py-2 font-semibold text-emerald-600 hover:bg-emerald-950"
        >
          + Add New Address
        </button>
      )}
    </main>
  );
}
