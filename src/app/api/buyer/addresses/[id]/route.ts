import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateAddressSchema = z.object({
  fullName: z.string().min(1).optional(),
  addressLine1: z.string().min(1).optional(),
  addressLine2: z.string().optional(),
  city: z.string().min(1).optional(),
  postalCode: z.string().min(1).optional(),
  country: z.string().min(1).optional(),
  isDefault: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const address = await prisma.savedAddress.findUnique({
    where: { id },
  });

  if (!address || address.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const json = await request.json().catch(() => null);
  const parsed = updateAddressSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid address data" },
      { status: 400 }
    );
  }

  // If setting as default, unset other defaults
  if (parsed.data.isDefault) {
    await prisma.savedAddress.updateMany({
      where: { userId: session.user.id, isDefault: true, id: { not: id } },
      data: { isDefault: false },
    });
  }

  const updated = await prisma.savedAddress.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json({ address: updated });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const address = await prisma.savedAddress.findUnique({
    where: { id },
  });

  if (!address || address.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.savedAddress.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}
