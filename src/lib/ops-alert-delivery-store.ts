import fs from "node:fs/promises";
import path from "node:path";

export type OpsAlertDeliveryStatus = {
  lastAttemptAt: string;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
  lastHttpStatus: number | null;
  destinationConfigured: boolean;
};

const dataDir = path.join(process.cwd(), "data");
const statusPath = path.join(dataDir, "ops-alert-delivery-status.json");

export async function getOpsAlertDeliveryStatus(): Promise<OpsAlertDeliveryStatus | null> {
  try {
    const raw = await fs.readFile(statusPath, "utf8");
    return JSON.parse(raw) as OpsAlertDeliveryStatus;
  } catch {
    return null;
  }
}

export async function saveOpsAlertDeliveryStatus(status: OpsAlertDeliveryStatus) {
  try {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(statusPath, JSON.stringify(status, null, 2), "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code === "EROFS") {
      // Vercel serverless runtime is read-only; alert dispatch should continue.
      console.warn("[ops-alert-delivery-store] Skipping status write on read-only filesystem.");
      return;
    }
    throw error;
  }
}
