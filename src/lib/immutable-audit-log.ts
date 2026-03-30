/**
 * Immutable audit logging for critical actions
 */

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

interface AuditLogEntry {
  actor: string;
  action: string;
  targetType: string;
  targetId: string;
  details: unknown;
  ipAddress?: string;
  userAgent?: string;
}

function toJsonInput(value: unknown): Prisma.InputJsonValue {
  if (value === undefined) return {};
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function logAuditEvent(entry: AuditLogEntry) {
  try {
    return await prisma.immutableAuditLog.create({
      data: {
        actor: entry.actor,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        details: toJsonInput(entry.details),
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
      },
    });
  } catch (error) {
    console.error("Failed to log audit event:", error);
    // Non-blocking - audit logging failures shouldn't break operations
    return null;
  }
}

export async function getAuditLog(
  filters?: {
    actor?: string;
    action?: string;
    targetType?: string;
    targetId?: string;
    startDate?: Date;
    endDate?: Date;
  },
  limit: number = 100
) {
  const where: Record<string, unknown> = {};

  if (filters?.actor) where.actor = filters.actor;
  if (filters?.action) where.action = filters.action;
  if (filters?.targetType) where.targetType = filters.targetType;
  if (filters?.targetId) where.targetId = filters.targetId;

  if (filters?.startDate || filters?.endDate) {
    where.timestamp = {} as Record<string, Date>;
    if (filters?.startDate) (where.timestamp as Record<string, Date>).gte = filters.startDate;
    if (filters?.endDate) (where.timestamp as Record<string, Date>).lte = filters.endDate;
  }

  return await prisma.immutableAuditLog.findMany({
    where,
    orderBy: { timestamp: "desc" },
    take: limit,
  });
}

export async function exportAuditLog(
  filters?: {
    actor?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
  }
): Promise<string> {
  const logs = await getAuditLog(filters, 100000);

  const header = ["Timestamp", "Actor", "Action", "Target Type", "Target ID", "Details"].join(",");
  const rows = logs
    .map((log) =>
      [
        log.timestamp.toISOString(),
        log.actor,
        log.action,
        log.targetType,
        log.targetId,
        JSON.stringify(log.details).replace(/"/g, '""'),
      ]
        .map((cell) => `"${cell}"`)
        .join(",")
    )
    .join("\n");

  return [header, rows].join("\n");
}
