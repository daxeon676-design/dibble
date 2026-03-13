import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ThreadClient from "./thread-client";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Message Thread – Dibble" };

export default async function ThreadPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { conversationId } = await params;

  // Verify access
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId: session.user.id } },
  });
  if (!participant) redirect("/buyer/messages");

  // Mark as read server-side
  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId: session.user.id } },
    data: { readAt: new Date() },
  });

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      participants: {
        include: { user: { select: { id: true, displayName: true, email: true } } },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        include: { sender: { select: { id: true, displayName: true, email: true } } },
      },
    },
  });

  if (!conversation) redirect("/buyer/messages");

  return (
    <ThreadClient
      conversation={conversation}
      currentUserId={session.user.id}
    />
  );
}
