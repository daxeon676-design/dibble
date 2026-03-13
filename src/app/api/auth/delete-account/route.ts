import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcrypt";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  password: z.string().min(1, "Password required"),
  confirmation: z.string().min(1, "Confirmation required"),
}).refine((data) => data.confirmation === "DELETE_MY_ACCOUNT", {
  message: "Invalid confirmation",
  path: ["confirmation"],
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  // Get current user with password hash
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true, email: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!isValidPassword) {
    return NextResponse.json(
      { error: "Password is incorrect" },
      { status: 400 }
    );
  }

  // Delete user account and all related data
  // This cascade deletes based on Prisma relations
  await prisma.user.delete({
    where: { id: session.user.id },
  });

  return NextResponse.json({ 
    success: true, 
    message: "Account deleted successfully. You will be logged out." 
  });
}
