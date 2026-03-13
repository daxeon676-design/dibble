# Dibble

Dibble is a marketplace where users sign up as buyers first, then optionally apply to become approved sellers. Admins review seller applications.

## Current implementation status

- Next.js 16 app scaffolded with TypeScript and App Router.
- Prisma schema implemented for users, seller applications, products, carts, orders, payments, and audit logs.
- Seed script added for a default admin account.
- Rollback and setup documentation added.

## Local setup

1. Install dependencies.

```bash
npm install
```

2. Start PostgreSQL.

```bash
docker compose up -d
```

3. Copy `.env.example` to `.env` and update secrets.

	For card payments in buyer orders, set both `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.

4. Generate Prisma client and create tables.

```bash
npm run db:generate
npm run db:migrate -- --name init
npm run db:seed
```

5. Start the app.

```bash
npm run dev
```

Notes:
- `npm run dev` uses Webpack for local stability.
- `npm run dev:turbo` runs Turbopack explicitly.
- If Turbopack panics, stop the server, remove `.next/dev`, and retry with `npm run dev`.

## Database scripts

- `npm run db:generate` - generate Prisma client.
- `npm run db:migrate -- --name <name>` - create/apply local migration.
- `npm run db:deploy` - apply existing migrations (staging/prod).
- `npm run db:seed` - seed default admin.
- `npm run db:studio` - inspect data in Prisma Studio.

## Testing

- `npm run test` - run unit tests for checkout grouping, payment finalization plan, and order status rules.

## Seller product media

- Sellers can add image URLs (one URL per line) when creating or editing products.

## Rollback notes

- Tag each release (for example `v0.1.0`).
- Take a DB backup before production migrations.
- Prefer forward-fix migrations over destructive down migrations in production.

See `docs/ROLLBACK.md` for the full runbook.

## Launch execution

- `docs/LAUNCH_PLAN.md` - 4-week production hardening and launch timeline.
- `docs/PRELAUNCH_CHECKLIST.md` - release candidate and go-live checklist.
- `docs/MONITORING.md` - operations dashboard, metrics endpoint, and alert thresholds.
