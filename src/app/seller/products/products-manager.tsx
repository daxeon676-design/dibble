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
  listedAt: string;
  renewalNotifiedAt: string | null;
  categories?: string[];
  variants?: Array<{
    id: string;
    label: string;
    priceDeltaCents: number;
    stockOverride?: number | null;
    sku?: string | null;
  }>;
  materials?: string;
  dimensions?: string;
  draft?: boolean;
  publishAt?: string | null;
};

type Props = {
  initialProducts: Product[];
  categories: string[];
  lowStockProducts: Product[];
};

export function SellerProductsManager({ initialProducts, categories, lowStockProducts }: Props) {
  const [products, setProducts] = useState(initialProducts);
  const [bulkStock, setBulkStock] = useState<Record<string, number>>(
    Object.fromEntries(initialProducts.map((p) => [p.id, p.stock])),
  );
  const [bulkSaving, setBulkSaving] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPrice, setEditPrice] = useState("0.00");
  const [editStock, setEditStock] = useState(1);
  const [editCategories, setEditCategories] = useState<string[]>([]);
  const [editVariants, setEditVariants] = useState<Product["variants"]>([]);
  const [editMaterials, setEditMaterials] = useState("");
  const [editDimensions, setEditDimensions] = useState("");
  const [editImageUrls, setEditImageUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [importingCsv, setImportingCsv] = useState(false);
  const [csvSummary, setCsvSummary] = useState<string | null>(null);

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
    setEditCategories(product.categories ?? []);
    setEditVariants(product.variants ?? []);
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
    const parsedPrice = Number(editPrice);
    const normalizedPriceCents = Number.isFinite(parsedPrice) ? Math.round(parsedPrice * 100) : undefined;
    const normalizedStock = Number.isFinite(editStock) ? Math.max(0, Math.trunc(editStock)) : undefined;
    const normalizedCategories = [...new Set(editCategories.map((value) => value.trim()).filter((value) => value.length > 0))];

    const response = await fetch(`/api/products/${productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editTitle,
        description: editDescription,
        priceCents: normalizedPriceCents,
        stock: normalizedStock,
        imageUrls: editImageUrls,
        categories: normalizedCategories,
        variants: (editVariants ?? []).map((variant) => ({
          id: variant.id.trim(),
          label: variant.label.trim(),
          priceDeltaCents: Math.round(Number(variant.priceDeltaCents) || 0),
          stockOverride: variant.stockOverride ?? null,
          sku: variant.sku?.trim() || null,
        })),
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

    setProducts((prev) =>
      prev.map((product) =>
        product.id === productId
          ? {
              ...product,
              ...body.product,
              categories: normalizedCategories,
              variants: editVariants,
              materials: editMaterials,
              dimensions: editDimensions,
            }
          : product,
      ),
    );
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

  async function renewProduct(id: string) {
    const response = await fetch(`/api/seller/products/${id}/renew`, { method: "POST" });
    const body = (await response.json().catch(() => null)) as
      | { error?: string; product?: { listedAt: string; renewalNotifiedAt: string | null; status: string } }
      | null;

    if (!response.ok || !body?.product) {
      setError(body?.error ?? "Could not renew product.");
      return;
    }

    const updatedProduct = body.product;

    setProducts((prev) =>
      prev.map((product) =>
        product.id === id
          ? {
              ...product,
              listedAt: updatedProduct.listedAt,
              renewalNotifiedAt: updatedProduct.renewalNotifiedAt,
              status: updatedProduct.status as "ACTIVE" | "DELISTED",
            }
          : product,
      ),
    );
  }

  async function applyBulkStockUpdate() {
    setBulkSaving(true);
    setError(null);

    const ids = Object.keys(bulkStock);
    for (const productId of ids) {
      const nextStock = Math.max(0, Math.trunc(Number(bulkStock[productId])));
      const current = products.find((p) => p.id === productId);
      if (!current || current.stock === nextStock) {
        continue;
      }

      const response = await fetch(`/api/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock: nextStock }),
      });

      if (!response.ok) {
        setError(`Could not update stock for ${current.title}.`);
      }
    }

    setProducts((prev) =>
      prev.map((p) => ({
        ...p,
        stock: Math.max(0, Math.trunc(Number(bulkStock[p.id] ?? p.stock))),
      })),
    );
    setBulkSaving(false);
  }

  async function exportCsv() {
    setCsvSummary(null);
    const response = await fetch("/api/seller/products/csv/export");
    if (!response.ok) {
      setError("Could not export products CSV.");
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "seller-products-export.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importCsv(file: File) {
    setImportingCsv(true);
    setError(null);
    setCsvSummary(null);

    const csv = await file.text();

    const response = await fetch("/api/seller/products/csv/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv, mode: "upsert" }),
    });

    const body = (await response.json().catch(() => null)) as
      | { error?: string; created?: number; updated?: number; failed?: number; errors?: string[] }
      | null;

    if (!response.ok) {
      setError(body?.error ?? "Could not import products CSV.");
      setImportingCsv(false);
      return;
    }

    setCsvSummary(
      `Import complete: ${body?.created ?? 0} created, ${body?.updated ?? 0} updated, ${body?.failed ?? 0} failed.`,
    );

    if ((body?.errors?.length ?? 0) > 0) {
      setError(body?.errors?.slice(0, 3).join(" ") ?? null);
    }

    window.location.reload();
  }

  return (
    <div className="space-y-6">
      {lowStockProducts.length > 0 ? (
        <section className="rounded-md border border-amber-300 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-amber-900">Low stock alerts</h2>
          <p className="mt-1 text-xs text-amber-800">
            {lowStockProducts.length} product(s) are below the low-stock threshold.
          </p>
        </section>
      ) : null}

      <section className="rounded-md border border-(--accent-terra)/30 bg-(--accent-beige)/20 p-4">
        <h2 className="text-sm font-semibold text-foreground">Bulk stock update</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {sortedProducts.map((product) => (
            <label key={`${product.id}-bulk-stock`} className="flex items-center justify-between rounded border border-(--accent-terra)/20 bg-white px-3 py-2 text-sm">
              <span className="truncate pr-3">{product.title}</span>
              <input
                type="number"
                min={0}
                value={bulkStock[product.id] ?? product.stock}
                onChange={(event) =>
                  setBulkStock((prev) => ({
                    ...prev,
                    [product.id]: Number(event.target.value),
                  }))
                }
                className="w-24 rounded border border-(--accent-terra)/40 px-2 py-1 text-right"
              />
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void applyBulkStockUpdate()}
          disabled={bulkSaving}
          className="mt-3 rounded-md bg-(--accent-terra) px-3 py-2 text-sm font-semibold text-(--accent-beige) hover:opacity-90 disabled:opacity-60"
        >
          {bulkSaving ? "Applying..." : "Apply stock updates"}
        </button>
      </section>

      <section className="rounded-md border border-(--accent-terra)/30 bg-(--accent-beige)/20 p-4">
        <h2 className="text-sm font-semibold text-foreground">CSV import and export</h2>
        <p className="mt-1 text-xs text-foreground/70">
          Export your products to CSV, edit in a spreadsheet, then re-import with upsert mode.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void exportCsv()}
            className="rounded-md border border-(--accent-terra) px-3 py-1.5 text-sm text-(--accent-terra)"
          >
            Download CSV
          </button>
          <label className="cursor-pointer rounded-md bg-(--accent-terra) px-3 py-1.5 text-sm font-semibold text-(--accent-beige) disabled:opacity-60">
            {importingCsv ? "Importing..." : "Import CSV"}
            <input
              type="file"
              accept=".csv,text/csv"
              disabled={importingCsv}
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void importCsv(file);
                }
              }}
            />
          </label>
        </div>
        {csvSummary ? <p className="mt-2 text-xs text-foreground/70">{csvSummary}</p> : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-foreground">Existing Products</h2>
        {sortedProducts.length === 0 ? (
          <p className="text-sm text-foreground/60">No products yet. Use the Create Product button above to add one.</p>
        ) : null}

        {sortedProducts.map((product) => (
          <article key={product.id} className="rounded-md border border-(--accent-terra)/30 bg-white p-4 shadow-sm">
            {product.renewalNotifiedAt ? (
              <div className="mb-3 flex items-start justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2">
                <p className="text-xs text-amber-800">
                  <strong>Renewal required.</strong> This product has been listed for 12 months. Renew it or it will be removed on{" "}
                  {new Date(new Date(product.renewalNotifiedAt).getTime() + 61 * 24 * 60 * 60 * 1000).toLocaleDateString()}.
                </p>
                <button
                  type="button"
                  onClick={() => void renewProduct(product.id)}
                  className="shrink-0 rounded-md bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700"
                >
                  Renew Listing
                </button>
              </div>
            ) : null}

            <p className="mb-2 text-xs text-foreground/60">
              Listed since: {new Date(product.listedAt).toLocaleDateString()}
            </p>

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
              {product.categories && product.categories.length > 0 ? ` · ${product.categories.join(", ")}` : ""}
            </p>
            {product.variants && product.variants.length > 0 ? (
              <p className="mt-1 text-xs text-foreground/60">
                Variants: {product.variants.map((variant) => variant.label).join(", ")}
              </p>
            ) : null}
            {product.draft ? <p className="mt-1 text-xs text-amber-700">Draft (not visible to buyers)</p> : null}
            {!product.draft && product.publishAt ? (
              <p className="mt-1 text-xs text-sky-700">Scheduled for {new Date(product.publishAt).toLocaleString("en-GB")}</p>
            ) : null}
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
                <div className="block text-sm text-foreground">
                  <p>Categories</p>
                  <div className="mt-1 max-h-40 space-y-1 overflow-auto rounded-md border border-(--accent-terra)/50 bg-white px-3 py-2">
                    {categories.map((category) => (
                      <label key={category} className="flex items-center gap-2 text-sm text-foreground">
                        <input
                          type="checkbox"
                          checked={editCategories.includes(category)}
                          onChange={() =>
                            setEditCategories((prev) =>
                              prev.includes(category)
                                ? prev.filter((value) => value !== category)
                                : [...prev, category],
                            )
                          }
                        />
                        <span>{category}</span>
                      </label>
                    ))}
                  </div>
                </div>
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
                <div className="space-y-2 rounded-md border border-(--accent-terra)/20 bg-(--accent-beige)/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">Variants</p>
                    <button
                      type="button"
                      onClick={() =>
                        setEditVariants((prev) => [
                          ...(prev ?? []),
                          {
                            id: `variant-${(prev?.length ?? 0) + 1}`,
                            label: "",
                            priceDeltaCents: 0,
                            stockOverride: null,
                            sku: null,
                          },
                        ])
                      }
                      className="rounded-md border border-(--accent-terra) px-3 py-1 text-xs text-(--accent-terra)"
                    >
                      Add variant
                    </button>
                  </div>
                  {(editVariants ?? []).length === 0 ? <p className="text-xs text-foreground/60">No variants configured.</p> : null}
                  {(editVariants ?? []).map((variant, index) => (
                    <div key={`${variant.id}-${index}`} className="grid gap-3 rounded-md border border-(--accent-terra)/20 bg-white p-3 md:grid-cols-5">
                      <label className="block text-xs text-foreground">
                        <span>ID</span>
                        <input
                          value={variant.id}
                          onChange={(event) =>
                            setEditVariants((prev) =>
                              prev?.map((entry, entryIndex) =>
                                entryIndex === index ? { ...entry, id: event.target.value } : entry,
                              ) ?? [],
                            )
                          }
                          className="mt-1 w-full rounded-md border border-(--accent-terra)/40 px-2 py-1"
                        />
                      </label>
                      <label className="block text-xs text-foreground md:col-span-2">
                        <span>Label</span>
                        <input
                          value={variant.label}
                          onChange={(event) =>
                            setEditVariants((prev) =>
                              prev?.map((entry, entryIndex) =>
                                entryIndex === index ? { ...entry, label: event.target.value } : entry,
                              ) ?? [],
                            )
                          }
                          className="mt-1 w-full rounded-md border border-(--accent-terra)/40 px-2 py-1"
                        />
                      </label>
                      <label className="block text-xs text-foreground">
                        <span>Price delta (£)</span>
                        <input
                          type="number"
                          step="0.01"
                          value={(variant.priceDeltaCents / 100).toFixed(2)}
                          onChange={(event) =>
                            setEditVariants((prev) =>
                              prev?.map((entry, entryIndex) =>
                                entryIndex === index
                                  ? { ...entry, priceDeltaCents: Math.round(Number(event.target.value || "0") * 100) }
                                  : entry,
                              ) ?? [],
                            )
                          }
                          className="mt-1 w-full rounded-md border border-(--accent-terra)/40 px-2 py-1"
                        />
                      </label>
                      <label className="block text-xs text-foreground">
                        <span>Stock override</span>
                        <input
                          type="number"
                          min={0}
                          value={variant.stockOverride ?? ""}
                          onChange={(event) =>
                            setEditVariants((prev) =>
                              prev?.map((entry, entryIndex) =>
                                entryIndex === index
                                  ? {
                                      ...entry,
                                      stockOverride: event.target.value ? Math.max(0, Math.trunc(Number(event.target.value))) : null,
                                    }
                                  : entry,
                              ) ?? [],
                            )
                          }
                          className="mt-1 w-full rounded-md border border-(--accent-terra)/40 px-2 py-1"
                        />
                      </label>
                      <label className="block text-xs text-foreground md:col-span-4">
                        <span>SKU</span>
                        <input
                          value={variant.sku ?? ""}
                          onChange={(event) =>
                            setEditVariants((prev) =>
                              prev?.map((entry, entryIndex) =>
                                entryIndex === index ? { ...entry, sku: event.target.value || null } : entry,
                              ) ?? [],
                            )
                          }
                          className="mt-1 w-full rounded-md border border-(--accent-terra)/40 px-2 py-1"
                        />
                      </label>
                      <div className="flex items-end justify-end md:col-span-1">
                        <button
                          type="button"
                          onClick={() => setEditVariants((prev) => prev?.filter((_, entryIndex) => entryIndex !== index) ?? [])}
                          className="rounded-md bg-red-500 px-3 py-1 text-xs font-semibold text-white"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium text-foreground">Images</p>
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
