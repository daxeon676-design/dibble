import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Stripe from "stripe";

import { Role, WebhookEventStatus } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { finalizeOrderPayment } from "@/lib/payment-finalizer";
import { createOrdersFromPendingCheckout } from "@/app/api/checkout/confirm/route";

type SearchParams = {
  status?: WebhookEventStatus | "all";
};

export default async function AdminWebhooksPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/webhooks");
  }

  if (session.user.role !== Role.ADMIN) {
    redirect("/buyer");
  }

  const params = await searchParams;
  const statusFilter = params.status && params.status !== "all" ? params.status : null;

  async function retryWebhookAction(formData: FormData) {
    "use server";

    const currentSession = await getServerSession(authOptions);
    if (!currentSession?.user || currentSession.user.role !== Role.ADMIN) {
      return;
    }

    if (!stripe) {
      return;
    }

    const eventId = String(formData.get("eventId") ?? "").trim();
    if (!eventId) {
      return;
    }

    await prisma.stripeWebhookEvent.updateMany({
      where: { eventId },
      data: {
        status: WebhookEventStatus.PROCESSING,
        lastError: null,
        attemptCount: { increment: 1 },
      },
    });

    try {
      const event = await stripe.events.retrieve(eventId);

      if (event.type === "payment_intent.succeeded") {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const orderId = paymentIntent.metadata.orderId;
        const pendingCheckoutId = paymentIntent.metadata.pendingCheckoutId;

        if (orderId) {
          await finalizeOrderPayment(orderId, paymentIntent.id, "SUCCEEDED");
        } else if (pendingCheckoutId) {
          await createOrdersFromPendingCheckout(pendingCheckoutId, paymentIntent.id);
        }
      }

      if (event.type === "payment_intent.payment_failed") {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const orderId = paymentIntent.metadata.orderId;
        if (orderId) {
          await finalizeOrderPayment(orderId, paymentIntent.id, "FAILED");
        }
      }

      await prisma.stripeWebhookEvent.update({
        where: { eventId },
        data: {
          status: WebhookEventStatus.PROCESSED,
          processedAt: new Date(),
          lastError: null,
        },
      });
    } catch (error) {
      await prisma.stripeWebhookEvent.update({
        where: { eventId },
        data: {
          status: WebhookEventStatus.FAILED,
          lastError: error instanceof Error ? error.message.slice(0, 2000) : "Unknown error",
        },
      });
    }

    revalidatePath("/admin/webhooks");
  }

  const events = await prisma.stripeWebhookEvent.findMany({
    where: statusFilter ? { status: statusFilter } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-10 text-foreground">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Webhook Events</h1>
        <Link href="/admin" className="rounded-md border border-(--accent-terra)/40 px-3 py-2 text-sm">
          Back to Admin
        </Link>
      </div>

      <form className="mb-4 flex items-center gap-2 rounded-md border border-(--accent-terra)/30 bg-(--accent-beige)/30 p-3">
        <select name="status" defaultValue={statusFilter ?? "all"} className="rounded border border-(--accent-terra)/40 px-3 py-2 text-sm">
          <option value="all">All</option>
          <option value="PROCESSING">Processing</option>
          <option value="PROCESSED">Processed</option>
          <option value="FAILED">Failed</option>
        </select>
        <button type="submit" className="rounded-md bg-(--accent-terra) px-3 py-2 text-sm font-semibold text-(--accent-beige)">
          Filter
        </button>
        <Link href="/admin/webhooks" className="rounded-md border border-(--accent-terra)/40 px-3 py-2 text-sm">
          Reset
        </Link>
      </form>

      <div className="overflow-x-auto rounded-md border border-(--accent-terra)/30 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-(--accent-beige)/60">
            <tr>
              <th className="px-3 py-2">Event ID</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Attempts</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id} className="border-t border-(--accent-terra)/20">
                <td className="px-3 py-2 font-mono text-xs">{event.eventId}</td>
                <td className="px-3 py-2">{event.eventType}</td>
                <td className="px-3 py-2">{event.status}</td>
                <td className="px-3 py-2">{event.attemptCount}</td>
                <td className="px-3 py-2 whitespace-nowrap">{new Date(event.createdAt).toLocaleString("en-GB")}</td>
                <td className="px-3 py-2">
                  <form action={retryWebhookAction}>
                    <input type="hidden" name="eventId" value={event.eventId} />
                    <button type="submit" className="rounded border border-(--accent-terra)/40 px-2 py-1 text-xs hover:bg-(--accent-beige)/50">
                      Retry
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
