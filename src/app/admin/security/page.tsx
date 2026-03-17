import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Role } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { getLoginSecuritySnapshot } from "@/lib/auth-security";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Security & Audit - Admin" };

export default async function AdminSecurityPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== Role.ADMIN) {
    redirect("/login?callbackUrl=/admin/security");
  }

  const [accountStatusChanges, loginSnapshot] = await Promise.all([
    prisma.auditLog.findMany({
      where: {
        action: "USER_STATUS_UPDATED",
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        admin: {
          select: {
            email: true,
            displayName: true,
          },
        },
      },
    }),
    Promise.resolve(getLoginSecuritySnapshot()),
  ]);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12 text-slate-900">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Security & Audit</h1>
          <p className="mt-1 text-sm text-slate-600">
            Review account status changes and suspicious login activity indicators.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/users-support" className="rounded border border-slate-300 px-3 py-2 text-sm">
            Users & Support
          </Link>
          <Link href="/admin" className="rounded border border-slate-300 px-3 py-2 text-sm">
            Back to Admin
          </Link>
        </div>
      </div>

      <section className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Suspicious Login Activity (Current Runtime)</h2>
        <p className="mt-1 text-xs text-slate-500">
          These counters are in-memory per app runtime and are intended for rapid triage.
        </p>

        {loginSnapshot.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No active failed-login buckets right now.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-175 w-full table-auto border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2">Email</th>
                  <th className="px-2 py-2">Failures</th>
                  <th className="px-2 py-2">Blocked</th>
                  <th className="px-2 py-2">Retry After (s)</th>
                  <th className="px-2 py-2">Last Failure</th>
                  <th className="px-2 py-2">Reset At</th>
                </tr>
              </thead>
              <tbody>
                {loginSnapshot.map((entry) => (
                  <tr key={entry.email} className="border-b border-slate-100">
                    <td className="px-2 py-3">{entry.email}</td>
                    <td className="px-2 py-3">{entry.failures}</td>
                    <td className="px-2 py-3">{entry.blocked ? "Yes" : "No"}</td>
                    <td className="px-2 py-3">{entry.retryAfterSeconds}</td>
                    <td className="px-2 py-3">{new Date(entry.lastFailureAt).toLocaleString()}</td>
                    <td className="px-2 py-3">{new Date(entry.resetAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-md border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Recent Account Status Changes</h2>

        {accountStatusChanges.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No account status changes recorded yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-225 w-full table-auto border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2">When</th>
                  <th className="px-2 py-2">Admin</th>
                  <th className="px-2 py-2">Target User ID</th>
                  <th className="px-2 py-2">Details</th>
                </tr>
              </thead>
              <tbody>
                {accountStatusChanges.map((entry) => (
                  <tr key={entry.id} className="border-b border-slate-100">
                    <td className="px-2 py-3">{new Date(entry.createdAt).toLocaleString()}</td>
                    <td className="px-2 py-3">{entry.admin.displayName ?? entry.admin.email}</td>
                    <td className="px-2 py-3 font-mono text-xs">{entry.targetId}</td>
                    <td className="px-2 py-3">{entry.details ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
