import fs from "node:fs/promises";
import path from "node:path";

export type DeliveryOption = {
  id: string;
  name: string;
  costPence: number;
  enabled: boolean;
};

export type SellerDeliverySettings = {
  optionIds: string[];
  customCostsPence: Record<string, number>;
  freeDeliveryThresholdPence: number;
};

export type SiteConfig = {
  categories: string[];
  deliveryOptions: DeliveryOption[];
  homepageTagline: string;
  footerDescription: string;
  platformFeePercent: number;
  supportEmail: string;
  allowNewSellerApplications: boolean;
  maxActiveSellerAccounts: number;
};

type SellerDeliveryMap = Record<string, string[] | Partial<SellerDeliverySettings>>;
type SellerDeliverySettingsMap = Record<string, SellerDeliverySettings>;
export type ProductMeta = {
  category?: string;
  materials?: string;
  dimensions?: string;
};

export type SellerShopProfile = {
  headline?: string;
  description?: string;
  logoUrl?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  websiteUrl?: string;
  localDiscoveryEnabled?: boolean;
  localDiscoveryLocation?: string;
  localDiscoveryRadiusMiles?: number;
};

export type SellerPayoutMethod = "STRIPE_CONNECT" | "BANK_TRANSFER" | "PAYPAL" | "MANUAL_REVIEW";

export type SellerPayoutProfile = {
  method?: SellerPayoutMethod;
  payeeName?: string;
  payoutEmail?: string;
  bankName?: string;
  bankAccountLast4?: string;
  bankSortCodeLast2?: string;
  paypalEmail?: string;
  notes?: string;
  adminNotes?: string;
  updatedAt?: string;
};

type ProductMetaMap = Record<string, ProductMeta>;
type SellerShopProfileMap = Record<string, SellerShopProfile>;
type SellerStripeAccountMap = Record<string, string>;
type SellerPayoutProfileMap = Record<string, SellerPayoutProfile>;

const dataDir = path.join(process.cwd(), "data");
const configPath = path.join(dataDir, "site-config.json");
const sellerDeliveryPath = path.join(dataDir, "seller-delivery-options.json");
const productMetaPath = path.join(dataDir, "product-meta.json");
const sellerShopProfilesPath = path.join(dataDir, "seller-shop-profiles.json");
const sellerStripeAccountsPath = path.join(dataDir, "seller-stripe-accounts.json");
const sellerPayoutProfilesPath = path.join(dataDir, "seller-payout-profiles.json");

function toPence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function normalizeSellerDeliverySettings(input: string[] | Partial<SellerDeliverySettings> | undefined): SellerDeliverySettings {
  if (!input) {
    return {
      optionIds: [],
      customCostsPence: {},
      freeDeliveryThresholdPence: 0,
    };
  }

  if (Array.isArray(input)) {
    return {
      optionIds: [...new Set(input)],
      customCostsPence: {},
      freeDeliveryThresholdPence: 0,
    };
  }

  const customCostsRaw = input.customCostsPence ?? {};
  const normalizedCustomCosts = Object.fromEntries(
    Object.entries(customCostsRaw)
      .filter(([id]) => Boolean(id))
      .map(([id, pence]) => [id, toPence(Number(pence))]),
  );

  return {
    optionIds: [...new Set(input.optionIds ?? [])],
    customCostsPence: normalizedCustomCosts,
    freeDeliveryThresholdPence: toPence(Number(input.freeDeliveryThresholdPence ?? 0)),
  };
}

export function calculateMarketplaceSplit(totalCents: number, platformFeePercent: number) {
  const normalizedPercent = Number.isFinite(platformFeePercent) ? Math.max(0, platformFeePercent) : 0;
  const platformFeeCents = Math.round(totalCents * (normalizedPercent / 100));
  const sellerPayoutCents = Math.max(0, totalCents - platformFeeCents);
  return {
    platformFeeCents,
    sellerPayoutCents,
  };
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile<T>(filePath: string, value: T) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

export async function getSiteConfig(): Promise<SiteConfig> {
  const defaults: SiteConfig = {
    categories: [
      "Accessories",
      "Apparell",
      "Bath/Beauty",
      "Books",
      "Carving",
      "Food",
      "Home",
      "Jewellery",
      "Knitting/Crochet",
      "Lino Prints",
      "Local",
      "Painting",
      "Paper",
      "Pets",
      "Photography",
      "Picture Frames",
      "Pictures",
      "Pottery/Ceramics",
    ],
    deliveryOptions: [
      { id: "standard", name: "Standard Delivery", costPence: 399, enabled: true },
      { id: "express", name: "Express Delivery", costPence: 799, enabled: true },
    ],
    homepageTagline: "Shop the latest handcrafted products from talented artists around the world.",
    footerDescription: "Shop the latest handcrafted products from talented artists around the world.",
    platformFeePercent: 5,
    supportEmail: "support@dibble.local",
    allowNewSellerApplications: true,
    maxActiveSellerAccounts: 250,
  };

  const stored = await readJsonFile<Partial<SiteConfig>>(configPath, defaults);
  const storedCategories = (stored.categories ?? defaults.categories).map((item) =>
    item.trim().toLowerCase() === "home decor" ? "Home" : item,
  );

  const requiredCategories = ["Apparell", "Food", "Local", "Pets", "Home"];
  for (const required of requiredCategories) {
    if (!storedCategories.some((item) => item.toLowerCase() === required.toLowerCase())) {
      storedCategories.push(required);
    }
  }

  return {
    ...defaults,
    ...stored,
    categories: [...new Set(storedCategories)],
    deliveryOptions: stored.deliveryOptions ?? defaults.deliveryOptions,
  };
}

export async function saveSiteConfig(config: SiteConfig) {
  await writeJsonFile(configPath, config);
}

export async function getSellerDeliverySettingsMap(): Promise<SellerDeliverySettingsMap> {
  const rawMap = await readJsonFile<SellerDeliveryMap>(sellerDeliveryPath, {});

  return Object.fromEntries(
    Object.entries(rawMap).map(([sellerId, rawValue]) => [sellerId, normalizeSellerDeliverySettings(rawValue)]),
  );
}

export async function getSellerDeliveryOptionsMap(): Promise<Record<string, string[]>> {
  const map = await getSellerDeliverySettingsMap();
  return Object.fromEntries(Object.entries(map).map(([sellerId, settings]) => [sellerId, settings.optionIds]));
}

export function resolveSellerDeliveryCostPence(
  settings: SellerDeliverySettings,
  optionId: string,
  fallbackCostPence: number,
  sellerSubtotalPence: number,
): number {
  const threshold = toPence(settings.freeDeliveryThresholdPence);
  if (threshold > 0 && sellerSubtotalPence >= threshold) {
    return 0;
  }

  const custom = settings.customCostsPence[optionId];
  if (Number.isFinite(custom)) {
    return toPence(custom);
  }

  return toPence(fallbackCostPence);
}

export async function setSellerDeliverySettings(sellerId: string, settingsPatch: Partial<SellerDeliverySettings>) {
  const map = await getSellerDeliverySettingsMap();
  const current = map[sellerId] ?? normalizeSellerDeliverySettings(undefined);

  map[sellerId] = normalizeSellerDeliverySettings({
    ...current,
    ...settingsPatch,
    optionIds: settingsPatch.optionIds ?? current.optionIds,
    customCostsPence: {
      ...current.customCostsPence,
      ...(settingsPatch.customCostsPence ?? {}),
    },
    freeDeliveryThresholdPence:
      settingsPatch.freeDeliveryThresholdPence ?? current.freeDeliveryThresholdPence,
  });

  await writeJsonFile(sellerDeliveryPath, map);
}

export async function setSellerDeliveryOptions(sellerId: string, optionIds: string[]) {
  await setSellerDeliverySettings(sellerId, { optionIds: [...new Set(optionIds)] });
}

export async function getProductMetaMap(): Promise<ProductMetaMap> {
  return readJsonFile<ProductMetaMap>(productMetaPath, {});
}

export async function setProductMeta(productId: string, patch: ProductMeta) {
  const map = await getProductMetaMap();
  map[productId] = { ...(map[productId] ?? {}), ...patch };
  await writeJsonFile(productMetaPath, map);
}

export async function setProductCategory(productId: string, category: string | undefined) {
  await setProductMeta(productId, { category });
}

export async function getSellerShopProfiles(): Promise<SellerShopProfileMap> {
  return readJsonFile<SellerShopProfileMap>(sellerShopProfilesPath, {});
}

export async function getSellerShopProfile(sellerId: string): Promise<SellerShopProfile> {
  const profiles = await getSellerShopProfiles();
  return profiles[sellerId] ?? {};
}

export async function setSellerShopProfile(sellerId: string, patch: SellerShopProfile) {
  const profiles = await getSellerShopProfiles();
  profiles[sellerId] = { ...(profiles[sellerId] ?? {}), ...patch };
  await writeJsonFile(sellerShopProfilesPath, profiles);
}

export async function getSellerStripeAccountMap(): Promise<SellerStripeAccountMap> {
  return readJsonFile<SellerStripeAccountMap>(sellerStripeAccountsPath, {});
}

export async function getSellerStripeAccountId(sellerId: string): Promise<string | null> {
  const map = await getSellerStripeAccountMap();
  const accountId = map[sellerId];
  return accountId && accountId.startsWith("acct_") ? accountId : null;
}

export async function setSellerStripeAccountId(sellerId: string, accountId: string) {
  const map = await getSellerStripeAccountMap();
  map[sellerId] = accountId;
  await writeJsonFile(sellerStripeAccountsPath, map);
}

export async function getSellerPayoutProfiles(): Promise<SellerPayoutProfileMap> {
  return readJsonFile<SellerPayoutProfileMap>(sellerPayoutProfilesPath, {});
}

export async function getSellerPayoutProfile(sellerId: string): Promise<SellerPayoutProfile> {
  const profiles = await getSellerPayoutProfiles();
  return profiles[sellerId] ?? {};
}

export async function setSellerPayoutProfile(sellerId: string, patch: SellerPayoutProfile) {
  const profiles = await getSellerPayoutProfiles();
  profiles[sellerId] = {
    ...(profiles[sellerId] ?? {}),
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await writeJsonFile(sellerPayoutProfilesPath, profiles);
}
