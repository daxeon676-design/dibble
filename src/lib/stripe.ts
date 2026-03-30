import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

function isUsableStripeSecretKey(value: string | undefined): value is string {
  if (!value) {
    return false;
  }

  const normalized = value.trim();
  if (!normalized.startsWith("sk_")) {
    return false;
  }

  // Reject placeholder values from sample env files.
  if (normalized.includes("change_me")) {
    return false;
  }

  return true;
}

export const stripe =
  isUsableStripeSecretKey(stripeSecretKey)
    ? new Stripe(stripeSecretKey)
    : null;

export async function getOrCreateStripeCustomer(input: {
  userId: string;
  email: string;
  name?: string | null;
}) {
  if (!stripe) {
    return null;
  }

  const existing = await stripe.customers.search({
    query: `email:'${input.email.replace(/'/g, "")}' AND metadata['userId']:'${input.userId}'`,
    limit: 1,
  }).catch(() => null);

  if (existing?.data?.[0]) {
    return existing.data[0];
  }

  return stripe.customers.create({
    email: input.email,
    name: input.name ?? undefined,
    metadata: { userId: input.userId },
  });
}
