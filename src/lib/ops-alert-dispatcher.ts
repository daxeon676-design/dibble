import { logApiEvent } from "@/lib/observability";
import { saveOpsAlertDeliveryStatus } from "@/lib/ops-alert-delivery-store";

export type DispatchOpsAlertInput = {
  source: "cron" | "admin_api" | "manual";
  severity: "warn" | "critical";
  title: string;
  message: string;
  context?: Record<string, unknown>;
};

function getWebhookDestination() {
  const webhookUrl = process.env.OPS_ALERT_WEBHOOK_URL?.trim() ?? "";
  const bearerToken = process.env.OPS_ALERT_WEBHOOK_BEARER_TOKEN?.trim() ?? "";
  return {
    webhookUrl,
    bearerToken,
    configured: webhookUrl.length > 0,
  };
}

export function getOpsAlertRoutingConfig() {
  return getWebhookDestination();
}

export async function dispatchOpsAlert(input: DispatchOpsAlertInput) {
  const destination = getWebhookDestination();
  const attemptedAt = new Date().toISOString();

  if (!destination.configured) {
    await saveOpsAlertDeliveryStatus({
      lastAttemptAt: attemptedAt,
      lastSuccessAt: null,
      lastFailureAt: attemptedAt,
      lastError: "OPS_ALERT_WEBHOOK_URL is not configured",
      lastHttpStatus: null,
      destinationConfigured: false,
    });

    logApiEvent("warn", "ops.alert.dispatch.skipped", {
      reason: "missing_destination",
      source: input.source,
      severity: input.severity,
      title: input.title,
    });

    return { delivered: false, reason: "missing_destination" as const };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "dibble-ops-alert-dispatcher/1.0",
  };

  if (destination.bearerToken) {
    headers.Authorization = `Bearer ${destination.bearerToken}`;
  }

  try {
    const response = await fetch(destination.webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        timestamp: attemptedAt,
        source: input.source,
        severity: input.severity,
        title: input.title,
        message: input.message,
        context: input.context ?? {},
      }),
    });

    if (!response.ok) {
      const errorText = `Webhook returned HTTP ${response.status}`;
      await saveOpsAlertDeliveryStatus({
        lastAttemptAt: attemptedAt,
        lastSuccessAt: null,
        lastFailureAt: attemptedAt,
        lastError: errorText,
        lastHttpStatus: response.status,
        destinationConfigured: true,
      });

      logApiEvent("warn", "ops.alert.dispatch.failed", {
        source: input.source,
        severity: input.severity,
        httpStatus: response.status,
        title: input.title,
      });

      return { delivered: false, reason: "http_error" as const, httpStatus: response.status };
    }

    await saveOpsAlertDeliveryStatus({
      lastAttemptAt: attemptedAt,
      lastSuccessAt: attemptedAt,
      lastFailureAt: null,
      lastError: null,
      lastHttpStatus: response.status,
      destinationConfigured: true,
    });

    logApiEvent("info", "ops.alert.dispatch.sent", {
      source: input.source,
      severity: input.severity,
      title: input.title,
      httpStatus: response.status,
    });

    return { delivered: true, httpStatus: response.status };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown webhook dispatch error";

    await saveOpsAlertDeliveryStatus({
      lastAttemptAt: attemptedAt,
      lastSuccessAt: null,
      lastFailureAt: attemptedAt,
      lastError: message,
      lastHttpStatus: null,
      destinationConfigured: true,
    });

    logApiEvent("error", "ops.alert.dispatch.error", {
      source: input.source,
      severity: input.severity,
      title: input.title,
      error: message,
    });

    return { delivered: false, reason: "network_error" as const, error: message };
  }
}
