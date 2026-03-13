# Dibble Monitoring Guide

This guide describes how to monitor reliability after launch using built-in metrics and structured logs.

## Admin Operations Views

- UI dashboard: `/admin/ops`
- JSON metrics endpoint: `/api/admin/ops-metrics?hours=24`

Both endpoints are admin-only.

## Metrics Provided

`/api/admin/ops-metrics` returns:

- `webhooks.total`
- `webhooks.processed`
- `webhooks.failed`
- `webhooks.processing`
- `webhooks.staleProcessing`
- `webhooks.retrying`
- `payments.failed`
- `payments.succeeded`
- `payments.failureRate`
- `orders.pendingPayment`
- `orders.stalePendingPayment`
- `recentWebhookFailures[]`

## Suggested Alert Thresholds

Start with these thresholds and tune after 1-2 weeks of production traffic.

1. Webhook failure spike
- Condition: `webhooks.failed >= 5` over `1h`
- Severity: high (page on-call)

2. Webhook stuck processing
- Condition: `webhooks.staleProcessing > 0`
- Severity: high (page on-call)

3. Payment failure anomaly
- Condition: `payments.failed / max(payments.succeeded, 1) > 0.25` over `1h`
- Severity: medium

4. Stale pending order backlog
- Condition: `orders.stalePendingPayment >= 10`
- Severity: medium

5. Payment failure rate anomaly
- Condition: `payments.failureRate > 0.25` over `1h`
- Severity: medium

## Paging Policy

- `high`: page immediately, acknowledge within 5 minutes, begin mitigation within 15 minutes.
- `medium`: alert in on-call channel, triage within 30 minutes.

## Verification Queries

Use these read-only checks against production DB when debugging webhook incidents.

```sql
-- Recent failed webhook events.
SELECT event_id, event_type, status, attempt_count, updated_at, left(last_error, 240) AS last_error
FROM stripe_webhook_events
WHERE status = 'FAILED'
ORDER BY updated_at DESC
LIMIT 20;

-- Events currently stuck in PROCESSING for more than 10 minutes.
SELECT event_id, event_type, status, attempt_count, updated_at
FROM stripe_webhook_events
WHERE status = 'PROCESSING'
	AND updated_at < now() - interval '10 minutes'
ORDER BY updated_at ASC;
```

## Structured Log Events

The app emits JSON logs for core flows. Filter by `event`.

Payment intent:
- `payments.intent.created`
- `payments.intent.reused`
- `payments.intent.invalid_payload`
- `payments.intent.rate_limited`

Payment confirm:
- `payments.confirm.success`
- `payments.confirm.intent_not_succeeded`
- `payments.confirm.finalize_failed`
- `payments.confirm.rate_limited`

Webhook processing:
- `payments.webhook.processed`
- `payments.webhook.duplicate`
- `payments.webhook.recovered_stale_processing`
- `payments.webhook.processing_failed`

Order create:
- `orders.create.success`
- `orders.create.invalid_payload`
- `orders.create.empty_cart`
- `orders.create.delivery_not_offered`

## On-Call Quick Checks

1. Open `/admin/ops` and confirm webhook failures are not increasing.
2. Check `recentWebhookFailures` for repeated event types.
3. Confirm payment success count is moving and failure ratio is normal.
4. If stale pending orders rise, inspect Stripe webhook delivery and worker logs.

## Incident Runbook: Stripe Webhook Failures

1. Identify failing events from `/admin/ops` (Recent Webhook Failures) and capture `eventId` / `eventType`.
2. Confirm Stripe delivered the event successfully in Stripe dashboard event logs.
3. Search app logs by event id and check latest errors:

- `payments.webhook.processing_failed`
- `payments.webhook.recovered_stale_processing`

4. Apply fix (if code/data issue), then replay webhook event from Stripe dashboard.
5. Verify outcome:

- event row status becomes `PROCESSED`
- payment/order state is correct
- `webhooks.failed` stops increasing

6. If replay still fails, escalate and execute rollback plan (`docs/ROLLBACK.md`).

## Incident Runbook: Stale PROCESSING Recovery

The webhook handler auto-recovers stale `PROCESSING` rows older than 10 minutes when Stripe retries the same event.

1. Confirm stale rows in `/admin/ops` (`Stale Webhook Processing`) and via query above.
2. In Stripe dashboard, replay each affected event id (or trigger retry for failed deliveries).
3. Verify logs include `payments.webhook.recovered_stale_processing` and then `payments.webhook.processed`.
4. Re-check `/admin/ops` until `webhooks.staleProcessing` returns to `0`.
5. If stale count does not drain after replay, escalate to engineering and rollback if customer impact persists.

## Runbook Links

- Rollback: `docs/ROLLBACK.md`
- Launch execution: `docs/LAUNCH_PLAN.md`
- Prelaunch checklist: `docs/PRELAUNCH_CHECKLIST.md`
