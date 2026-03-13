# Dibble Launch Plan (4 Weeks)

This plan converts the current MVP into a production-ready launch candidate.

## Working Assumptions

- Team: 1 full-stack engineer, 1 product owner, 1 part-time QA (or QA rotation).
- Cadence: weekly release candidate cut, daily smoke checks.
- Goal: stable launch with payments, orders, disputes, and notifications operating reliably.

## Roles

- `ENG`: implementation, migrations, automation, observability.
- `OPS`: deployment, secrets, backup/restore, incident readiness.
- `QA`: regression, exploratory testing, release sign-off.
- `PO`: policy/legal content, launch criteria, communication.

## Week 1: Production Hardening

### Deliverables

- Deploy latest migration to staging and production.
- Verify Stripe keys are configured in all environments.
- Add minimal API rate limits for high-risk endpoints.
- Add structured request logging for core flows.
- Run a full role-based smoke test (buyer/seller/admin).

### Key Tasks

1. `ENG`: add rate limit middleware for auth, uploads, checkout/payment endpoints.
2. `ENG`: ensure payment webhook idempotency on repeated Stripe events.
3. `OPS`: verify backup policy and perform one restore test in staging.
4. `QA`: execute core path suite:
   - register/login
   - seller product publish
   - buyer cart/checkout/payment
   - order status transitions
   - dispute creation/resolution
   - follow -> notification fanout

### Exit Criteria

- `npm run lint`, `npm run test`, `npm run build` all pass on release branch.
- Zero P0 issues open.
- Backup restore verified in <= 30 minutes.

## Week 2: Observability and Incident Readiness

### Deliverables

- Error monitoring enabled (server + client).
- Dashboard for API errors and latency on critical routes.
- Alert thresholds defined for payment/order failure rates.
- Incident runbook for payment failures and DB incident.

### Key Tasks

1. `ENG`: add error instrumentation around `/api/orders`, `/api/payments/*`, `/api/notifications`.
2. `OPS`: wire alerts to on-call channel (email/Slack equivalent).
3. `ENG/OPS`: add correlation IDs in logs for order/payment flows.
4. `PO`: define customer-facing incident comms template.
5. `ENG/QA`: run Stripe replay drill and confirm stale `PROCESSING` webhook auto-recovery.

### Exit Criteria

- Alerts trigger correctly in staging simulations.
- On-call drill completed with postmortem notes.

## Week 3: Trust, Safety, and Policy Completion

### Deliverables

- Abuse controls: stricter upload checks and endpoint throttling.
- Admin moderation SOP for disputes/reviews/accounts.
- Finalized legal content review for privacy/terms/refunds.
- Data lifecycle policy documented (retention + deletion).

### Key Tasks

1. `ENG`: enforce file size/type limits and sanitize upload filename handling.
2. `ENG`: add admin audit log views where actions are sensitive.
3. `PO`: legal/policy pass on `/terms`, `/privacy`, dispute/refund wording.
4. `QA`: policy and edge-case test pass (account deletion, role access, forbidden routes).

### Exit Criteria

- No unauthorized access gaps in route protection.
- Policy pages and operational procedures approved.

## Week 4: Launch Readiness and Cutover

### Deliverables

- Final regression and load sanity check.
- Release tag and rollback checkpoint.
- Launch day checklist completed.
- Post-launch monitoring window staffed.

### Key Tasks

1. `ENG`: run migration deploy and final release build from tagged commit.
2. `OPS`: execute pre-launch backup and verify rollback path from `docs/ROLLBACK.md`.
3. `QA`: complete final UAT sign-off against production-like env.
4. `PO`: approve launch go/no-go based on checklist.

### Exit Criteria

- Go-live checklist complete.
- Tag created and release notes published.
- First 48h monitoring plan assigned.

## Immediate Next Actions (Start Today)

1. Create release branch `release/launch-candidate-1`.
2. Run staging migration deploy:

```bash
npm run db:deploy
```

3. Verify env keys in staging/prod:

- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`

4. Execute baseline quality gate:

```bash
npm run lint
npm run test
npm run build
```

5. Start Week 1 smoke test using `docs/PRELAUNCH_CHECKLIST.md`.
6. Configure alerting policy from `docs/MONITORING.md`.
