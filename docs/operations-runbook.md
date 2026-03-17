# Operations Runbook

## Daily Checks
- Open Admin Ops dashboard and verify:
  - System health is Healthy
  - Launch readiness has no failed required checks
  - Reconciliation issues are zero or triaged
  - No unresolved critical operational alerts
  - Alert routing destination is configured and recent sends are successful
- Run non-strict smoke check locally:
  - npm run launch:smoke

## Pre-Launch Checklist
- Run strict smoke check:
  - npm run launch:smoke:strict
- Confirm required env vars are configured (see docs/launch-env-checklist.md)
- Confirm reconciliation scheduler is active:
  - POST /api/internal/ops/daily-reconciliation with x-ops-secret header
- Confirm rollback owner and on-call contact are assigned

## Payout Reconciliation Incident Handling
1. Open Admin Payout Reconciliation report.
2. Identify issue types and affected orders.
3. For TRANSFER_NOT_FOUND or TRANSFER_AMOUNT_MISMATCH:
   - verify Stripe transfer manually in dashboard
   - verify ledger entry and payment status
4. For PENDING_BUT_PAYMENT_SUCCEEDED:
   - process payout from admin queue
5. For PAID_OUT_BUT_PAYMENT_NOT_SUCCEEDED:
   - escalate to finance and freeze further payout for seller until resolved
6. Record outcome in admin notes and incident log.

## Webhook Failure Handling
1. Check recent webhook failures on Ops dashboard.
2. Confirm Stripe endpoint health and signing secret.
3. Replay failed event where safe.
4. Verify order/payment state after replay.
5. Close incident when no failed events remain in active window.

## Emergency Rollback
- Disable risky feature flag path if applicable.
- Revert to last known good deployment.
- Run smoke checks and core checkout flow.
- Announce incident status and ETA to stakeholders.
