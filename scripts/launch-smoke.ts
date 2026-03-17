import fs from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

function check(condition: boolean, okMsg: string, failMsg: string) {
  if (condition) {
    console.log(`PASS: ${okMsg}`);
    return true;
  }

  console.error(`FAIL: ${failMsg}`);
  return false;
}

function exists(filePath: string) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

const root = process.cwd();
const checks: boolean[] = [];
const strictMode = process.argv.includes("--strict");

function checkInMode(envName: string, strictRequired: boolean, strictMsg?: string) {
  const ok = Boolean(process.env[envName]);
  const message = strictMsg ?? `${envName} is missing`;

  if (strictMode && strictRequired) {
    checks.push(check(ok, `${envName} is set`, message));
    return;
  }

  if (ok) {
    console.log(`PASS: ${envName} is set`);
  } else {
    console.warn(
      `WARN: ${envName} is missing${strictRequired ? " (required for strict launch checks)" : ""}`,
    );
  }
}

checks.push(check(Boolean(process.env.DATABASE_URL), "DATABASE_URL is set", "DATABASE_URL is missing"));
checks.push(check(Boolean(process.env.NEXTAUTH_SECRET), "NEXTAUTH_SECRET is set", "NEXTAUTH_SECRET is missing"));

checkInMode("NEXTAUTH_URL", true, "NEXTAUTH_URL is missing");
checkInMode(
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  true,
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is missing",
);
checkInMode("STRIPE_WEBHOOK_SECRET", true, "STRIPE_WEBHOOK_SECRET is missing");
checkInMode("OPS_CRON_SECRET", true, "OPS_CRON_SECRET is missing");
checks.push(check(Boolean(process.env.STRIPE_SECRET_KEY), "STRIPE_SECRET_KEY is set", "STRIPE_SECRET_KEY is missing"));
checkInMode("OPS_ALERT_WEBHOOK_URL", true, "OPS_ALERT_WEBHOOK_URL is missing");
checkInMode("OPS_ALERT_WEBHOOK_BEARER_TOKEN", false);

const payoutProfilesPath = path.join(root, "data", "seller-payout-profiles.json");
checks.push(
  check(
    exists(payoutProfilesPath),
    "data/seller-payout-profiles.json exists",
    "data/seller-payout-profiles.json is missing",
  ),
);

const weeklyPlanPath = path.join(root, "docs", "launch-weekly-implementation-plan.md");
checks.push(
  check(exists(weeklyPlanPath), "Weekly implementation plan exists", "Weekly implementation plan file is missing"),
);

const trackerPath = path.join(root, "docs", "launch-readiness-tracker.md");
checks.push(
  check(exists(trackerPath), "Launch readiness tracker exists", "Launch readiness tracker file is missing"),
);

if (checks.every(Boolean)) {
  console.log("\nSmoke check passed.");
  process.exit(0);
}

console.error("\nSmoke check failed.");
process.exit(1);
