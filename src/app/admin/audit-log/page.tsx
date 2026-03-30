import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Role } from "@/generated/prisma/enums";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type SearchParams = {
  actor?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
};

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/audit-log");
  }

  if (session.user.role !== Role.ADMIN) {
    redirect("/buyer");
  }

  const params = await searchParams;
  const actor = (params.actor ?? "").trim();
  const action = (params.action ?? "").trim();
  const targetType = (params.targetType ?? "").trim();
  const targetId = (params.targetId ?? "").trim();

  const logs = await prisma.immutableAuditLog.findMany({
    where: {
      ...(actor ? { actor: { contains: actor, mode: "insensitive" } } : {}),
      ...(action ? { action: { contains: action, mode: "insensitive" } } : {}),
      ...(targetType ? { targetType: { contains: targetType, mode: "insensitive" } } : {}),
      ...(targetId ? { targetId: { contains: targetId, mode: "insensitive" } } : {}),
    },
    orderBy: { timestamp: "desc" },
    take: 200,
  });

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-10 text-foreground">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Audit Log</h1>
        <Link href="/admin" className="rounded-md border border-(--accent-terra)/40 px-3 py-2 text-sm">
          Back to Admin
        </Link>
      </div>

      <form className="mb-4 grid gap-2 rounded-md border border-(--accent-terra)/30 bg-(--accent-beige)/30 p-3 md:grid-cols-5">
        <input name="actor" defaultValue={actor} placeholder="Actor user ID" className="rounded border border-(--accent-terra)/40 px-3 py-2 text-sm" />
        <input name="action" defaultValue={action} placeholder="Action" className="rounded border border-(--accent-terra)/40 px-3 py-2 text-sm" />
        <input name="targetType" defaultValue={targetType} placeholder="Target type" className="rounded border border-(--accent-terra)/40 px-3 py-2 text-sm" />
        <input name="targetId" defaultValue={targetId} placeholder="Target ID" className="rounded border border-(--accent-terra)/40 px-3 py-2 text-sm" />
        <div className="flex gap-2">
          <button type="submit" className="rounded-md bg-(--accent-terra) px-3 py-2 text-sm font-semibold text-(--accent-beige)">
            Search
          </button>
          <Link href="/admin/audit-log" className="rounded-md border border-(--accent-terra)/40 px-3 py-2 text-sm">
            Reset
          </Link>
        </div>
      </form>

      <div className="overflow-x-auto rounded-md border border-(--accent-terra)/30 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-(--accent-beige)/60 text-foreground/80">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Actor</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Target</th>
              <th className="px-3 py-2">Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t border-(--accent-terra)/20 align-top">
                <td className="px-3 py-2 whitespace-nowrap">{new Date(log.timestamp).toLocaleString("en-GB")}</td>
                <td className="px-3 py-2 font-mono text-xs">{log.actor}</td>
                <td className="px-3 py-2">{log.action}</td>
                <td className="px-3 py-2 text-xs">
                  <div>{log.targetType}</div>
                  <div className="font-mono text-foreground/60">{log.targetId}</div>
                </td>
                <td className="px-3 py-2">
                  <pre className="max-w-lg overflow-x-auto whitespace-pre-wrap text-xs text-foreground/70">
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
