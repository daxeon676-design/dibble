"use client";

import { useMemo, useState } from "react";

type Product = {
  id: string;
  title: string;
  description: string;
  priceCents: number;
  stock: number;
  imageUrls: string[];
  status: "ACTIVE" | "DELISTED";
  category?: string;
  materials?: string;
  dimensions?: string;
};

type Props = {
  initialProducts: Product[];
  categories: string[];
};

export function SellerProductsManager({ initialProducts, categories }: Props) {
  const [products, setProducts] = useState(initialProducts);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPrice, setEditPrice] = useState("0.00");
  const [editStock, setEditStock] = useState(1);
  const [editCategory, setEditCategory] = useState("");
  const [editMaterials, setEditMaterials] = useState("");
  const [editDimensions, setEditDimensions] = useState("");
  const [editImageUrls, setEditImageUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => a.title.localeCompare(b.title)),
    [products],
  );

  function startEditing(product: Product) {
    setEditingProductId(product.id);
    setEditTitle(product.title);
    setEditDescription(product.description);
    setEditPrice((product.priceCents / 100).toFixed(2));
    setEditStock(product.stock);
    setEditCategory(product.category ?? categories[0] ?? "");
    setEditMaterials(product.materials ?? "");
    setEditDimensions(product.dimensions ?? "");
    setEditImageUrls(product.imageUrls);
    setError(null);
  }

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

    setEditImageUrls((prev) => [...prev, body.url!]);
  }

  async function saveEdit(productId: string) {
    const response = await fetch(`/api/products/${productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editTitle,
        description: editDescription,
        priceCents: Math.round(Number(editPrice || "0") * 100),
        stock: editStock,
        imageUrls: editImageUrls,
        category: editCategory,
        materials: editMaterials,
        dimensions: editDimensions,
      }),
    });

    const body = (await response.json().catch(() => null)) as
      | { error?: string; product?: Product }
      | null;

    if (!response.ok || !body?.product) {
      setError(body?.error ?? "Could not save product changes.");
      return;
    }

    setProducts((prev) => prev.map((product) => (product.id === productId ? body.product! : product)));
    setEditingProductId(null);
  }

  async function updateStatus(id: string, status: "ACTIVE" | "DELISTED") {
    const response = await fetch(`/api/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      setError("Could not update product status.");
      return;
    }

    setProducts((prev) => prev.map((product) => (product.id === id ? { ...product, status } : product)));
  }

  async function deleteProduct(id: string) {
    const response = await fetch(`/api/products/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      setError("Could not delete product.");
      return;
    }

    setProducts((prev) => prev.filter((product) => product.id !== id));
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-foreground">Existing Products</h2>
        {sortedProducts.length === 0 ? (
          <p className="text-sm text-foreground/60">No products yet. Use the Create Product button above to add one.</p>
        ) : null}

        {sortedProducts.map((product) => (
          <article key={product.id} className="rounded-md border border-(--accent-terra)/30 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-foreground">{product.title}</h3>
              <span className={`text-xs font-medium rounded px-2 py-0.5 ${product.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                {product.status === "ACTIVE" ? "Active" : "Delisted"}
              </span>
            </div>
            {product.imageUrls.length > 0 ? (
              <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                {product.imageUrls.slice(0, 4).map((url) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={url}
                    src={url}
                    alt={product.title}
                    className="h-20 w-full rounded-md border border-(--accent-terra)/20 object-cover"
                  />
                ))}
              </div>
            ) : null}
            <p className="mt-2 text-sm text-foreground/70">{product.description}</p>
            <p className="mt-2 text-sm font-medium text-foreground">
              £{(product.priceCents / 100).toFixed(2)} &middot; Stock: {product.stock}
              {product.category ? ` · ${product.category}` : ""}
            </p>
            {product.materials || product.dimensions ? (
              <p className="mt-1 text-xs text-foreground/60">
                {product.materials ? `Materials: ${product.materials}` : ""}
                {product.materials && product.dimensions ? " · " : ""}
                {product.dimensions ? `Size: ${product.dimensions}` : ""}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => startEditing(product)}
                className="rounded-md border border-(--accent-terra) px-3 py-1 text-sm text-(--accent-terra) hover:bg-(--accent-beige)"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => updateStatus(product.id, product.status === "ACTIVE" ? "DELISTED" : "ACTIVE")}
                className="rounded-md border border-(--accent-terra) px-3 py-1 text-sm text-(--accent-terra) hover:bg-(--accent-beige)"
              >
                {product.status === "ACTIVE" ? "Delist" : "Relist"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Delete "${product.title}"? This cannot be undone.`)) {
                    void deleteProduct(product.id);
                  }
                }}
                className="rounded-md bg-red-500 px-3 py-1 text-sm font-semibold text-white hover:bg-red-600"
              >
                Delete
              </button>
            </div>

            {editingProductId === product.id ? (
              <div className="mt-4 space-y-3 rounded-md border border-(--accent-terra)/30 bg-(--accent-beige)/30 p-4">
                <h4 className="text-sm font-semibold text-foreground">Edit Product</h4>
                <label className="block text-sm text-foreground">
                  <span>Title</span>
                  <input
                    value={editTitle}
                    onChange={(event) => setEditTitle(event.target.value)}
                    className="mt-1 w-full rounded-md border border-(--accent-terra)/50 bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-(--accent-terra)"
                  />
                </label>
                <label className="block text-sm text-foreground">
                  <span>Description</span>
                  <textarea
                    value={editDescription}
                    onChange={(event) => setEditDescription(event.target.value)}
                    className="mt-1 min-h-24 w-full rounded-md border border-(--accent-terra)/50 bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-(--accent-terra)"
                  />
                </label>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block text-sm text-foreground">
                    <span>Price (£)</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={editPrice}
                      onChange={(event) => setEditPrice(event.target.value)}
                      className="mt-1 w-full rounded-md border border-(--accent-terra)/50 bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-(--accent-terra)"
                    />
                  </label>
                  <label className="block text-sm text-foreground">
                    <span>Stock</span>
                    <input
                      type="number"
                      min={0}
                      value={editStock}
                      onChange={(event) => setEditStock(Number(event.target.value))}
                      className="mt-1 w-full rounded-md border border-(--accent-terra)/50 bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-(--accent-terra)"
                    />
                  </label>
                </div>
                <label className="block text-sm text-foreground">
                  <span>Category</span>
                  <select
                    value={editCategory}
                    onChange={(event) => setEditCategory(event.target.value)}
                    className="mt-1 w-full rounded-md border border-(--accent-terra)/50 bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-(--accent-terra)"
                  >
                    {categories.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </label>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block text-sm text-foreground">
                    <span>Materials</span>
                    <input
                      value={editMaterials}
                      onChange={(event) => setEditMaterials(event.target.value)}
                      className="mt-1 w-full rounded-md border border-(--accent-terra)/50 bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-(--accent-terra)"
                    />
                  </label>
                  <label className="block text-sm text-foreground">
                    <span>Size / Dimensions</span>
                    <input
                      value={editDimensions}
                      onChange={(event) => setEditDimensions(event.target.value)}
                      className="mt-1 w-full rounded-md border border-(--accent-terra)/50 bg-white px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-(--accent-terra)"
                    />
                  </label>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium text-foreground">Images</p>
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
                  {uploading ? <p className="mt-1 text-xs text-foreground/60">Uploading...</p> : null}
                  {editImageUrls.length > 0 && (
                    <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                      {editImageUrls.map((url, index) => (
                        <div key={url} className="relative group">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt={editTitle} className="h-20 w-full rounded border border-(--accent-terra)/30 object-cover" />
                          <button
                            type="button"
                            onClick={() => setEditImageUrls((prev) => prev.filter((_, i) => i !== index))}
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
                    type="button"
                    onClick={() => saveEdit(product.id)}
                    className="rounded-md bg-(--accent-terra) px-4 py-1.5 text-sm font-semibold text-(--accent-beige) hover:opacity-90"
                  >
                    Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingProductId(null)}
                    className="rounded-md border border-(--accent-terra)/50 px-4 py-1.5 text-sm text-foreground hover:bg-(--accent-beige)"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </article>
        ))}
      </section>
    </div>
  );
}
