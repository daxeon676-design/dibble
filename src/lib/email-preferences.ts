import fs from "node:fs/promises";
import path from "node:path";

export type EmailPreferences = {
  accountUpdates: boolean;
  orderUpdates: boolean;
  disputeUpdates: boolean;
  returnUpdates: boolean;
  productAnnouncements: boolean;
  sellerProductUpdates: boolean;
};

export type EmailPreferenceKey = keyof EmailPreferences;

type EmailPreferencesMap = Record<string, EmailPreferences>;

const dataDir = path.join(process.cwd(), "data");
const preferencesPath = path.join(dataDir, "email-preferences.json");

const defaultPreferences: EmailPreferences = {
  accountUpdates: true,
  orderUpdates: true,
  disputeUpdates: true,
  returnUpdates: true,
  productAnnouncements: true,
  sellerProductUpdates: true,
};

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

export async function getEmailPreferences(userId: string): Promise<EmailPreferences> {
  const map = await readJsonFile<EmailPreferencesMap>(preferencesPath, {});
  return {
    ...defaultPreferences,
    ...(map[userId] ?? {}),
  };
}

export async function setEmailPreferences(userId: string, patch: Partial<EmailPreferences>) {
  const map = await readJsonFile<EmailPreferencesMap>(preferencesPath, {});
  map[userId] = {
    ...defaultPreferences,
    ...(map[userId] ?? {}),
    ...patch,
  };

  await writeJsonFile(preferencesPath, map);
  return map[userId];
}

export async function isEmailPreferenceEnabled(userId: string, key: EmailPreferenceKey): Promise<boolean> {
  const preferences = await getEmailPreferences(userId);
  return preferences[key];
}
