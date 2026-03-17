import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { Role, UserStatus } from "@/generated/prisma/enums";
import { getOpsAlertRoutingConfig } from "@/lib/ops-alert-dispatcher";
import { getOpsAlertDeliveryStatus } from "@/lib/ops-alert-delivery-store";

export type SystemHealth = {
  ok: boolean;
  timestamp: string;
  latencyMs: number;
  services: {
    database: {
      ok: boolean;
      error: string | null;
    };
    stripe: {
      configured: boolean;
    };
    reconciliationCron: {
      configured: boolean;
    };
    auth: {
      nextAuthSecretConfigured: boolean;
    };
    adminAccounts: {
      activeCount: number;
    };
    adminMfa: {
      adminsWithoutMfa: number;
    };
    alertRouting: {
      configured: boolean;
      lastAttemptAt: string | null;
      lastSuccessAt: string | null;
      lastFailureAt: string | null;
      lastError: string | null;
    };
  };
};

export async function getSystemHealth(): Promise<SystemHealth> {
  const startedAt = Date.now();

  let databaseOk = false;
  let databaseError: string | null = null;

  try {
    await prisma.$queryRaw`SELECT 1`;
    databaseOk = true;
  } catch (error) {
    databaseOk = false;
    databaseError = error instanceof Error ? error.message : "Database check failed";
  }

  const stripeConfigured = Boolean(stripe);
  const cronSecretConfigured = Boolean(process.env.OPS_CRON_SECRET);
  const nextAuthSecretConfigured = Boolean(process.env.NEXTAUTH_SECRET);
  const alertRouting = getOpsAlertRoutingConfig();
  const alertDeliveryStatus = await getOpsAlertDeliveryStatus();
  const activeAdminCount = await prisma.user.count({
    where: {
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });
  const adminsWithoutMfa = await prisma.user.count({
    where: {
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      mfaEnabled: false,
    },
  });
  const ok = databaseOk;

  return {
    ok,
    timestamp: new Date().toISOString(),
    latencyMs: Date.now() - startedAt,
    services: {
      database: {
        ok: databaseOk,
        error: databaseError,
      },
      stripe: {
        configured: stripeConfigured,
      },
      reconciliationCron: {
        configured: cronSecretConfigured,
      },
      auth: {
        nextAuthSecretConfigured,
      },
      adminAccounts: {
        activeCount: activeAdminCount,
      },
      adminMfa: {
        adminsWithoutMfa,
      },
      alertRouting: {
        configured: alertRouting.configured,
        lastAttemptAt: alertDeliveryStatus?.lastAttemptAt ?? null,
        lastSuccessAt: alertDeliveryStatus?.lastSuccessAt ?? null,
        lastFailureAt: alertDeliveryStatus?.lastFailureAt ?? null,
        lastError: alertDeliveryStatus?.lastError ?? null,
      },
    },
  };
}
