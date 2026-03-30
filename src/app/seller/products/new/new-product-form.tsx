"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type ConfigResponse = { categories: string[]; platformFeePercent?: number };

type VariantDraft = {
  id: string;
  label: string;
  priceDelta: string;
  stockOverride: string;
  sku: string;
};

export default function NewProductForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("0.00");
  const [stock, setStock] = useState(1);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [materials, setMaterials] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [feePercent, setFeePercent] = useState<number>(12);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [publishMode, setPublishMode] = useState<"now" | "draft" | "schedule">("now");
  const [publishAt, setPublishAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/site-config")
      .then((r) => r.json())
      .then((data: ConfigResponse) => {
        setCategories(data.categories ?? []);
        if ((data.categories ?? []).length > 0) {
          setSelectedCategories([data.categories[0]]);
        }
        if (data.platformFeePercent !== undefined) {
          setFeePercent(data.platformFeePercent);
        }
      });
  }, []);

  function toggleCategory(category: string) {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((value) => value !== category) : [...prev, category],
    );
  }

  function addVariant() {
    setVariants((prev) => [
      ...prev,
      {
        id: `variant-${prev.length + 1}`,
        label: "",
        priceDelta: "0.00",
        stockOverride: "",
        sku: "",
      },
    ]);
  }

  function updateVariant(index: number, patch: Partial<VariantDraft>) {
    setVariants((prev) => prev.map((variant, variantIndex) => (variantIndex === index ? { ...variant, ...patch } : variant)));
  }

  function removeVariant(index: number) {
    setVariants((prev) => prev.filter((_, variantIndex) => variantIndex !== index));
  }

  const priceCents = useMemo(() => Math.round(Number(price || "0") * 100), [price]);

  async function uploadImage(file: File) {
    setUploading(true);
    const form = new FormData();
    form.append("file", file);

    const response = await fetch("/api/uploads", { method: "POST", body: form });
    const body = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
    setUploading(false);

    if (!response.ok || !body?.url) {
      setError(body?.error ?? "Upload failed.");
      return;
    }

    setImageUrls((prev) => [...prev, body.url!]);
  }

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        priceCents,
        stock,
        imageUrls,
        categories: selectedCategories,
        materials,
        dimensions,
        variants: variants
          .map((variant) => ({
            id: variant.id.trim(),
            label: variant.label.trim(),
            priceDeltaCents: Math.round(Number(variant.priceDelta || "0") * 100),
            stockOverride: variant.stockOverride ? Math.max(0, Math.trunc(Number(variant.stockOverride))) : null,
            sku: variant.sku.trim() || null,
          }))
          .filter((variant) => variant.id && variant.label),
        publishMode,
        publishAt: publishMode === "schedule" && publishAt ? new Date(publishAt).toISOString() : undefined,
      }),
    });

    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    setLoading(false);

    if (!response.ok) {
      setError(body?.error ?? "Failed to create product.");
      return;
    }

    router.push("/seller/products");
  }

  return (
    <form onSubmit={createProduct} className="space-y-4 rounded-md border border-(--accent-terra)/30 bg-white p-5">
      <h2 className="text-2xl font-semibold text-foreground">Create Product</h2>

      <label className="block text-sm text-foreground">
        <span>Title</span>
        <input
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="mt-1 w-full rounded-md border border-(--accent-terra)/50 bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-(--accent-terra)"
        />
      </label>

      <label className="block text-sm text-foreground">
        <span>Description</span>
        <textarea
          required
          minLength={10}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="mt-1 min-h-28 w-full rounded-md border border-(--accent-terra)/50 bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-(--accent-terra)"
        />
      </label>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="block text-sm text-foreground">
          <label className="block">
            <span>Price (£)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              className="mt-1 w-full rounded-md border border-(--accent-terra)/50 bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-(--accent-terra)"
            />
          </label>
          {priceCents > 0 && (
            <p className="mt-1 text-xs text-foreground/60">
              You receive approx. <strong>£{((priceCents * (1 - feePercent / 100)) / 100).toFixed(2)}</strong> after {feePercent}% fee
            </p>
          )}
        </div>

        <label className="block text-sm text-foreground">
          <span>Stock</span>
          <input
            type="number"
            min={0}
            value={stock}
            onChange={(event) => setStock(Number(event.target.value))}
            className="mt-1 w-full rounded-md border border-(--accent-terra)/50 bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-(--accent-terra)"
          />
        </label>

        <div className="block text-sm text-foreground">
          <p>Categories</p>
          <div className="mt-2 max-h-40 space-y-1 overflow-auto rounded-md border border-(--accent-terra)/50 bg-white px-3 py-2">
            {categories.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(c)}
                  onChange={() => toggleCategory(c)}
                />
                <span>{c}</span>
              </label>
            ))}
          </div>
          {selectedCategories.length > 0 ? (
            <p className="mt-1 text-xs text-foreground/60">Selected: {selectedCategories.join(", ")}</p>
          ) : (
            <p className="mt-1 text-xs text-red-600">Select at least one category.</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm text-foreground">
          <span>Materials</span>
          <input
            value={materials}
            onChange={(event) => setMaterials(event.target.value)}
            placeholder="Oak, brass, cotton, clay..."
            className="mt-1 w-full rounded-md border border-(--accent-terra)/50 bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-(--accent-terra)"
          />
        </label>

        <label className="block text-sm text-foreground">
          <span>Size / Dimensions</span>
          <input
            value={dimensions}
            onChange={(event) => setDimensions(event.target.value)}
            placeholder="20cm x 12cm x 8cm"
            className="mt-1 w-full rounded-md border border-(--accent-terra)/50 bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-(--accent-terra)"
          />
        </label>
      </div>

      <div className="space-y-3 rounded-md border border-(--accent-terra)/30 bg-(--accent-beige)/20 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">Product variants</p>
            <p className="text-xs text-foreground/60">Optional choices like size, colour, or bundle format.</p>
          </div>
          <button
            type="button"
            onClick={addVariant}
            className="rounded-md border border-(--accent-terra) px-3 py-1.5 text-xs font-semibold text-(--accent-terra)"
          >
            Add variant
          </button>
        </div>

        {variants.length === 0 ? <p className="text-xs text-foreground/60">No variants added. Buyers will purchase the base product.</p> : null}

        {variants.map((variant, index) => (
          <div key={`${variant.id}-${index}`} className="grid gap-3 rounded-md border border-(--accent-terra)/20 bg-white p-3 md:grid-cols-5">
            <label className="block text-xs text-foreground">
              <span>ID</span>
              <input
                value={variant.id}
                onChange={(event) => updateVariant(index, { id: event.target.value })}
                className="mt-1 w-full rounded-md border border-(--accent-terra)/40 px-2 py-1.5"
              />
            </label>
            <label className="block text-xs text-foreground md:col-span-2">
              <span>Label</span>
              <input
                value={variant.label}
                onChange={(event) => updateVariant(index, { label: event.target.value })}
                placeholder="Small / Blue / 12-pack"
                className="mt-1 w-full rounded-md border border-(--accent-terra)/40 px-2 py-1.5"
              />
            </label>
            <label className="block text-xs text-foreground">
              <span>Price delta (£)</span>
              <input
                type="number"
                step="0.01"
                value={variant.priceDelta}
                onChange={(event) => updateVariant(index, { priceDelta: event.target.value })}
                className="mt-1 w-full rounded-md border border-(--accent-terra)/40 px-2 py-1.5"
              />
            </label>
            <label className="block text-xs text-foreground">
              <span>Stock override</span>
              <input
                type="number"
                min={0}
                value={variant.stockOverride}
                onChange={(event) => updateVariant(index, { stockOverride: event.target.value })}
                className="mt-1 w-full rounded-md border border-(--accent-terra)/40 px-2 py-1.5"
              />
            </label>
            <label className="block text-xs text-foreground md:col-span-4">
              <span>SKU</span>
              <input
                value={variant.sku}
                onChange={(event) => updateVariant(index, { sku: event.target.value })}
                className="mt-1 w-full rounded-md border border-(--accent-terra)/40 px-2 py-1.5"
              />
            </label>
            <div className="flex items-end justify-end md:col-span-1">
              <button
                type="button"
                onClick={() => removeVariant(index)}
                className="rounded-md bg-red-500 px-3 py-1.5 text-xs font-semibold text-white"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm text-foreground">
          <span>Publishing</span>
          <select
            value={publishMode}
            onChange={(event) => setPublishMode(event.target.value as "now" | "draft" | "schedule")}
            className="mt-1 w-full rounded-md border border-(--accent-terra)/50 bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-(--accent-terra)"
          >
            <option value="now">Publish now</option>
            <option value="draft">Save as draft</option>
            <option value="schedule">Schedule publish</option>
          </select>
        </label>
        {publishMode === "schedule" ? (
          <label className="block text-sm text-foreground">
            <span>Publish on</span>
            <input
              type="datetime-local"
              value={publishAt}
              onChange={(event) => setPublishAt(event.target.value)}
              className="mt-1 w-full rounded-md border border-(--accent-terra)/50 bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-(--accent-terra)"
            />
          </label>
        ) : (
          <div />
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Product Images</p>
        <label className="inline-block cursor-pointer rounded-md border border-(--accent-terra) px-3 py-2 text-sm text-(--accent-terra) hover:bg-(--accent-beige)">
          Upload Image
          <input
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void uploadImage(file);
              }
            }}
          />
        </label>
        {uploading ? <p className="text-xs text-foreground/60">Uploading...</p> : null}
        {imageUrls.length > 0 && (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {imageUrls.map((url, index) => (
              <div key={url} className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="Uploaded" className="h-20 w-full rounded border border-(--accent-terra)/30 object-cover" />
                <button
                  type="button"
                  onClick={() => setImageUrls((prev) => prev.filter((_, i) => i !== index))}
                  className="absolute right-1 top-1 hidden rounded-full bg-red-500 px-1.5 py-0.5 text-xs text-white group-hover:block"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading || uploading || selectedCategories.length === 0}
          className="rounded-md bg-(--accent-terra) px-5 py-2 font-semibold text-(--accent-beige) hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Creating..." : "Create Product"}
        </button>
      </div>
    </form>
  );
}
