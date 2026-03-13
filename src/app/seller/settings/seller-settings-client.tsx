"use client";

import { useRef, useState } from "react";

type Props = {
  initialProfile: {
    headline?: string;
    description?: string;
    logoUrl?: string;
    instagramUrl?: string;
    tiktokUrl?: string;
    websiteUrl?: string;
  };
};

export function SellerSettingsClient({ initialProfile }: Props) {
  const [headline, setHeadline] = useState(initialProfile.headline ?? "");
  const [description, setDescription] = useState(initialProfile.description ?? "");
  const [logoUrl, setLogoUrl] = useState(initialProfile.logoUrl ?? "");
  const [instagramUrl, setInstagramUrl] = useState(initialProfile.instagramUrl ?? "");
  const [tiktokUrl, setTiktokUrl] = useState(initialProfile.tiktokUrl ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(initialProfile.websiteUrl ?? "");
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function uploadLogo(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/uploads", { method: "POST", body: form });
      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const payload = (await response.json()) as { url: string };
      setLogoUrl(payload.url);
    } catch {
      setError("Could not upload logo.");
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    setError(null);

    const response = await fetch("/api/seller/shop-profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ headline, description, logoUrl, instagramUrl, tiktokUrl, websiteUrl }),
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setState("error");
      setError(payload?.error ?? "Could not save seller settings.");
      return;
    }

    setState("done");
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-xl border border-(--accent-terra)/30 bg-white p-6">
      <label className="block text-sm text-foreground">
        <span>Shop headline</span>
        <input
          value={headline}
          onChange={(event) => setHeadline(event.target.value)}
          placeholder="A short line shown on your shop page"
          className="mt-1 w-full rounded-md border border-(--accent-terra)/50 bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-(--accent-terra)"
        />
      </label>

      <label className="block text-sm text-foreground">
        <span>Shop description</span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Tell customers about your craft and what makes your shop unique"
          rows={4}
          className="mt-1 w-full rounded-md border border-(--accent-terra)/50 bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-(--accent-terra)"
        />
      </label>

      <label className="block text-sm text-foreground">
        <span>Shop logo URL</span>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <input
            value={logoUrl}
            onChange={(event) => setLogoUrl(event.target.value)}
            placeholder="https://... or /uploads/..."
            className="flex-1 rounded-md border border-(--accent-terra)/50 bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-(--accent-terra)"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="rounded-md border border-(--accent-terra) px-3 py-2 text-xs text-(--accent-terra) disabled:opacity-60"
          >
            {uploading ? "Uploading..." : "Upload Logo"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) uploadLogo(file);
            }}
          />
        </div>
      </label>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="block text-sm text-foreground">
          <span>Instagram URL</span>
          <input
            value={instagramUrl}
            onChange={(event) => setInstagramUrl(event.target.value)}
            placeholder="https://instagram.com/yourshop"
            className="mt-1 w-full rounded-md border border-(--accent-terra)/50 bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-(--accent-terra)"
          />
        </label>
        <label className="block text-sm text-foreground">
          <span>TikTok URL</span>
          <input
            value={tiktokUrl}
            onChange={(event) => setTiktokUrl(event.target.value)}
            placeholder="https://tiktok.com/@yourshop"
            className="mt-1 w-full rounded-md border border-(--accent-terra)/50 bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-(--accent-terra)"
          />
        </label>
        <label className="block text-sm text-foreground">
          <span>Website URL</span>
          <input
            value={websiteUrl}
            onChange={(event) => setWebsiteUrl(event.target.value)}
            placeholder="https://yourshop.com"
            className="mt-1 w-full rounded-md border border-(--accent-terra)/50 bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-(--accent-terra)"
          />
        </label>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {state === "done" ? <p className="text-sm text-green-700">Seller settings saved.</p> : null}

      <button
        type="submit"
        disabled={state === "saving"}
        className="rounded-md bg-(--accent-terra) px-4 py-2 text-sm font-semibold text-(--accent-beige) disabled:opacity-60"
      >
        {state === "saving" ? "Saving..." : "Save Seller Settings"}
      </button>
    </form>
  );
}