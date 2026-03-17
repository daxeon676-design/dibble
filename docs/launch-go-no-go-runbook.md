# Dibble Launch Go/No-Go Runbook

Use this runbook for the final production release decision and the first launch window.

Related artifacts:

- `docs/payout-uat-signoff.md`
- `docs/launch-day-owner-checklist.md`

## 1. Required Attendees

- Product owner
- Engineering owner
- QA owner
- Operations / on-call owner
- Finance / payout owner if payouts are in launch scope

## 2. Evidence To Bring To The Meeting

- Latest `npm run lint` output
- Latest `npm run test` output
- Latest `npm run build` output
- Latest `npm run security:smoke` output
- Latest `npm run launch:smoke:strict` output
- Latest `npm run launch:gate` report (`docs/launch-gate-report.md`)
- Admin Ops screenshots or JSON showing:
  - Launch readiness status
  - Reconciliation issue count
  - Alert routing configured
  - Admin MFA fully enabled
- Staging verification notes for:
  - Buyer registration/login
  - Checkout success path
  - Checkout failure/retry path
  - Seller product management
  - Admin payout queue and dispute handling
- Completed payout UAT sign-off (`docs/payout-uat-signoff.md`)
- Launch-day owner assignments (`docs/launch-day-owner-checklist.md`)
- Backup/snapshot confirmation for the target database
- Rollback owner and rollback tag

## 3. Hard Go Criteria

All of the following must be true before pressing GO.

- `npm run lint` passes.
- `npm run test` passes.
- `npm run build` passes.
- `npm run security:smoke` passes.
- `npm run launch:smoke:strict` passes.
- Production secrets are configured.
- Stripe webhook and reconciliation cron are configured.
- No unresolved critical reconciliation issues exist.
- Admin MFA is enabled for every active admin.
- Legal pages and cookie flow have been signed off.
- Backup/snapshot has been taken for the launch window.
- Rollback tag and rollback owner are confirmed.
- Product, QA, Engineering, and Ops sign off.

## 4. Automatic No-Go Conditions

Do not launch if any of the following is true.

- Checkout flow is not verified in staging after the last deploy candidate.
- Admin payout queue or payout reconciliation behavior is still untested.
- Audit findings include unresolved critical runtime vulnerabilities.
- Alert routing is not configured or has recent failed deliveries without explanation.
- Backup/restore path is unverified for the target environment.
- On-call ownership is unclear for the launch window.
- Legal wording is still awaiting decision for the launch jurisdiction.

## 5. Launch Sequence

1. Confirm the production deployment commit SHA and release tag candidate.
2. Take the production database backup or managed snapshot.
3. Run `npm run db:deploy` against production.
4. Deploy the tagged release.
5. Validate `/api/health` and admin system-health.
6. Run the live smoke checks for login, marketplace, checkout, and admin access.
7. Confirm Stripe webhook deliveries and reconciliation cron auth.
8. Watch logs, alerts, disputes, and webhook failures for the first hour.

## 6. First-Hour Monitoring

Check every 10-15 minutes during the first hour.

- Health endpoint status
- New failed webhook events
- Stale processing orders
- Pending payout growth
- Suspicious auth activity spikes
- Support inbox / disputes volume
- Error logs for auth, payments, and orders

## 7. Rollback Triggers

Rollback immediately if any of the following occurs and cannot be mitigated quickly.

- Buyers cannot complete checkout.
- Orders are created with incorrect payment status.
- Webhooks are failing persistently.
- Reconciliation shows critical payout inconsistencies.
- Admin access is blocked for legitimate admins.
- Production errors are growing and affecting core journeys.

## 8. Rollback Steps

1. Pause traffic or risky operational actions if needed.
2. Redeploy the previous stable release tag.
3. Verify `/api/health`, login, marketplace, and checkout.
4. If schema-related breakage exists, prefer a forward fix unless a database restore is required.
5. If restore is required, restore the pre-launch snapshot and redeploy the matching app version.
6. Record timeline, impact, and next action in the incident log.

## 9. Launch Decision Record

- Decision: GO / NO-GO
- Release tag:
- Commit SHA:
- Date/time:
- Product sign-off:
- QA sign-off:
- Engineering sign-off:
- Ops sign-off:
- Notes:
