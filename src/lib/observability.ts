import { randomUUID } from "node:crypto";

type LogLevel = "info" | "warn" | "error";

type LogFields = Record<string, unknown>;

export function getRequestId(request: Request) {
  return request.headers.get("x-request-id") ?? randomUUID();
}

export function logApiEvent(level: LogLevel, event: string, fields: LogFields = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...fields,
  };

  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.info(line);
}
