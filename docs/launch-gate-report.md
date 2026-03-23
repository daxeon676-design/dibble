# Launch Gate Report

Generated: 2026-03-19T21:12:02.364Z

## Summary

- Required checks passed: 6/6
- Optional checks passed: 0/1
- Launch gate status: PASS

## Optional Failures

- Prod Audit

## Details

### Lint

- Command: `npm run lint`
- Required: Yes
- Status: PASS

```text
> dibble@0.1.0 lint
> eslint
```

### Tests

- Command: `npm run test`
- Required: Yes
- Status: PASS

```text
> dibble@0.1.0 test
> vitest run


[1m[46m RUN [49m[22m [36mv3.2.4 [39m[90mC:/Users/daxeo/Projects/dibble[39m

 [32m✓[39m src/lib/rate-limit.test.ts [2m([22m[2m2 tests[22m[2m)[22m[32m 6[2mms[22m[39m
 [32m✓[39m src/lib/launch-readiness.test.ts [2m([22m[2m2 tests[22m[2m)[22m[32m 75[2mms[22m[39m
[90mstdout[2m | src/lib/ops-alert-dispatcher.test.ts[2m > [22m[2mdispatchOpsAlert[2m > [22m[2mposts to webhook when configured
[22m[39m{"timestamp":"2026-03-19T21:11:08.300Z","level":"info","event":"ops.alert.dispatch.sent","source":"admin_api","severity":"warn","title":"Test","httpStatus":200}

 [32m✓[39m src/lib/ops-alert-dispatcher.test.ts [2m([22m[2m2 tests[22m[2m)[22m[32m 147[2mms[22m[39m
 [32m✓[39m src/app/api/payments/webhook/route.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 249[2mms[22m[39m
 [32m✓[39m src/app/api/auth/mfa/setup/route.test.ts [2m([22m[2m8 tests[22m[2m)[22m[32m 256[2mms[22m[39m
 [32m✓[39m src/app/api/seller/payouts/route.test.ts [2m([22m[2m4 tests[22m[2m)[22m[33m 400[2mms[22m[39m
   [33m[2m✓[22m[39m seller payout profile validation[2m > [22mrejects bank transfer profiles without required bank details [33m 390[2mms[22m[39m
 [32m✓[39m src/lib/ops-alerts.test.ts [2m([22m[2m2 tests[22m[2m)[22m[32m 4[2mms[22m[39m
 [32m✓[39m src/lib/payment-finalizer.test.ts [2m([22m[2m2 tests[22m[2m)[22m[32m 4[2mms[22m[39m
 [32m✓[39m src/lib/auth-security.test.ts [2m([22m[2m2 tests[22m[2m)[22m[32m 4[2mms[22m[39m
 [32m✓[39m src/lib/order-status.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 4[2mms[22m[39m
 [32m✓[39m src/app/api/rbac-financial-routes.test.ts [2m([22m[2m6 tests[22m[2m)[22m[33m 819[2mms[22m[39m
   [33m[2m✓[22m[39m RBAC financial endpoints[2m > [22mblocks unauthenticated access to admin payouts list [33m 419[2mms[22m[39m
   [33m[2m✓[22m[39m RBAC financial endpoints[2m > [22mblocks unauthenticated access to seller payouts [33m 306[2mms[22m[39m
 [32m✓[39m src/lib/checkout.test.ts [2m([22m[2m2 tests[22m[2m)[22m[32m 4[2mms[22m[39m

[2m Test Files [22m [1m[32m12 passed[39m[22m[90m (12)[39m
[2m      Tests [22m [1m[32m40 passed[39m[22m[90m (40)[39m
[2m   Start at [22m 21:11:07
[2m   Duration [22m 1.59s[2m (transform 891ms, setup 0ms, collect 1.09s, tests 1.97s, environment 3ms, prepare 2.42s)[22m
```

### Build

- Command: `npm run build`
- Required: Yes
- Status: PASS

```text
> dibble@0.1.0 build
> prisma generate && next build


✔ Generated Prisma Client (7.5.0) to .\src\generated\prisma in 224ms

▲ Next.js 16.1.7 (Turbopack)
- Environments: .env.local, .env

  Creating an optimized production build ...
✓ Compiled successfully in 9.6s
  Running TypeScript ...
  Collecting page data using 7 workers ...
  Generating static pages using 7 workers (0/82) ...
  Generating static pages using 7 workers (20/82) 
  Generating static pages using 7 workers (40/82) 
  Generating static pages using 7 workers (61/82) 
✓ Generating static pages using 7 workers (82/82) in 650.4ms
  Finalizing page optimization ...

Route (app)
┌ ƒ /
├ ƒ /_not-found
├ ƒ /about
├ ƒ /admin
├ ƒ /admin/analytics
├ ƒ /admin/disputes
├ ƒ /admin/launch-config
├ ƒ /admin/legal-pages
├ ƒ /admin/mfa-setup
├ ƒ /admin/ops
├ ƒ /admin/orders
├ ƒ /admin/payout-profiles
├ ƒ /admin/payout-reconciliation
├ ƒ /admin/payouts
├ ƒ /admin/security
├ ƒ /admin/site-settings
├ ƒ /admin/users-support
├ ƒ /api/admin/launch-readiness
├ ƒ /api/admin/legal-pages
├ ƒ /api/admin/ops-alerts/test
├ ƒ /api/admin/ops-metrics
├ ƒ /api/admin/payouts
├ ƒ /api/admin/payouts/reconcile
├ ƒ /api/admin/reviews/[reviewId]
├ ƒ /api/admin/seller-applications/[id]/review
├ ƒ /api/admin/site-config
├ ƒ /api/admin/system-health
├ ƒ /api/admin/users/[userId]/status
├ ƒ /api/auth/[...nextauth]
├ ƒ /api/auth/change-password
├ ƒ /api/auth/delete-account
├ ƒ /api/auth/mfa/setup
├ ƒ /api/auth/register
├ ƒ /api/buyer/addresses
├ ƒ /api/buyer/addresses/[id]
├ ƒ /api/cart
├ ƒ /api/cart/items
├ ƒ /api/cart/items/[itemId]
├ ƒ /api/delivery/options
├ ƒ /api/disputes
├ ƒ /api/disputes/[id]
├ ƒ /api/health
├ ƒ /api/internal/ops/daily-reconciliation
├ ƒ /api/messages
├ ƒ /api/messages/[conversationId]
├ ƒ /api/notifications
├ ƒ /api/notifications/[id]
├ ƒ /api/orders
├ ƒ /api/orders/[id]/invoice
├ ƒ /api/orders/[id]/status
├ ƒ /api/payments/confirm
├ ƒ /api/payments/intent
├ ƒ /api/payments/webhook
├ ƒ /api/products
├ ƒ /api/products/[id]
├ ƒ /api/products/[id]/reviews
├ ƒ /api/profile
├ ƒ /api/seller-applications
├ ƒ /api/seller/delivery-options
├ ƒ /api/seller/follow/[sellerId]
├ ƒ /api/seller/payouts
├ ƒ /api/seller/shop-profile
├ ƒ /api/site-config
├ ƒ /api/uploads
├ ƒ /api/users/lookup
├ ƒ /buyer
├ ƒ /buyer/cart
├ ƒ /buyer/checkout
├ ƒ /buyer/disputes
├ ƒ /buyer/disputes/new
├ ƒ /buyer/marketplace
├ ƒ /buyer/messages
├ ƒ /buyer/messages/[conversationId]
├ ƒ /buyer/messages/new
├ ƒ /buyer/notifications
├ ƒ /buyer/orders
├ ƒ /buyer/profile
├ ƒ /buyer/saved-addresses
├ ƒ /buyer/seller-application
├ ƒ /cookies
├ ƒ /faq
├ ƒ /favourites
├ ƒ /login
├ ƒ /privacy
├ ƒ /products/[id]
├ ƒ /register
├ ƒ /seller
├ ƒ /seller/analytics
├ ƒ /seller/delivery-options
├ ƒ /seller/orders
├ ƒ /seller/products
├ ƒ /seller/products/new
├ ƒ /seller/settings
├ ƒ /settings
├ ƒ /shop/[sellerId]
├ ƒ /terms
└ ƒ /wishlist


ƒ Proxy (Middleware)

ƒ  (Dynamic)  server-rendered on demand
```

### Security Smoke

- Command: `npm run security:smoke`
- Required: Yes
- Status: PASS

```text
> dibble@0.1.0 security:smoke
> tsx scripts/security-smoke.ts

PASS: Header x-frame-options value
PASS: Header x-content-type-options value
PASS: Header referrer-policy value
PASS: Header permissions-policy format
PASS: Header cross-origin-opener-policy value
PASS: Header cross-origin-resource-policy value
PASS: Header x-dns-prefetch-control value
PASS: Header strict-transport-security exists
PASS: Login initially allowed
PASS: Login blocked after repeated failures
PASS: Security snapshot marks account blocked
PASS: Login re-allowed after clearing failures

Security smoke passed (12 checks).
```

### Launch Smoke

- Command: `npm run launch:smoke`
- Required: Yes
- Status: PASS

```text
> dibble@0.1.0 launch:smoke
> tsx scripts/launch-smoke.ts

PASS: DATABASE_URL is set
PASS: NEXTAUTH_SECRET is set
PASS: NEXTAUTH_URL is set
PASS: NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is set
PASS: STRIPE_WEBHOOK_SECRET is set
PASS: OPS_CRON_SECRET is set
PASS: STRIPE_SECRET_KEY is set
PASS: OPS_ALERT_WEBHOOK_URL is set
PASS: data/seller-payout-profiles.json exists
PASS: Weekly implementation plan exists
PASS: Launch readiness tracker exists

Smoke check passed.
```

### Launch Smoke Strict

- Command: `npm run launch:smoke:strict`
- Required: Yes
- Status: PASS

```text
> dibble@0.1.0 launch:smoke:strict
> tsx scripts/launch-smoke.ts --strict

PASS: DATABASE_URL is set
PASS: NEXTAUTH_SECRET is set
PASS: NEXTAUTH_URL is set
PASS: NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is set
PASS: STRIPE_WEBHOOK_SECRET is set
PASS: OPS_CRON_SECRET is set
PASS: STRIPE_SECRET_KEY is set
PASS: OPS_ALERT_WEBHOOK_URL is set
PASS: data/seller-payout-profiles.json exists
PASS: Weekly implementation plan exists
PASS: Launch readiness tracker exists

Smoke check passed.
```

### Prod Audit

- Command: `npm audit --omit=dev`
- Required: No
- Status: FAIL

```text
# npm audit report

lodash  4.0.0 - 4.17.21
Severity: moderate
Lodash has Prototype Pollution Vulnerability in `_.unset` and `_.omit` functions - https://github.com/advisories/GHSA-xxjr-mmjv-4gpg
fix available via `npm audit fix --force`
Will install prisma@6.19.2, which is a breaking change
node_modules/lodash
  @chevrotain/cst-dts-gen  10.0.0 - 10.5.0
  Depends on vulnerable versions of @chevrotain/gast
  Depends on vulnerable versions of lodash
  node_modules/@chevrotain/cst-dts-gen
  @chevrotain/gast  <=10.5.0
  Depends on vulnerable versions of lodash
  node_modules/@chevrotain/gast
  chevrotain  10.0.0 - 10.5.0
  Depends on vulnerable versions of @chevrotain/cst-dts-gen
  Depends on vulnerable versions of @chevrotain/gast
  Depends on vulnerable versions of lodash
  node_modules/chevrotain
    @mrleebo/prisma-ast  0.4.2 - 0.13.1
    Depends on vulnerable versions of chevrotain
    node_modules/@mrleebo/prisma-ast
      @prisma/dev  0.11.1 - 0.22.0
      Depends on vulnerable versions of @mrleebo/prisma-ast
      node_modules/@prisma/dev
        prisma  >=6.20.0-dev.1
        Depends on vulnerable versions of @prisma/dev
        node_modules/prisma

7 moderate severity vulnerabilities

To address issues that do not require attention, run:
  npm audit fix

To address all issues (including breaking changes), run:
  npm audit fix --force
```

