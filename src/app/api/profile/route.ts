import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  displayName: z.string().max(80).optional(),
  bio: z.string().max(500).optional(),
  phoneNumber: z.string().max(20).optional(),
  avatarUrl: z.string().url().max(500).optional().or(z.string().startsWith("/uploads/")).or(z.literal("")),
  addressLine1: z.string().max(100).optional(),
  addressLine2: z.string().max(100).optional(),
  city: z.string().max(80).optional(),
  county: z.string().max(80).optional(),
  postcode: z.string().max(20).optional(),
  country: z.string().max(80).optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true, email: true, displayName: true, bio: true, phoneNumber: true, avatarUrl: true, role: true,
      addressLine1: true, addressLine2: true, city: true, county: true, postcode: true, country: true,
    },
  });
  return NextResponse.json(user);
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { displayName, bio, phoneNumber, avatarUrl, addressLine1, addressLine2, city, county, postcode, country } = parsed.data;

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      ...(displayName !== undefined && { displayName }),
      ...(bio !== undefined && { bio }),
      ...(phoneNumber !== undefined && { phoneNumber }),
      ...(avatarUrl !== undefined && { avatarUrl: avatarUrl || null }),
      ...(addressLine1 !== undefined && { addressLine1 }),
      ...(addressLine2 !== undefined && { addressLine2 }),
      ...(city !== undefined && { city }),
      ...(county !== undefined && { county }),
      ...(postcode !== undefined && { postcode }),
      ...(country !== undefined && { country }),
    },
    select: {
      id: true, email: true, displayName: true, bio: true, phoneNumber: true, avatarUrl: true,
      addressLine1: true, addressLine2: true, city: true, county: true, postcode: true, country: true,
    },
  });

  return NextResponse.json(updated);
}
