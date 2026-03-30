import fs from "node:fs/promises";
import path from "node:path";

export type CartItemMeta = {
  variantId?: string | null;
  variantLabel?: string | null;
  variantPriceDeltaCents?: number;
};

type CartItemMetaMap = Record<string, CartItemMeta>;

const dataDir = path.join(process.cwd(), "data");
const cartItemMetaPath = path.join(dataDir, "cart-item-meta.json");

async function readCartItemMetaMap(): Promise<CartItemMetaMap> {
  try {
    const raw = await fs.readFile(cartItemMetaPath, "utf8");
    const parsed = JSON.parse(raw) as CartItemMetaMap;
    return parsed ?? {};
  } catch {
    return {};
  }
}

async function writeCartItemMetaMap(value: CartItemMetaMap) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(cartItemMetaPath, JSON.stringify(value, null, 2), "utf8");
}

export async function getCartItemMeta(itemId: string): Promise<CartItemMeta | null> {
  const map = await readCartItemMetaMap();
  return map[itemId] ?? null;
}

export async function getCartItemMetaMap(itemIds: string[]): Promise<CartItemMetaMap> {
  const map = await readCartItemMetaMap();
  return Object.fromEntries(itemIds.map((itemId) => [itemId, map[itemId] ?? {}]));
}

export async function setCartItemMeta(itemId: string, patch: CartItemMeta) {
  const map = await readCartItemMetaMap();
  map[itemId] = {
    ...(map[itemId] ?? {}),
    ...patch,
  };
  await writeCartItemMetaMap(map);
  return map[itemId];
}

export async function deleteCartItemMeta(itemId: string) {
  const map = await readCartItemMetaMap();
  if (!(itemId in map)) {
    return;
  }

  delete map[itemId];
  await writeCartItemMetaMap(map);
}

export async function deleteCartItemMetaMany(itemIds: string[]) {
  if (itemIds.length === 0) {
    return;
  }

  const map = await readCartItemMetaMap();
  let changed = false;

  for (const itemId of itemIds) {
    if (itemId in map) {
      delete map[itemId];
      changed = true;
    }
  }

  if (changed) {
    await writeCartItemMetaMap(map);
  }
}