"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  email: string;
  displayName: string | null;
}

export default function NewMessagePage() {
  const router = useRouter();
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientUser, setRecipientUser] = useState<User | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setLookupError("");
    setRecipientUser(null);
    const res = await fetch(`/api/users/lookup?email=${encodeURIComponent(recipientEmail)}`);
    if (!res.ok) {
      setLookupError("No user found with that email.");
      return;
    }
    const user: User = await res.json();
    setRecipientUser(user);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!recipientUser) return;
    setSending(true);
    setError("");
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientId: recipientUser.id, subject, body }),
    });
    if (!res.ok) {
      setError("Failed to send message.");
      setSending(false);
      return;
    }
    const conv = await res.json();
    router.push(`/buyer/messages/${conv.id}`);
  }

  return (
    <main className="max-w-xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-6">New Message</h1>

      {/* Recipient lookup */}
      <div className="mb-6 p-4 border rounded bg-gray-50">
        <p className="text-sm font-medium mb-2">Find Recipient by Email</p>
        <form onSubmit={handleLookup} className="flex gap-2">
          <input
            type="email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            placeholder="seller@example.com"
            required
            className="flex-1 border rounded px-3 py-2 text-sm"
          />
          <button type="submit" className="bg-gray-800 text-white px-3 py-2 rounded text-sm">
            Find
          </button>
        </form>
        {lookupError && <p className="text-red-500 text-xs mt-1">{lookupError}</p>}
        {recipientUser && (
          <p className="text-green-700 text-sm mt-2">
            ✓ Sending to: <strong>{recipientUser.displayName ?? recipientUser.email}</strong>
          </p>
        )}
      </div>

      {/* Message form */}
      <form onSubmit={handleSend} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Subject (optional)</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={200}
            placeholder="Regarding order #…"
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            required
            maxLength={5000}
            placeholder="Write your message here…"
            className="w-full border rounded px-3 py-2 text-sm resize-none"
          />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 rounded border text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!recipientUser || sending}
            className="bg-green-700 text-white px-6 py-2 rounded text-sm hover:bg-green-600 disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send Message"}
          </button>
        </div>
      </form>
    </main>
  );
}
