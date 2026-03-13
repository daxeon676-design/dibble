"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type ConfigResponse = { categories: string[] };

export default function NewProductForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("0.00");
  const [stock, setStock] = useState(1);
  const [category, setCategory] = useState("");
  const [materials, setMaterials] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/site-config")
      .then((r) => r.json())
      .then((data: ConfigResponse) => {
        setCategories(data.categories ?? []);
        if ((data.categories ?? []).length > 0) {
          setCategory(data.categories[0]);
        }
      });
  }, []);

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
        category,
        materials,
        dimensions,
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
        <label className="block text-sm text-foreground">
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

        <label className="block text-sm text-foreground">
          <span>Category</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="mt-1 w-full rounded-md border border-(--accent-terra)/50 bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-(--accent-terra)"
          >
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
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

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Product Images</p>
        <label className="inline-block cursor-pointer rounded-md border border-(--accent-terra) px-3 py-2 text-sm text-(--accent-terra) hover:bg-(--accent-beige)">
          Upload Image
          <input
            type="file"
            accept="image/*"
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
          disabled={loading || uploading}
          className="rounded-md bg-(--accent-terra) px-5 py-2 font-semibold text-(--accent-beige) hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Creating..." : "Create Product"}
        </button>
      </div>
    </form>
  );
}
