import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Inbox – Dibble" };

export default async function InboxPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const conversations = await prisma.conversation.findMany({
    where: { participants: { some: { userId: session.user.id } } },
    include: {
      participants: {
        include: { user: { select: { id: true, displayName: true, email: true } } },
      },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Determine unread status per conversation
  const participantMap = await prisma.conversationParticipant.findMany({
    where: {
      userId: session.user.id,
      conversationId: { in: conversations.map((c) => c.id) },
    },
  });
  const readAtMap = new Map(participantMap.map((p) => [p.conversationId, p.readAt]));

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Inbox</h1>
        <Link
          href="/buyer/messages/new"
          className="bg-green-700 text-white px-4 py-2 rounded text-sm hover:bg-green-600"
        >
          + New Message
        </Link>
      </div>

      {conversations.length === 0 ? (
        <div className="border rounded p-8 text-center text-gray-500">
          <p className="text-lg mb-2">No messages yet</p>
          <p className="text-sm">
            Start a conversation by contacting a seller or admin.
          </p>
        </div>
      ) : (
        <ul className="divide-y border rounded overflow-hidden">
          {conversations.map((conv) => {
            const other = conv.participants.find((p) => p.userId !== session.user.id);
            const otherName = other?.user.displayName ?? other?.user.email ?? "Unknown";
            const lastMessage = conv.messages[0];
            const readAt = readAtMap.get(conv.id);
            const isUnread =
              lastMessage &&
              lastMessage.senderId !== session.user.id &&
              (!readAt || readAt < lastMessage.createdAt);

            return (
              <li key={conv.id}>
                <Link
                  href={`/buyer/messages/${conv.id}`}
                  className="flex items-start gap-3 px-4 py-4 hover:bg-gray-50 transition"
                >
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center font-bold text-green-700 shrink-0">
                    {otherName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`font-medium ${isUnread ? "text-black" : "text-gray-700"}`}>
                        {otherName}
                      </span>
                      <span className="text-xs text-gray-400">
                        {lastMessage
                          ? new Date(lastMessage.createdAt).toLocaleDateString()
                          : ""}
                      </span>
                    </div>
                    {conv.subject && (
                      <p className="text-xs text-gray-500 truncate">{conv.subject}</p>
                    )}
                    {lastMessage && (
                      <p className={`text-sm truncate ${isUnread ? "font-semibold text-gray-900" : "text-gray-500"}`}>
                        {lastMessage.body}
                      </p>
                    )}
                  </div>
                  {isUnread && (
                    <span className="mt-1 w-2 h-2 rounded-full bg-green-500 shrink-0" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
