# Dibble Setup

## 1. Install dependencies

```bash
npm install
```

## 2. Start PostgreSQL (choose one option)

### Option A: Docker (if available)

```bash
docker compose up -d
```

### Option B: Local PostgreSQL install (no Docker)

1. Install PostgreSQL Community Edition from `https://www.postgresql.org/download/windows/`.
2. During setup, keep note of your password for user `postgres`.
3. Create a database named `dibble` (using pgAdmin or psql).
4. Set `DATABASE_URL` in `.env`:

```bash
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/dibble?schema=public"
```

### Option C: Free cloud PostgreSQL (no local DB)

Use Neon/Supabase/Render Postgres and paste the provided connection string into `.env` as `DATABASE_URL`.

## 3. Configure environment

Copy `.env.example` to `.env` and set values.

Required defaults:

- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/dibble?schema=public`
- `NEXTAUTH_URL=http://localhost:3000`
- `NEXTAUTH_SECRET=...`
- `ADMIN_EMAIL=admin@dibble.local`
- `ADMIN_SEED_PASSWORD=...`
- `STRIPE_SECRET_KEY=sk_test_...`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...`
- `STRIPE_WEBHOOK_SECRET=whsec_...`

## 4. Generate Prisma client and create tables

```bash
npm run db:generate
npm run db:migrate -- --name init
npm run db:seed
```

## 5. Start app

```bash
npm run dev
```

## Helpful commands

```bash
npm run db:studio
npm run db:deploy
npm run test
```

## Seller images

For now, product images are URL-based (one URL per line in seller product create/edit forms).

## Payments in this MVP slice

1. Buyer checkout creates orders in `PENDING_PAYMENT` with payment records.
2. If `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is set, buyer orders show a card form powered by Stripe Elements.
3. For local testing without Stripe setup, buyer can use `Pay Now (Test)` which calls simulated confirmation.
4. If Stripe is configured, use:
	- `POST /api/payments/intent` to create/retrieve PaymentIntent.
	- `POST /api/payments/confirm` to mark successful payment.
	- `POST /api/payments/webhook` for Stripe webhook events.
