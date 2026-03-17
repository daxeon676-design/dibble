# Launch-Day Owner Checklist

Use this during the live launch window.

## Owner Matrix

- Product owner:
- QA owner:
- Engineering owner:
- Ops/on-call owner:
- Finance/payout owner:

## Pre-Deploy (T-60 to T-15)

- [ ] Product: final release approval confirmed.
- [ ] QA: latest regression and smoke evidence attached.
- [ ] Engineering: release tag and deploy SHA confirmed.
- [ ] Ops: backup/snapshot completed and verified.
- [ ] Ops: monitoring dashboards and alert channels open.
- [ ] Engineering: strict launch smoke checks passed.

## Deploy Window (T-15 to T+15)

- [ ] Engineering: apply DB migrations.
- [ ] Engineering: deploy release tag.
- [ ] Ops: verify health endpoint and system health.
- [ ] QA: run critical buyer login and checkout smoke.
- [ ] QA: run admin access and payout queue smoke.

## Stabilization (T+15 to T+60)

- [ ] Ops: review webhooks, stale processing, and payout metrics.
- [ ] Engineering: review error logs for auth/orders/payments.
- [ ] QA: verify dispute and notifications pages.
- [ ] Finance/Ops: confirm payout behavior matches expected mode.
- [ ] Product: confirm customer-facing journeys are acceptable.

## Rollback Guardrails

Trigger rollback if any of the following is true:

- [ ] Checkout is failing for valid buyers.
- [ ] Payment states are inconsistent.
- [ ] Webhook failures are persistent and growing.
- [ ] Reconciliation reports critical payout inconsistencies.
- [ ] Admin access is broken for valid admins.

## Final Decision

- Decision time:
- Final state: GO / NO-GO
- Product sign-off:
- QA sign-off:
- Engineering sign-off:
- Ops sign-off:
- Notes:
