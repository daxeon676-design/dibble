import "dotenv/config";
import bcrypt from "bcrypt";
import fs from "node:fs/promises";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { Role, UserStatus } from "../src/generated/prisma/enums";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set in environment variables.");
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DEFAULT_SITE_CONFIG = {
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
  platformFeePercent: 12,
  supportEmail: "contact@dibblemarketplace.com",
  allowNewSellerApplications: true,
  maxActiveSellerAccounts: 250,
};

async function ensureBaselineSiteConfig() {
  const dataDir = path.join(process.cwd(), "data");
  const configPath = path.join(dataDir, "site-config.json");

  await fs.mkdir(dataDir, { recursive: true });

  try {
    const raw = await fs.readFile(configPath, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    const merged = {
      ...DEFAULT_SITE_CONFIG,
      ...parsed,
      categories: [
        ...new Set([
          ...DEFAULT_SITE_CONFIG.categories,
          ...((Array.isArray(parsed.categories) ? parsed.categories : []) as string[]),
        ]),
      ],
      deliveryOptions: Array.isArray(parsed.deliveryOptions)
        ? parsed.deliveryOptions
        : DEFAULT_SITE_CONFIG.deliveryOptions,
    };

    await fs.writeFile(configPath, JSON.stringify(merged, null, 2), "utf8");
  } catch {
    await fs.writeFile(configPath, JSON.stringify(DEFAULT_SITE_CONFIG, null, 2), "utf8");
  }
}

function shouldSeedSandboxData() {
  const argEnabled = process.argv.some((arg) => arg === "--sandbox" || arg === "--demo");
  const envEnabled = String(process.env.SEED_SANDBOX ?? "false").toLowerCase() === "true";
  return argEnabled || envEnabled;
}

function resolveAdminEmail() {
  const preferred = (process.env.PRIMARY_ADMIN_EMAIL ?? "daxeon676@gmail.com").trim().toLowerCase();
  const legacy = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();

  if (legacy && legacy !== "admin@dibble.local") {
    return legacy;
  }

  return preferred;
}

async function seedSandboxData() {
  const sellerPassword = await bcrypt.hash(process.env.SANDBOX_SELLER_PASSWORD ?? "SandboxSeller123!", 12);
  const buyerPassword = await bcrypt.hash(process.env.SANDBOX_BUYER_PASSWORD ?? "SandboxBuyer123!", 12);

  const seller = await prisma.user.upsert({
    where: { email: "seller.demo@dibble.local" },
    update: {
      passwordHash: sellerPassword,
      role: Role.SELLER,
      status: UserStatus.ACTIVE,
      displayName: "Demo Seller",
      country: "United Kingdom",
    },
    create: {
      email: "seller.demo@dibble.local",
      passwordHash: sellerPassword,
      role: Role.SELLER,
      status: UserStatus.ACTIVE,
      displayName: "Demo Seller",
      country: "United Kingdom",
    },
  });

  const buyer = await prisma.user.upsert({
    where: { email: "buyer.demo@dibble.local" },
    update: {
      passwordHash: buyerPassword,
      role: Role.BUYER,
      status: UserStatus.ACTIVE,
      displayName: "Demo Buyer",
      country: "United Kingdom",
    },
    create: {
      email: "buyer.demo@dibble.local",
      passwordHash: buyerPassword,
      role: Role.BUYER,
      status: UserStatus.ACTIVE,
      displayName: "Demo Buyer",
      country: "United Kingdom",
    },
  });

  await prisma.sellerApplication.upsert({
    where: { userId: seller.id },
    update: {
      shopName: "Demo Maker Shop",
      description: "Sandbox seller profile for safe testing.",
      status: "APPROVED",
      reviewedAt: new Date(),
      confirmedAdult: true,
      sellerTermsAcceptedAt: new Date(),
    },
    create: {
      userId: seller.id,
      shopName: "Demo Maker Shop",
      description: "Sandbox seller profile for safe testing.",
      status: "APPROVED",
      reviewedAt: new Date(),
      confirmedAdult: true,
      sellerTermsAcceptedAt: new Date(),
    },
  });

  const existingDemoProduct = await prisma.product.findFirst({
    where: {
      sellerId: seller.id,
      title: "Demo Handmade Item",
    },
    select: { id: true },
  });

  if (!existingDemoProduct) {
    await prisma.product.create({
      data: {
        sellerId: seller.id,
        title: "Demo Handmade Item",
        description: "A demo listing for sandbox testing only.",
        priceCents: 1250,
        imageUrls: [],
        stock: 12,
        status: "ACTIVE",
      },
    });
  }

  console.log(`Sandbox buyer user ready: ${buyer.email}`);
  console.log(`Sandbox seller user ready: ${seller.email}`);
}

async function main() {
  const adminEmail = resolveAdminEmail();
  const adminPassword = process.env.ADMIN_SEED_PASSWORD ?? "ChangeMe123!";
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      displayName: "Dibble Admin",
      country: "United Kingdom",
    },
    create: {
      email: adminEmail,
      passwordHash,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      displayName: "Dibble Admin",
      country: "United Kingdom",
    },
  });

  await ensureBaselineSiteConfig();

  console.log(`Seeded admin user: ${admin.email}`);

  if (shouldSeedSandboxData()) {
    await seedSandboxData();
    console.log("Sandbox mode was enabled; demo users and listing were seeded.");
  } else {
    console.log("Sandbox mode disabled. Seeded baseline only.");
    console.log("Tip: run with `SEED_SANDBOX=true npm run db:seed` to add demo buyer/seller data.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
