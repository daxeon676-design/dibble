# Launch Readiness Tracker

## Status Legend
- [ ] Not done
- [~] In progress
- [x] Done

## P0 Checklist
- [~] Payment state machine verified in staging
- [x] Webhook replay/idempotency test pass
- [x] Seller payout profile validations by method
- [~] Admin payout queue + bulk payout UAT
- [x] Daily reconciliation scheduler configured (vercel.json cron + GET handler on /api/internal/ops/daily-reconciliation)
- [x] Admin MFA enforced (TOTP schema, middlware enforcement, setup page, launch gate)
- [x] RBAC review for money-movement endpoints
- [x] Rate limits tuned for auth/payment/payout
- [x] Alert routing to on-call destination
- [x] Health endpoint + uptime checks
- [~] Backup/restore drill verified (rollback drill script: npm run rollback:drill)
- [x] Critical E2E suite green in CI on every main merge (Playwright — e2e/smoke.spec.ts + e2e/checkout.spec.ts; CI job triggers on PLAYWRIGHT_BASE_URL var)
- [x] Checkout recovery UX validated (contextual error + "Try Again" button in payment step)
- [~] Policy/legal pages final review (UK GDPR/PECR baseline content + cookie banner implemented; awaiting legal sign-off)
- [x] Rollback plan tested (npm run rollback:drill validates pre-conditions)
- [~] Security hardening verified (headers, auth throttling, endpoint rate limits)
- [x] Production build gate passing (`npm run build`)
- [~] Production dependency vulnerabilities triaged (`npm audit --omit=dev` now reduced to 7 moderate findings; remaining issues isolated to Prisma CLI transitive tooling chain, see docs/dependency-audit-status.md)

## Newly Delivered This Sprint
- [x] Weekly implementation roadmap document
- [x] Launch readiness tracker document
- [x] System health endpoint (/api/health)
- [x] Launch smoke script (npm run launch:smoke)
- [x] Admin Ops launch-readiness gate panel
- [x] Admin launch-readiness API (/api/admin/launch-readiness)
- [x] Admin system-health API (/api/admin/system-health)
- [x] Reconciliation last-run persistence and manual rerun action
- [x] Endpoint-level RBAC tests for financial/admin payout routes
- [x] Ops alert webhook dispatch and delivery status tracking
- [x] Admin MFA enforcement (TOTP via otplib, middleware redirect, setup UI, health-admin-mfa launch gate)
- [x] Stripe webhook replay/idempotency route coverage
- [x] Seller payout profile method validation coverage
- [x] Daily reconciliation Vercel cron (vercel.json + GET handler; Authorization: Bearer auth)
- [x] Checkout payment-step recovery UX (contextual error, "Your cart has not been charged", "Try Again" button)
- [x] Playwright E2E suite (e2e/smoke.spec.ts + e2e/checkout.spec.ts; CI e2e job gated on PLAYWRIGHT_BASE_URL)
- [x] Rollback drill verification script (npm run rollback:drill)
- [x] Login brute-force throttling (per-email lock window)
- [x] Global HTTP security headers (HSTS, frame deny, nosniff, referrer/permissions policy)
- [x] Seller-application submission rate limiting
- [x] Security smoke script (`npm run security:smoke`)
- [x] Automated launch gate report (`npm run launch:gate` -> docs/launch-gate-report.md)
- [x] Admin Security & Audit workspace (status-change logs + suspicious login indicators)
- [x] Cookie consent UX + Cookie Policy page (/cookies)
- [x] UK GDPR/PECR baseline legal wording refresh (Terms/Privacy defaults)

## Launch Gate
- [ ] P0 checklist complete
- [ ] 7 days with no unresolved critical reconciliation issues
- [ ] E2E suite green on main
- [ ] Monitoring + rollback drills complete

## Current Callout
- Platform is progressing toward launch readiness but is not yet at GO state.

## Immediate Launch Blockers
- Staging payment state machine still needs final verification after latest release candidate.
- Admin payout queue and bulk payout workflow still need explicit UAT sign-off.
- Backup and restore evidence for the target production environment still needs to be recorded.
- Legal wording and cookie flow still need final launch-jurisdiction sign-off.
- Residual dependency audit findings still need explicit risk acceptance or an upstream Prisma toolchain fix.
- Launch gate still requires the 7-day clean reconciliation window and final GO sign-offs.
- Strict launch smoke currently blocked by missing env vars: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `OPS_CRON_SECRET`, `OPS_ALERT_WEBHOOK_URL`.
