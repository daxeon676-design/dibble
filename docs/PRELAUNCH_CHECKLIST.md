# Dibble Pre-Launch Checklist

Use this as the execution checklist for each release candidate and final launch.

## 1. Environment and Secrets

- [ ] `DATABASE_URL` is set and points to correct environment DB.
- [ ] `NEXTAUTH_URL` matches environment domain.
- [ ] `NEXTAUTH_SECRET` is set and rotated per environment policy.
- [ ] `STRIPE_SECRET_KEY` is present and valid.
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is present and valid.
- [ ] `STRIPE_WEBHOOK_SECRET` is present and webhook configured.

## 2. Database and Data Safety

- [ ] Full DB backup/snapshot taken before deploy.
- [ ] `npm run db:deploy` applied cleanly.
- [ ] Critical tables sanity-checked after migration.
- [ ] Restore drill completed recently (or completed this cycle).

## 3. Quality Gates

- [ ] `npm run lint` passes.
- [ ] `npm run test` passes.
- [ ] `npm run build` passes.
- [ ] No unresolved P0/P1 defects for launch scope.

## 4. Functional Smoke Tests

### Authentication and Roles

- [ ] Buyer can register and login.
- [ ] Seller can login and access seller routes.
- [ ] Admin can login and access admin routes.
- [ ] Unauthorized access is blocked and redirected correctly.

### Marketplace and Orders

- [ ] Seller can create, edit, delist, and relist product.
- [ ] Buyer can browse marketplace and product details.
- [ ] Buyer can add/update/remove cart items.
- [ ] Buyer can complete checkout and create order.
- [ ] Successful payment moves order to `PROCESSING`.
- [ ] Seller/admin can progress status with valid transitions only.
- [ ] Payout UAT sign-off completed (`docs/payout-uat-signoff.md`).

### Messaging, Disputes, Notifications

- [ ] Buyer can message seller and see unread behavior.
- [ ] Buyer can raise dispute; admin can review/update status.
- [ ] Buyer can follow shop.
- [ ] Seller publishing new product creates follower notifications.
- [ ] Notifications page loads and mark-read actions work.

## 5. Observability and Operations

- [ ] Error logging enabled and visible.
- [ ] Alerting enabled for payment/order failures.
- [ ] Alert configured for `webhooks.staleProcessing > 0`.
- [ ] Paging policy documented (`high` <= 5 min ack, `medium` <= 30 min triage).
- [ ] On-call contact is assigned for launch window.
- [ ] Incident runbook links shared with team.
- [ ] Stripe webhook replay drill completed (staging) and verified idempotent behavior.
- [ ] Stale `PROCESSING` recovery drill completed (staging) and verified metric returns to `0`.
- [ ] SQL verification queries from `docs/MONITORING.md` tested by on-call.
- [ ] Launch-day owner checklist completed (`docs/launch-day-owner-checklist.md`).

## 5b. Security Hardening

- [ ] HTTP security headers validated in production responses (HSTS, frame deny, nosniff, referrer policy, permissions policy).
- [ ] Login brute-force protection tested (repeat invalid logins are throttled/blocked).
- [ ] Sensitive admin/seller endpoints are rate limited and return `429` with `Retry-After` when exceeded.
- [ ] Dependency audit completed (`npm audit`) and critical vulnerabilities remediated or accepted with documented risk.
- [ ] Security logging path validated for suspicious auth activity and admin actions.
- [ ] Admin account MFA verified and recovery procedure documented.
- [ ] Production cookies and auth settings verified over HTTPS only.

## 6. Legal and Policy

- [ ] Terms and Privacy content reviewed for launch jurisdiction.
- [ ] Cookie consent flow reviewed for PECR/UK GDPR and validated in production.
- [ ] Refund/dispute process wording finalized.
- [ ] Support contact details are correct in UI/footer.

## 7. Release and Rollback

- [ ] Release tag created from deployed commit.
- [ ] Rollback steps validated against `docs/ROLLBACK.md`.
- [ ] Release notes include DB migration and risk notes.

## 8. Go/No-Go

- [ ] PO sign-off.
- [ ] QA sign-off.
- [ ] ENG sign-off.
- [ ] OPS sign-off.

Launch decision:

- [ ] GO
- [ ] NO-GO
