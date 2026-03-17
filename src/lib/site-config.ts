import fs from "node:fs/promises";
import path from "node:path";

export type DeliveryOption = {
  id: string;
  name: string;
  costPence: number;
  enabled: boolean;
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

type SellerDeliveryMap = Record<string, string[]>;
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
      "Bath/Beauty",
      "Books",
      "Carving",
      "Clothing",
      "Home",
      "Jewellery",
      "Knitting/Crochet",
      "Lino Prints",
      "Painting",
      "Paper",
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
  return {
    ...defaults,
    ...stored,
    categories: stored.categories ?? defaults.categories,
    deliveryOptions: stored.deliveryOptions ?? defaults.deliveryOptions,
  };
}

export async function saveSiteConfig(config: SiteConfig) {
  await writeJsonFile(configPath, config);
}

export async function getSellerDeliveryOptionsMap(): Promise<SellerDeliveryMap> {
  return readJsonFile<SellerDeliveryMap>(sellerDeliveryPath, {});
}

export async function setSellerDeliveryOptions(sellerId: string, optionIds: string[]) {
  const map = await getSellerDeliveryOptionsMap();
  map[sellerId] = [...new Set(optionIds)];
  await writeJsonFile(sellerDeliveryPath, map);
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
