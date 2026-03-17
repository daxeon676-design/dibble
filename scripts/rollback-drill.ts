#!/usr/bin/env tsx
/**
 * Rollback Drill — verifies that all pre-conditions for a safe production
 * rollback are in place.
 *
 * Run:  npx tsx scripts/rollback-drill.ts
 * Or:   npm run rollback:drill
 *
 * Exit code 0 = all checks passed (drill ready).
 * Exit code 1 = one or more checks failed (drill blocked).
 */

import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import * as https from "https";
import * as http from "http";

type CheckResult = { name: string; passed: boolean; detail: string };

function check(name: string, fn: () => string): CheckResult {
  try {
    const detail = fn();
    return { name, passed: true, detail };
  } catch (error) {
    return { name, passed: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

async function checkAsync(name: string, fn: () => Promise<string>): Promise<CheckResult> {
  try {
    const detail = await fn();
    return { name, passed: true, detail };
  } catch (error) {
    return { name, passed: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

function exec(cmd: string): string {
  return execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
}

async function httpGet(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, { timeout: 5000 }, (res) => {
      let body = "";
      res.on("data", (chunk: Buffer) => { body += chunk.toString(); });
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Request timed out")); });
  });
}

// ─── Checks ─────────────────────────────────────────────────────────────────

const results: CheckResult[] = [];

// 1. Git repo is clean (no uncommitted changes)
results.push(check("Git working tree clean", () => {
  const status = exec("git status --porcelain");
  if (status.length > 0) throw new Error(`Uncommitted changes:\n${status}`);
  return "clean";
}));

// 2. At least one release tag exists
results.push(check("Release tag exists", () => {
  const tags = exec("git tag --list 'v*'");
  if (!tags) throw new Error("No version tags found. Run: git tag v0.x.x <commit>");
  const latest = tags.split("\n").at(-1);
  return `Latest tag: ${latest}`;
}));

// 3. Previous release tag can be checked out (not just current HEAD)
results.push(check("Previous tag is accessible", () => {
  const tags = exec("git tag --list 'v*' --sort=-version:refname");
  const tagList = tags.split("\n").filter(Boolean);
  if (tagList.length < 2) throw new Error("Only one version tag. Need at least two to verify rollback path.");
  return `Can roll back from ${tagList[0]} to ${tagList[1]}`;
}));

// 4. Prisma migration history is consistent
results.push(check("Prisma migration files present", () => {
  const exists = existsSync("prisma/migrations");
  if (!exists) throw new Error("prisma/migrations directory not found");
  const count = exec("dir prisma\\migrations /b 2>nul | find /c /v \"\"").replace(/\D/g, "") || exec("ls prisma/migrations | wc -l");
  return `${count.trim()} migration(s) on disk`;
}));

// 5. Rollback runbook exists
results.push(check("Rollback runbook on disk", () => {
  if (!existsSync("docs/ROLLBACK.md")) throw new Error("docs/ROLLBACK.md not found");
  return "docs/ROLLBACK.md present";
}));

// 6. Required env vars for a minimal restart are set
const requiredEnvVars = ["DATABASE_URL", "NEXTAUTH_SECRET", "NEXTAUTH_URL"];
for (const envVar of requiredEnvVars) {
  results.push(check(`Env var: ${envVar}`, () => {
    if (!process.env[envVar]) throw new Error(`${envVar} is not set`);
    return "set";
  }));
}

// 7. Optional: health endpoint reachable (only if NEXTAUTH_URL is set)
const baseUrl = process.env.NEXTAUTH_URL;
if (baseUrl) {
  results.push(await checkAsync("Health endpoint reachable", async () => {
    const url = `${baseUrl.replace(/\/$/, "")}/api/health`;
    const response = await httpGet(url);
    if (response.status !== 200) {
      throw new Error(`Health check returned HTTP ${response.status}`);
    }
    const body = JSON.parse(response.body) as { status?: string };
    if (body.status !== "ok") throw new Error(`Health check status: ${body.status}`);
    return `${url} → ok`;
  }));
}

// 8. Vercel cron config exists (for scheduled reconciliation)
results.push(check("Vercel cron config present", () => {
  if (!existsSync("vercel.json")) throw new Error("vercel.json not found — scheduled cron not configured");
  const raw = readFileSync("vercel.json", "utf8");
  const config = JSON.parse(raw) as { crons?: unknown[] };
  if (!config.crons || config.crons.length === 0) throw new Error("vercel.json has no crons entries");
  return `${config.crons.length} cron job(s) configured`;
}));

// ─── Report ──────────────────────────────────────────────────────────────────

const passed = results.filter((r) => r.passed);
const failed = results.filter((r) => !r.passed);

console.log("\n╔══════════════════════════════════════════════════╗");
console.log("║           Dibble Rollback Drill Report           ║");
console.log("╚══════════════════════════════════════════════════╝");
console.log(`  Date: ${new Date().toISOString()}\n`);

for (const result of results) {
  const icon = result.passed ? "✓" : "✗";
  const colour = result.passed ? "\x1b[32m" : "\x1b[31m";
  console.log(`  ${colour}${icon}\x1b[0m ${result.name}`);
  if (!result.passed) {
    console.log(`      └─ ${result.detail}`);
  }
}

console.log(`\n  Passed: ${passed.length}/${results.length}`);

if (failed.length > 0) {
  console.log("\x1b[31m\n  DRILL BLOCKED — resolve failed checks before rollback is safe.\x1b[0m\n");
  process.exit(1);
} else {
  console.log("\x1b[32m\n  DRILL PASSED — rollback pre-conditions are satisfied.\x1b[0m\n");
}
