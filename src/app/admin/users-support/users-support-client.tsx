"use client";

import { useMemo, useState } from "react";

type UserRow = {
  id: string;
  email: string;
  displayName: string | null;
  role: "BUYER" | "SELLER" | "ADMIN";
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
  mfaEnabled: boolean;
  createdAt: string;
  sellerApplicationStatus: "PENDING" | "APPROVED" | "REJECTED" | null;
  sellerVerified: boolean | null;
  moderationFlagged: boolean;
  moderationFlagReason: string | null;
};

type SupportSummary = {
  openDisputes: number;
  pendingSellerApplications: number;
  buyersWithUnreadMessages: number;
  sellersWithUnreadMessages: number;
  suspendedUsers: number;
  activeUsers: number;
  flaggedUsers: number;
};

export default function UsersSupportClient({
  initialUsers,
  summary,
}: {
  initialUsers: UserRow[];
  summary: SupportSummary;
}) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | UserRow["role"]>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | UserRow["status"]>("ALL");
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<
    | {
        kind: "products" | "purge";
        userId: string;
        email: string;
        title: string;
        details: string[];
      }
    | null
  >(null);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((user) => {
      if (roleFilter !== "ALL" && user.role !== roleFilter) return false;
      if (statusFilter !== "ALL" && user.status !== statusFilter) return false;
      if (!q) return true;
      return (
        user.email.toLowerCase().includes(q) ||
        user.displayName?.toLowerCase().includes(q) ||
        user.id.toLowerCase().includes(q)
      );
    });
  }, [users, query, roleFilter, statusFilter]);

  async function changeStatus(userId: string, nextStatus: UserRow["status"]) {
    setSavingUserId(userId);
    setMessage(null);

    const response = await fetch(`/api/admin/users/${userId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });

    const body = (await response.json().catch(() => null)) as
      | { error?: string; user?: UserRow }
      | null;

    if (!response.ok || !body?.user) {
      setMessage(body?.error ?? "Failed to update user status.");
      setSavingUserId(null);
      return;
    }

    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: body.user!.status } : u)));
    setMessage(`Updated ${body.user.email} to ${body.user.status}.`);
    setSavingUserId(null);
  }

  async function toggleSellerVerification(userId: string, nextVerified: boolean) {
    setSavingUserId(userId);
    setMessage(null);

    const response = await fetch(`/api/admin/users/${userId}/seller-verification`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verified: nextVerified }),
    });

    const body = (await response.json().catch(() => null)) as
      | { error?: string; verified?: boolean }
      | null;

    if (!response.ok || typeof body?.verified !== "boolean") {
      setMessage(body?.error ?? "Failed to update seller verification.");
      setSavingUserId(null);
      return;
    }

    setUsers((prev) =>
      prev.map((user) => (user.id === userId ? { ...user, sellerVerified: body.verified ?? user.sellerVerified } : user)),
    );
    setMessage(`Seller verification updated.`);
    setSavingUserId(null);
  }

  async function toggleModerationFlag(userId: string, nextFlagged: boolean) {
    setSavingUserId(userId);
    setMessage(null);

    const existing = users.find((user) => user.id === userId);
    const reason = nextFlagged
      ? window.prompt("Reason for moderation flag (visible to admins):", existing?.moderationFlagReason ?? "")
      : "";

    if (nextFlagged && reason === null) {
      setSavingUserId(null);
      return;
    }

    const response = await fetch(`/api/admin/users/${userId}/moderation-flag`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flagged: nextFlagged, reason: reason ?? undefined }),
    });

    const body = (await response.json().catch(() => null)) as
      | { error?: string; flagged?: boolean; reason?: string | null }
      | null;

    if (!response.ok || typeof body?.flagged !== "boolean") {
      setMessage(body?.error ?? "Failed to update moderation flag.");
      setSavingUserId(null);
      return;
    }

    setUsers((prev) =>
      prev.map((user) =>
        user.id === userId
          ? {
              ...user,
              moderationFlagged: body.flagged ?? user.moderationFlagged,
              moderationFlagReason: body.reason ?? null,
            }
          : user,
      ),
    );
    setMessage(body.flagged ? "User flagged for moderation." : "User moderation flag removed.");
    setSavingUserId(null);
  }

  async function prepareDeleteUserProducts(userId: string, email: string) {
    setSavingUserId(userId);
    setMessage(null);

    const previewResponse = await fetch(`/api/admin/users/${userId}/products-preview`);
    const previewBody = (await previewResponse.json().catch(() => null)) as
      | {
          error?: string;
          impact?: {
            deleteCount: number;
            delistCount: number;
            sampleDeleteTitles: string[];
            sampleDelistTitles: string[];
          };
        }
      | null;

    if (!previewResponse.ok || !previewBody?.impact) {
      setSavingUserId(null);
      setMessage(previewBody?.error ?? "Failed to load product cleanup preview.");
      return;
    }
    setSavingUserId(null);

    setPendingAction({
      kind: "products",
      userId,
      email,
      title: `Preview product cleanup for ${email}`,
      details: [
        `Delete permanently: ${previewBody.impact.deleteCount}`,
        `Delist (has order history): ${previewBody.impact.delistCount}`,
      ],
    });
  }

  async function preparePurgeUser(userId: string, email: string) {
    setSavingUserId(userId);
    setMessage(null);

    const previewResponse = await fetch(`/api/admin/users/${userId}/purge-preview`);
    const previewBody = (await previewResponse.json().catch(() => null)) as
      | {
          error?: string;
          canPurge?: boolean;
          blocker?: string | null;
          impact?: {
            productsDeleteCount: number;
            productsDelistCount: number;
            pendingCheckouts: number;
            notifications: number;
            savedAddresses: number;
          };
        }
      | null;

    if (!previewResponse.ok || !previewBody) {
      setSavingUserId(null);
      setMessage(previewBody?.error ?? "Failed to load purge preview.");
      return;
    }

    if (!previewBody.canPurge) {
      setSavingUserId(null);
      setMessage(previewBody.blocker ?? "This account cannot be purged right now.");
      return;
    }
    setSavingUserId(null);

    setPendingAction({
      kind: "purge",
      userId,
      email,
      title: `Preview permanent purge for ${email}`,
      details: [
        `Products deleted: ${previewBody.impact?.productsDeleteCount ?? 0}`,
        `Products delisted: ${previewBody.impact?.productsDelistCount ?? 0}`,
        `Pending checkouts removed: ${previewBody.impact?.pendingCheckouts ?? 0}`,
        `Notifications removed: ${previewBody.impact?.notifications ?? 0}`,
        `Saved addresses removed: ${previewBody.impact?.savedAddresses ?? 0}`,
      ],
    });
  }

  async function executePendingAction() {
    if (!pendingAction) return;

    setSavingUserId(pendingAction.userId);
    setMessage(null);

    const endpoint =
      pendingAction.kind === "products"
        ? `/api/admin/users/${pendingAction.userId}/products`
        : `/api/admin/users/${pendingAction.userId}/purge`;

    const response = await fetch(endpoint, { method: "DELETE" });
    const body = (await response.json().catch(() => null)) as
      | { error?: string; deleted?: number; delisted?: number; success?: boolean }
      | null;

    setSavingUserId(null);

    if (!response.ok) {
      setMessage(body?.error ?? "Failed to execute action.");
      return;
    }

    if (pendingAction.kind === "products") {
      setMessage(`Done: ${body?.deleted ?? 0} product(s) deleted, ${body?.delisted ?? 0} delisted.`);
    } else {
      setUsers((prev) => prev.filter((u) => u.id !== pendingAction.userId));
      setMessage(`User ${pendingAction.email} has been permanently purged.`);
    }

    setPendingAction(null);
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <article className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Open Disputes</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.openDisputes}</p>
        </article>
        <article className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Pending Seller Applications</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.pendingSellerApplications}</p>
        </article>
        <article className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Suspended Accounts</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.suspendedUsers}</p>
        </article>
        <article className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Moderation Flags</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.flaggedUsers}</p>
        </article>
        <article className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Buyers With Unread Messages</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.buyersWithUnreadMessages}</p>
        </article>
        <article className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Sellers With Unread Messages</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.sellersWithUnreadMessages}</p>
        </article>
        <article className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Active Accounts</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.activeUsers}</p>
        </article>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <input
            type="text"
            placeholder="Search by email/name/id"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="rounded border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
            className="rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="ALL">All roles</option>
            <option value="BUYER">Buyer</option>
            <option value="SELLER">Seller</option>
            <option value="ADMIN">Admin</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="DELETED">Deleted</option>
          </select>
          <p className="self-center text-sm text-slate-500">Showing {filteredUsers.length} users</p>
        </div>

        {message ? <p className="mt-3 text-sm text-slate-700">{message}</p> : null}

        {pendingAction ? (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3">
            <p className="text-sm font-semibold text-red-900">{pendingAction.title}</p>
            <ul className="mt-2 list-disc pl-5 text-xs text-red-800">
              {pendingAction.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-red-700">This action cannot be undone.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void executePendingAction()}
                disabled={savingUserId === pendingAction.userId}
                className="rounded bg-red-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                {savingUserId === pendingAction.userId ? "Executing..." : "Execute"}
              </button>
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-225 w-full table-auto border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-2 py-2">User</th>
                <th className="px-2 py-2">Role</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Seller App</th>
                <th className="px-2 py-2">Verified</th>
                <th className="px-2 py-2">Flag</th>
                <th className="px-2 py-2">MFA</th>
                <th className="px-2 py-2">Created</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const busy = savingUserId === user.id;
                return (
                  <tr key={user.id} className="border-b border-slate-100 align-top">
                    <td className="px-2 py-3">
                      <p className="font-medium text-slate-900">{user.displayName ?? "(no name)"}</p>
                      <p className="text-slate-600">{user.email}</p>
                      <p className="text-xs text-slate-400">{user.id.slice(0, 8)}...</p>
                    </td>
                    <td className="px-2 py-3 text-slate-700">{user.role}</td>
                    <td className="px-2 py-3 text-slate-700">{user.status}</td>
                    <td className="px-2 py-3 text-slate-700">{user.sellerApplicationStatus ?? "-"}</td>
                    <td className="px-2 py-3 text-slate-700">
                      {user.sellerVerified === null ? "-" : user.sellerVerified ? "Verified" : "Not verified"}
                    </td>
                    <td className="px-2 py-3 text-slate-700" title={user.moderationFlagReason ?? ""}>
                      {user.moderationFlagged ? "Flagged" : "-"}
                    </td>
                    <td className="px-2 py-3 text-slate-700">{user.mfaEnabled ? "Enabled" : "Not set"}</td>
                    <td className="px-2 py-3 text-slate-700">{new Date(user.createdAt).toLocaleDateString()}</td>
                    <td className="px-2 py-3">
                      <div className="flex flex-wrap gap-2">
                        {user.status !== "ACTIVE" ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => changeStatus(user.id, "ACTIVE")}
                            className="rounded border border-green-300 px-2 py-1 text-xs text-green-700 disabled:opacity-50"
                          >
                            Reactivate
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => changeStatus(user.id, "SUSPENDED")}
                            className="rounded border border-amber-300 px-2 py-1 text-xs text-amber-700 disabled:opacity-50"
                          >
                            Suspend
                          </button>
                        )}
                        {user.status !== "DELETED" ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => changeStatus(user.id, "DELETED")}
                            className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 disabled:opacity-50"
                          >
                            Mark Deleted
                          </button>
                        ) : null}
                        {user.role === "SELLER" ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void toggleSellerVerification(user.id, !Boolean(user.sellerVerified))}
                            className="rounded border border-indigo-300 px-2 py-1 text-xs text-indigo-700 disabled:opacity-50"
                          >
                            {user.sellerVerified ? "Remove Badge" : "Verify Seller"}
                          </button>
                        ) : null}
                        {user.role !== "ADMIN" ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void toggleModerationFlag(user.id, !user.moderationFlagged)}
                            className="rounded border border-fuchsia-300 px-2 py-1 text-xs text-fuchsia-700 disabled:opacity-50"
                          >
                            {user.moderationFlagged ? "Unflag" : "Flag"}
                          </button>
                        ) : null}
                          {user.role === "SELLER" ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void prepareDeleteUserProducts(user.id, user.email)}
                              className="rounded border border-orange-300 px-2 py-1 text-xs text-orange-700 disabled:opacity-50"
                            >
                              Delete Products
                            </button>
                          ) : null}
                          {user.role !== "ADMIN" ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void preparePurgeUser(user.id, user.email)}
                              className="rounded bg-red-700 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50 hover:bg-red-800"
                            >
                              Purge User
                            </button>
                          ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
