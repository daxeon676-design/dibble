import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { notifyDisputeRefund } from "@/lib/dispute-notifications";
import { refundDisputeOrderPayment } from "@/lib/dispute-refunds";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  note: z.string().trim().max(2000).optional(),
});

export async function POST(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const result = await refundDisputeOrderPayment({
      disputeId: id,
      adminId: session.user.id,
      note: parsed.data.note,
    });

    await notifyDisputeRefund({
      orderId: result.dispute.order.id,
      amountCents: result.amountCents,
      buyer: result.dispute.order.buyer,
      seller: result.dispute.order.seller,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Refund failed." },
      { status: 400 },
    );
  }
}