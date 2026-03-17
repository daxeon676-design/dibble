import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

type CheckResult = {
  name: string;
  command: string;
  required: boolean;
  passed: boolean;
  output: string;
};

function runCommand(command: string): { passed: boolean; output: string } {
  try {
    const output = execSync(command, { encoding: "utf8", stdio: "pipe" });
    return { passed: true, output };
  } catch (error) {
    const stdout = error instanceof Error && "stdout" in error ? String((error as { stdout?: string }).stdout ?? "") : "";
    const stderr = error instanceof Error && "stderr" in error ? String((error as { stderr?: string }).stderr ?? "") : "";
    const message = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");
    return { passed: false, output: message || "Command failed with no captured output." };
  }
}

function truncate(text: string, max = 4000) {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n... [truncated]`;
}

const checks: Array<{ name: string; command: string; required: boolean }> = [
  { name: "Lint", command: "npm run lint", required: true },
  { name: "Tests", command: "npm run test", required: true },
  { name: "Build", command: "npm run build", required: true },
  { name: "Security Smoke", command: "npm run security:smoke", required: true },
  { name: "Launch Smoke", command: "npm run launch:smoke", required: true },
  { name: "Launch Smoke Strict", command: "npm run launch:smoke:strict", required: true },
  { name: "Prod Audit", command: "npm audit --omit=dev", required: false },
];

const results: CheckResult[] = checks.map((check) => {
  console.log(`Running: ${check.name} (${check.command})`);
  const run = runCommand(check.command);
  return {
    name: check.name,
    command: check.command,
    required: check.required,
    passed: run.passed,
    output: truncate(run.output.trim()),
  };
});

const requiredFailed = results.filter((result) => result.required && !result.passed);
const optionalFailed = results.filter((result) => !result.required && !result.passed);

const lines: string[] = [];
lines.push("# Launch Gate Report");
lines.push("");
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push("");
lines.push("## Summary");
lines.push("");
lines.push(`- Required checks passed: ${results.filter((r) => r.required && r.passed).length}/${results.filter((r) => r.required).length}`);
lines.push(`- Optional checks passed: ${results.filter((r) => !r.required && r.passed).length}/${results.filter((r) => !r.required).length}`);
lines.push(`- Launch gate status: ${requiredFailed.length === 0 ? "PASS" : "FAIL"}`);
lines.push("");

if (requiredFailed.length > 0) {
  lines.push("## Required Failures");
  lines.push("");
  for (const result of requiredFailed) {
    lines.push(`- ${result.name}`);
  }
  lines.push("");
}

if (optionalFailed.length > 0) {
  lines.push("## Optional Failures");
  lines.push("");
  for (const result of optionalFailed) {
    lines.push(`- ${result.name}`);
  }
  lines.push("");
}

lines.push("## Details");
lines.push("");

for (const result of results) {
  lines.push(`### ${result.name}`);
  lines.push("");
  lines.push(`- Command: \`${result.command}\``);
  lines.push(`- Required: ${result.required ? "Yes" : "No"}`);
  lines.push(`- Status: ${result.passed ? "PASS" : "FAIL"}`);
  lines.push("");
  lines.push("```text");
  lines.push(result.output || "(no output)");
  lines.push("```");
  lines.push("");
}

const reportPath = path.join(process.cwd(), "docs", "launch-gate-report.md");
fs.writeFileSync(reportPath, `${lines.join("\n")}\n`, "utf8");

console.log(`\nLaunch gate report written to ${reportPath}`);

if (requiredFailed.length > 0) {
  process.exit(1);
}
