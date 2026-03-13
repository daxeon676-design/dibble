"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

interface UserSnippet {
  id: string;
  displayName: string | null;
  email: string;
}

interface Message {
  id: string;
  body: string;
  createdAt: Date | string;
  sender: UserSnippet;
}

interface Conversation {
  id: string;
  subject: string | null;
  participants: { user: UserSnippet }[];
  messages: Message[];
}

export default function ThreadClient({
  conversation,
  currentUserId,
}: {
  conversation: Conversation;
  currentUserId: string;
}) {
  const [messages, setMessages] = useState<Message[]>(conversation.messages);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const other = conversation.participants.find((p) => p.user.id !== currentUserId);
  const otherName = other?.user.displayName ?? other?.user.email ?? "Unknown";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    const res = await fetch(`/api/messages/${conversation.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (res.ok) {
      const newMsg: Message = await res.json();
      setMessages((prev) => [...prev, newMsg]);
      setBody("");
    }
    setSending(false);
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 flex flex-col" style={{ minHeight: "calc(100vh - 140px)" }}>
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <Link href="/buyer/messages" className="text-gray-400 hover:text-gray-700 text-xl">
          ←
        </Link>
        <div>
          <h1 className="font-semibold text-lg">{otherName}</h1>
          {conversation.subject && (
            <p className="text-sm text-gray-500">{conversation.subject}</p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 border rounded p-4 bg-gray-50" style={{ maxHeight: "60vh" }}>
        {messages.map((msg) => {
          const isMine = msg.sender.id === currentUserId;
          return (
            <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-xs rounded-2xl px-4 py-2 text-sm shadow-sm ${
                  isMine
                    ? "bg-green-600 text-white rounded-br-sm"
                    : "bg-white text-gray-800 border rounded-bl-sm"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.body}</p>
                <p className={`text-xs mt-1 ${isMine ? "text-green-100" : "text-gray-400"} text-right`}>
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Reply box */}
      <form onSubmit={handleReply} className="flex gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          required
          maxLength={5000}
          placeholder="Write a message…"
          className="flex-1 border rounded px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-400"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleReply(e);
            }
          }}
        />
        <button
          type="submit"
          disabled={sending || !body.trim()}
          className="bg-green-700 text-white px-4 py-2 rounded text-sm hover:bg-green-600 disabled:opacity-50 self-end"
        >
          {sending ? "…" : "Send"}
        </button>
      </form>
    </main>
  );
}
