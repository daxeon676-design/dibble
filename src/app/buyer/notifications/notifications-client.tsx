"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Notification = {
  id: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | Date | null;
  createdAt: string | Date;
};

export default function NotificationsClient({
  initialNotifications,
}: {
  initialNotifications: Notification[];
}) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.readAt).length,
    [notifications],
  );

  async function markAllAsRead() {
    setState("loading");
    const response = await fetch("/api/notifications", { method: "PATCH" });

    if (!response.ok) {
      setState("error");
      return;
    }

    setNotifications((prev) =>
      prev.map((notification) => ({
        ...notification,
        readAt: notification.readAt ?? new Date().toISOString(),
      })),
    );
    setState("idle");
  }

  async function markOneAsRead(id: string) {
    const response = await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    if (!response.ok) {
      return;
    }

    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === id ? { ...notification, readAt: notification.readAt ?? new Date().toISOString() } : notification,
      ),
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-12 text-foreground">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Notifications</h1>
          <p className="mt-1 text-sm text-foreground/70">Stay updated when shops you follow add new listings.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-(--accent-terra)/40 px-2 py-1 text-xs text-(--accent-terra)">
            {unreadCount} unread
          </span>
          <button
            type="button"
            onClick={markAllAsRead}
            disabled={state === "loading" || unreadCount === 0}
            className="rounded-md border border-(--accent-terra) px-3 py-2 text-sm text-(--accent-terra) disabled:opacity-60"
          >
            {state === "loading" ? "Updating..." : "Mark All Read"}
          </button>
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="rounded-md border border-(--accent-terra)/30 bg-white p-8 text-center text-foreground/70">
          No notifications yet.
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <article
              key={notification.id}
              className={`rounded-md border p-4 ${
                notification.readAt
                  ? "border-(--accent-terra)/20 bg-white"
                  : "border-(--accent-terra)/45 bg-(--accent-beige)/35"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-foreground">{notification.title}</h2>
                  <p className="mt-1 text-sm text-foreground/80">{notification.body}</p>
                  <p className="mt-2 text-xs text-foreground/55">
                    {new Date(notification.createdAt).toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                {!notification.readAt ? (
                  <button
                    type="button"
                    onClick={() => markOneAsRead(notification.id)}
                    className="rounded-md border border-(--accent-terra) px-2 py-1 text-xs text-(--accent-terra)"
                  >
                    Mark Read
                  </button>
                ) : null}
              </div>
              {notification.href ? (
                <div className="mt-3">
                  <Link href={notification.href} className="text-sm text-(--accent-terra) underline">
                    View item
                  </Link>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
