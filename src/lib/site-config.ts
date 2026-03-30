import fs from "node:fs/promises";
import path from "node:path";

import { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

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

export type PendingScheduledChange = {
  value: number;
  effectiveAt: string; // ISO date string
};

export type ConfigAuditEntry = {
  savedAt: string;
  savedBy: string;
  config: SiteConfig;
};

export type ProductVariant = {
  id: string;
  label: string;
  priceDeltaCents: number;
  stockOverride?: number | null;
  sku?: string | null;
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
  maintenanceMode: boolean;
  checkoutPaused: boolean;
  newAccountsPaused: boolean;
  pendingFeeChange: PendingScheduledChange | null;
  pendingSellerLimitChange: PendingScheduledChange | null;
};

type SellerDeliveryMap = Record<string, string[] | Partial<SellerDeliverySettings>>;
type SellerDeliverySettingsMap = Record<string, SellerDeliverySettings>;
export type ProductMeta = {
  category?: string;
  categories?: string[];
  materials?: string;
  dimensions?: string;
  draft?: boolean;
  publishAt?: string;
  variants?: ProductVariant[];
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
  verified?: boolean;
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
const configHistoryPath = path.join(dataDir, "site-config-history.json");
const sellerDeliveryPath = path.join(dataDir, "seller-delivery-options.json");
const productMetaPath = path.join(dataDir, "product-meta.json");
const sellerShopProfilesPath = path.join(dataDir, "seller-shop-profiles.json");

const CATEGORY_ALIASES: Record<string, string> = {
  apparel: "Apparel",
  apparell: "Apparel",
  "bath & beauty": "Bath & Beauty",
  "bath/beauty": "Bath & Beauty",
  ceramics: "Ceramics",
  "home decor": "Home",
  "knitting & crochet": "Knitting & Crochet",
  "knitting/crochet": "Knitting & Crochet",
  "paper & party": "Paper & Party",
  paper: "Paper & Party",
  "pottery/ceramics": "Ceramics",
};

function normalizeCategoryLabel(category: string): string {
  const trimmed = category.trim();
  if (!trimmed) {
    return "";
  }

  return CATEGORY_ALIASES[trimmed.toLowerCase()] ?? trimmed;
}

function normalizeCategoryList(categories: string[]): string[] {
  return [...new Set(categories.map(normalizeCategoryLabel).filter(Boolean))];
}

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
      "Apparel",
      "Bath & Beauty",
      "Books",
      "Carving",
      "Food",
      "Home",
      "Jewellery",
      "Knitting & Crochet",
      "Lino Prints",
      "Local",
      "Painting",
      "Paper & Party",
      "Pets",
      "Photography",
      "Picture Frames",
      "Pictures",
      "Ceramics",
    ],
    deliveryOptions: [
      { id: "standard", name: "Standard Delivery", costPence: 399, enabled: true },
      { id: "express", name: "Express Delivery", costPence: 799, enabled: true },
    ],
    homepageTagline: "Shop the latest handcrafted products from talented artists around the world.",
    footerDescription: "Shop the latest handcrafted products from talented artists around the world.",
    platformFeePercent: 12,
    supportEmail: "contact@dibblemarketplace.com",
    allowNewSellerApplications: true,
    maxActiveSellerAccounts: 250,
    maintenanceMode: false,
    checkoutPaused: false,
    newAccountsPaused: false,
    pendingFeeChange: null,
    pendingSellerLimitChange: null,
  };

  const stored = await readJsonFile<Partial<SiteConfig>>(configPath, defaults);
  const storedCategories = normalizeCategoryList(stored.categories ?? defaults.categories);

  const requiredCategories = ["Apparel", "Food", "Local", "Pets", "Home"];
  for (const required of requiredCategories) {
    if (!storedCategories.some((item) => item.toLowerCase() === required.toLowerCase())) {
      storedCategories.push(required);
    }
  }

  let merged: SiteConfig = {
    ...defaults,
    ...stored,
    categories: normalizeCategoryList(storedCategories),
    deliveryOptions: stored.deliveryOptions ?? defaults.deliveryOptions,
    maintenanceMode: stored.maintenanceMode ?? false,
    checkoutPaused: stored.checkoutPaused ?? false,
    newAccountsPaused: stored.newAccountsPaused ?? false,
    pendingFeeChange: stored.pendingFeeChange ?? null,
    pendingSellerLimitChange: stored.pendingSellerLimitChange ?? null,
  };

  // Apply any scheduled changes whose effective date has passed
  const now = new Date();
  let needsResave = false;
  if (merged.pendingFeeChange && new Date(merged.pendingFeeChange.effectiveAt) <= now) {
    merged = { ...merged, platformFeePercent: merged.pendingFeeChange.value, pendingFeeChange: null };
    needsResave = true;
  }
  if (merged.pendingSellerLimitChange && new Date(merged.pendingSellerLimitChange.effectiveAt) <= now) {
    merged = { ...merged, maxActiveSellerAccounts: merged.pendingSellerLimitChange.value, pendingSellerLimitChange: null };
    needsResave = true;
  }
  if (JSON.stringify(merged.categories) !== JSON.stringify(stored.categories ?? defaults.categories)) {
    needsResave = true;
  }
  if (needsResave) {
    await writeJsonFile(configPath, merged);
  }

  return merged;
}

export async function saveSiteConfig(config: SiteConfig) {
  await writeJsonFile(configPath, {
    ...config,
    categories: normalizeCategoryList(config.categories),
  });
}

export async function getConfigHistory(): Promise<ConfigAuditEntry[]> {
  return readJsonFile<ConfigAuditEntry[]>(configHistoryPath, []);
}

export async function appendConfigHistory(entry: ConfigAuditEntry): Promise<void> {
  const history = await getConfigHistory();
  const updated = [entry, ...history].slice(0, 25); // keep last 25 snapshots
  await writeJsonFile(configHistoryPath, updated);
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
  const normalizedCategory = category ? normalizeCategoryLabel(category) : undefined;
  await setProductMeta(productId, {
    category: normalizedCategory,
    categories: normalizedCategory ? [normalizedCategory] : [],
  });
}

export function normalizeProductVariants(input: ProductVariant[] | undefined): ProductVariant[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const seen = new Set<string>();

  return input
    .map((variant) => ({
      id: variant.id.trim(),
      label: variant.label.trim(),
      priceDeltaCents: Math.round(Number(variant.priceDeltaCents) || 0),
      stockOverride:
        variant.stockOverride === null || variant.stockOverride === undefined
          ? null
          : Math.max(0, Math.trunc(Number(variant.stockOverride))),
      sku: variant.sku?.trim() || null,
    }))
    .filter((variant) => {
      if (!variant.id || !variant.label || seen.has(variant.id)) {
        return false;
      }
      seen.add(variant.id);
      return true;
    });
}

export function getProductVariants(meta: ProductMeta | undefined): ProductVariant[] {
  return normalizeProductVariants(meta?.variants);
}

export function getProductVariant(meta: ProductMeta | undefined, variantId: string | null | undefined) {
  if (!variantId) {
    return null;
  }

  return getProductVariants(meta).find((variant) => variant.id === variantId) ?? null;
}

export function getProductCategories(meta: ProductMeta | undefined): string[] {
  if (!meta) {
    return [];
  }

  const fromArray = Array.isArray(meta.categories) ? meta.categories : [];
  const combined = [...fromArray, ...(meta.category ? [meta.category] : [])]
    .map((value) => normalizeCategoryLabel(value))
    .filter((value) => value.length > 0);

  return [...new Set(combined)];
}

export function isProductPublished(meta: ProductMeta | undefined, now = new Date()): boolean {
  if (!meta) {
    return true;
  }

  if (meta.draft) {
    return false;
  }

  if (meta.publishAt) {
    const publishAt = new Date(meta.publishAt);
    if (!Number.isNaN(publishAt.getTime()) && publishAt.getTime() > now.getTime()) {
      return false;
    }
  }

  return true;
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
  const sellers = await prisma.user.findMany({
    where: {
      role: Role.SELLER,
      stripeConnectAccountId: { not: null },
    },
    select: {
      id: true,
      stripeConnectAccountId: true,
    },
  });

  return Object.fromEntries(
    sellers
      .filter((seller) => Boolean(seller.stripeConnectAccountId))
      .map((seller) => [seller.id, seller.stripeConnectAccountId as string]),
  );
}

export async function getSellerStripeAccountId(sellerId: string): Promise<string | null> {
  const seller = await prisma.user.findUnique({
    where: { id: sellerId },
    select: { stripeConnectAccountId: true },
  });
  const accountId = seller?.stripeConnectAccountId ?? null;
  return accountId && accountId.startsWith("acct_") ? accountId : null;
}

export async function setSellerStripeAccountId(sellerId: string, accountId: string | null) {
  await prisma.user.update({
    where: { id: sellerId },
    data: {
      stripeConnectAccountId: accountId,
      payoutUpdatedAt: new Date(),
    },
  });
}

export async function getSellerPayoutProfiles(): Promise<SellerPayoutProfileMap> {
  const sellers = await prisma.user.findMany({
    where: { role: Role.SELLER },
    select: {
      id: true,
      payoutMethod: true,
      payoutPayeeName: true,
      payoutEmail: true,
      payoutBankName: true,
      payoutBankAccountLast4: true,
      payoutBankSortCodeLast2: true,
      payoutPaypalEmail: true,
      payoutNotes: true,
      payoutAdminNotes: true,
      payoutUpdatedAt: true,
    },
  });

  const map: SellerPayoutProfileMap = {};
  for (const seller of sellers) {
    map[seller.id] = {
      method: (seller.payoutMethod as SellerPayoutMethod | null) ?? undefined,
      payeeName: seller.payoutPayeeName ?? undefined,
      payoutEmail: seller.payoutEmail ?? undefined,
      bankName: seller.payoutBankName ?? undefined,
      bankAccountLast4: seller.payoutBankAccountLast4 ?? undefined,
      bankSortCodeLast2: seller.payoutBankSortCodeLast2 ?? undefined,
      paypalEmail: seller.payoutPaypalEmail ?? undefined,
      notes: seller.payoutNotes ?? undefined,
      adminNotes: seller.payoutAdminNotes ?? undefined,
      updatedAt: seller.payoutUpdatedAt?.toISOString(),
    };
  }

  return map;
}

export async function getSellerPayoutProfile(sellerId: string): Promise<SellerPayoutProfile> {
  const seller = await prisma.user.findUnique({
    where: { id: sellerId },
    select: {
      payoutMethod: true,
      payoutPayeeName: true,
      payoutEmail: true,
      payoutBankName: true,
      payoutBankAccountLast4: true,
      payoutBankSortCodeLast2: true,
      payoutPaypalEmail: true,
      payoutNotes: true,
      payoutAdminNotes: true,
      payoutUpdatedAt: true,
    },
  });

  if (!seller) return {};

  return {
    method: (seller.payoutMethod as SellerPayoutMethod | null) ?? undefined,
    payeeName: seller.payoutPayeeName ?? undefined,
    payoutEmail: seller.payoutEmail ?? undefined,
    bankName: seller.payoutBankName ?? undefined,
    bankAccountLast4: seller.payoutBankAccountLast4 ?? undefined,
    bankSortCodeLast2: seller.payoutBankSortCodeLast2 ?? undefined,
    paypalEmail: seller.payoutPaypalEmail ?? undefined,
    notes: seller.payoutNotes ?? undefined,
    adminNotes: seller.payoutAdminNotes ?? undefined,
    updatedAt: seller.payoutUpdatedAt?.toISOString(),
  };
}

export async function setSellerPayoutProfile(sellerId: string, patch: SellerPayoutProfile) {
  await prisma.user.update({
    where: { id: sellerId },
    data: {
      payoutMethod: patch.method,
      payoutPayeeName: patch.payeeName,
      payoutEmail: patch.payoutEmail,
      payoutBankName: patch.bankName,
      payoutBankAccountLast4: patch.bankAccountLast4,
      payoutBankSortCodeLast2: patch.bankSortCodeLast2,
      payoutPaypalEmail: patch.paypalEmail,
      payoutNotes: patch.notes,
      payoutAdminNotes: patch.adminNotes,
      payoutUpdatedAt: new Date(),
    },
  });
}
