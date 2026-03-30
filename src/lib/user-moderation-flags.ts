import fs from "node:fs/promises";
import path from "node:path";

export type UserModerationFlag = {
  flagged: boolean;
  reason: string | null;
  updatedAt: string;
  updatedById: string;
};

type UserModerationFlagMap = Record<string, UserModerationFlag>;

const dataDir = path.join(process.cwd(), "data");
const flagsPath = path.join(dataDir, "user-moderation-flags.json");

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

export async function getUserModerationFlags(): Promise<UserModerationFlagMap> {
  return readJsonFile<UserModerationFlagMap>(flagsPath, {});
}

export async function setUserModerationFlag(input: {
  userId: string;
  flagged: boolean;
  reason?: string | null;
  updatedById: string;
}): Promise<UserModerationFlag> {
  const map = await getUserModerationFlags();
  const next: UserModerationFlag = {
    flagged: input.flagged,
    reason: input.flagged ? (input.reason?.trim() || null) : null,
    updatedAt: new Date().toISOString(),
    updatedById: input.updatedById,
  };

  map[input.userId] = next;
  await writeJsonFile(flagsPath, map);
  return next;
}
