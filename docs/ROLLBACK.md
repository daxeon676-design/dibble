# Dibble Rollback Runbook

## Release discipline

1. Merge via PR only.
2. Tag each successful production deploy (example: `v0.1.0`).
3. Keep schema changes in Prisma migrations only.

## Before deploy

1. Take a full database backup or cloud snapshot.
2. Run migrations in staging first.
3. Verify smoke tests against staging.

## App rollback

1. Redeploy previous stable Git tag.
2. Validate health endpoint and login flow.
3. Confirm checkout/order creation still functions.

## Database rollback strategy

1. Do not run destructive down migrations directly in production.
2. Preferred: ship a forward-fix migration that restores compatibility.
3. Emergency only: restore pre-release DB backup, then redeploy matching app tag.

## Rollback drill cadence

1. Run a staged rollback drill at least once per release cycle.
2. Record restore time and issues in release notes.
