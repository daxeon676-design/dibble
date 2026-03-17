"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";

interface Profile {
  id: string;
  email: string;
  displayName: string | null;
  bio: string | null;
  phoneNumber: string | null;
  avatarUrl: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  county: string | null;
  postcode: string | null;
  country: string | null;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [county, setCounty] = useState("");
  const [postcode, setPostcode] = useState("");
  const [country, setCountry] = useState("United Kingdom");

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((data: Profile | null) => {
        if (!data) return;
        setProfile(data);
        setDisplayName(data.displayName ?? "");
        setBio(data.bio ?? "");
        setPhoneNumber(data.phoneNumber ?? "");
        setAvatarUrl(data.avatarUrl ?? "");
        setAddressLine1(data.addressLine1 ?? "");
        setAddressLine2(data.addressLine2 ?? "");
        setCity(data.city ?? "");
        setCounty(data.county ?? "");
        setPostcode(data.postcode ?? "");
        setCountry(data.country ?? "United Kingdom");
      });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, bio, phoneNumber, avatarUrl, addressLine1, addressLine2, city, county, postcode, country }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.fieldErrors ? "Please check your inputs." : "Failed to save.");
      } else {
        setSuccess(true);
        const updated: Profile = await res.json();
        setProfile(updated);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: form });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json() as { url: string };
      setAvatarUrl(url);
    } catch {
      setError("Image upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  if (!profile) {
    return <p className="p-8 text-gray-500">Loading&hellip;</p>;
  }

  return (
    <main className="max-w-xl mx-auto px-4 py-10 text-foreground">
      <h1 className="text-2xl font-bold mb-6">Edit Profile</h1>

      <div className="flex items-center gap-4 mb-8">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt="Avatar"
            className="w-16 h-16 rounded-full object-cover border border-(--accent-terra)"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-(--accent-beige) flex items-center justify-center text-2xl font-bold text-(--accent-terra) border border-(--accent-terra)">
            {(displayName || profile.email).charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <p className="font-semibold">{displayName || profile.email}</p>
          <p className="text-sm text-foreground/60">{profile.email}</p>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="text-xs border border-(--accent-terra) rounded px-2 py-1 text-(--accent-terra) hover:bg-(--accent-beige) disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "Upload Photo"}
            </button>
            {avatarUrl && (
              <button
                type="button"
                onClick={() => setAvatarUrl("")}
                className="text-xs text-red-500 hover:underline"
              >
                Remove
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleAvatarUpload}
          />
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1">Display Name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={80}
            placeholder="Your name"
            className="w-full border border-(--accent-terra) rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--accent-terra)"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            maxLength={500}
            placeholder="Tell other Dibble members a little about yourself…"
            className="w-full border border-(--accent-terra) rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--accent-terra) resize-none"
          />
          <p className="text-xs text-foreground/50 mt-1 text-right">{bio.length}/500</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Phone Number <span className="text-foreground/50">(optional)</span></label>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            maxLength={20}
            placeholder="+44 20 1234 5678"
            className="w-full border border-(--accent-terra) rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--accent-terra)"
          />
        </div>

        <hr className="border-(--accent-terra)/20" />
        <h2 className="text-lg font-semibold">Delivery Address</h2>
        <p className="text-xs text-foreground/60 -mt-3">This address will be used automatically at checkout.</p>

        <div>
          <label className="block text-sm font-medium mb-1">Address Line 1</label>
          <input
            type="text"
            value={addressLine1}
            onChange={(e) => setAddressLine1(e.target.value)}
            maxLength={100}
            placeholder="House name / number and street"
            className="w-full border border-(--accent-terra) rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--accent-terra)"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Address Line 2 <span className="text-foreground/50">(optional)</span></label>
          <input
            type="text"
            value={addressLine2}
            onChange={(e) => setAddressLine2(e.target.value)}
            maxLength={100}
            placeholder="Flat, apartment, suite, etc."
            className="w-full border border-(--accent-terra) rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--accent-terra)"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Town / City</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              maxLength={80}
              placeholder="London"
              className="w-full border border-(--accent-terra) rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--accent-terra)"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">County <span className="text-foreground/50">(optional)</span></label>
            <input
              type="text"
              value={county}
              onChange={(e) => setCounty(e.target.value)}
              maxLength={80}
              placeholder="Greater London"
              className="w-full border border-(--accent-terra) rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--accent-terra)"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Postcode</label>
            <input
              type="text"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value)}
              maxLength={20}
              placeholder="SW1A 1AA"
              className="w-full border border-(--accent-terra) rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--accent-terra)"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Country</label>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              maxLength={80}
              placeholder="United Kingdom"
              className="w-full border border-(--accent-terra) rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--accent-terra)"
            />
          </div>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}
        {success && <p className="text-green-700 text-sm">Profile saved!</p>}

        <button
          type="submit"
          disabled={saving}
          className="bg-(--accent-terra) text-(--accent-beige) px-6 py-2 rounded hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </form>

      <hr className="border-(--accent-terra)/20 my-8" />

      <ChangePasswordSection />

      <hr className="border-(--accent-terra)/20 my-8" />

      <DeleteAccountSection />
    </main>
  );
}

function ChangePasswordSection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.fieldErrors?.currentPassword?.[0] || data.error || "Failed to change password");
      }

      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Change Password</h2>
      <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
        <div>
          <label className="block text-sm font-medium mb-1">Current Password</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            className="w-full border border-(--accent-terra) rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--accent-terra)"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">New Password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            className="w-full border border-(--accent-terra) rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--accent-terra)"
          />
          <p className="text-xs text-foreground/50 mt-1">At least 8 characters</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Confirm Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="w-full border border-(--accent-terra) rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--accent-terra)"
          />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}
        {success && <p className="text-green-700 text-sm">Password changed successfully!</p>}

        <button
          type="submit"
          disabled={loading}
          className="bg-(--accent-terra) text-(--accent-beige) px-6 py-2 rounded hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Updating…" : "Change Password"}
        </button>
      </form>
    </div>
  );
}

function DeleteAccountSection() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmation }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.fieldErrors?.confirmation?.[0] || data.error || "Failed to delete account");
      }

      // Redirect to login after successful deletion
      window.location.href = "/login?deleted=true";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  if (!showConfirm) {
    return (
      <div>
        <h2 className="text-lg font-semibold mb-4 text-red-500">Danger Zone</h2>
        <p className="text-sm text-foreground/70 mb-4">
          Delete your account permanently. This cannot be undone.
        </p>
        <button
          onClick={() => setShowConfirm(true)}
          className="bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700"
        >
          Delete Account
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4 text-red-500">Delete Account</h2>
      <div className="bg-red-950/30 border border-red-700 rounded p-4 mb-4">
        <p className="text-sm text-red-300 mb-2">
          <strong>Warning:</strong> This action cannot be undone. All your data, orders, and messages will be permanently deleted.
        </p>
        <p className="text-sm text-red-300">
          Type <strong>DELETE_MY_ACCOUNT</strong> below to confirm.
        </p>
      </div>

      <form onSubmit={handleDeleteAccount} className="space-y-4 max-w-md">
        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full border border-red-700 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-700"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Confirmation</label>
          <input
            type="text"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder="Type DELETE_MY_ACCOUNT"
            required
            className="w-full border border-red-700 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-700"
          />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading || confirmation !== "DELETE_MY_ACCOUNT"}
            className="bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? "Deleting…" : "Delete My Account"}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowConfirm(false);
              setPassword("");
              setConfirmation("");
              setError("");
            }}
            className="border border-slate-600 px-6 py-2 rounded hover:bg-slate-800"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
