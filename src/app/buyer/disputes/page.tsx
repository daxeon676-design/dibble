import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "My Disputes – Dibble" };

const statusColors: Record<string, string> = {
  OPEN: "bg-yellow-100 text-yellow-800",
  UNDER_REVIEW: "bg-blue-100 text-blue-800",
  RESOLVED: "bg-green-100 text-green-800",
  CLOSED: "bg-gray-100 text-gray-700",
};

export default async function DisputesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const disputes = await prisma.dispute.findMany({
    where: { raisedById: session.user.id },
    include: {
      order: { select: { id: true, totalCents: true, createdAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My Disputes</h1>
        <Link
          href="/buyer/disputes/new"
          className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-500"
        >
          + Raise Dispute
        </Link>
      </div>

      {disputes.length === 0 ? (
        <div className="border rounded p-8 text-center text-gray-500">
          <p className="text-lg mb-2">No disputes raised</p>
          <p className="text-sm">
            If you have an issue with an order, you can raise a dispute and our team will help resolve it.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {disputes.map((d) => (
            <li key={d.id} className="border rounded p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    Order #{d.order.id.slice(0, 8).toUpperCase()}
                  </p>
                  <p className="text-sm text-gray-600 mt-0.5">{d.reason}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Raised {new Date(d.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors[d.status]}`}>
                  {d.status.replace("_", " ")}
                </span>
              </div>
              {d.resolution && (
                <div className="mt-3 pt-3 border-t text-sm text-gray-700">
                  <strong>Resolution:</strong> {d.resolution}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
