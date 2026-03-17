import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";

type ConfigCheck = {
  key: string;
  required: boolean;
  configured: boolean;
  note?: string;
};

export const metadata: Metadata = { title: "Launch Config - Admin" };

export default async function AdminLaunchConfigPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/login?callbackUrl=/admin/launch-config");
  }

  const checks: ConfigCheck[] = [
    { key: "DATABASE_URL", required: true, configured: Boolean(process.env.DATABASE_URL) },
    { key: "NEXTAUTH_SECRET", required: true, configured: Boolean(process.env.NEXTAUTH_SECRET) },
    { key: "STRIPE_SECRET_KEY", required: true, configured: Boolean(process.env.STRIPE_SECRET_KEY) },
    { key: "OPS_CRON_SECRET", required: true, configured: Boolean(process.env.OPS_CRON_SECRET), note: "Required for scheduled reconciliation endpoint auth." },
    { key: "OPS_ALERT_WEBHOOK_URL", required: true, configured: Boolean(process.env.OPS_ALERT_WEBHOOK_URL), note: "Required for automatic ops alert routing to on-call destination." },
    { key: "NEXTAUTH_URL", required: false, configured: Boolean(process.env.NEXTAUTH_URL) },
    { key: "STRIPE_WEBHOOK_SECRET", required: false, configured: Boolean(process.env.STRIPE_WEBHOOK_SECRET) },
    { key: "OPS_ALERT_WEBHOOK_BEARER_TOKEN", required: false, configured: Boolean(process.env.OPS_ALERT_WEBHOOK_BEARER_TOKEN) },
  ];

  const requiredPass = checks.filter((check) => check.required).every((check) => check.configured);

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-12 text-foreground">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-3xl font-semibold text-(--accent-terra)">Launch Configuration</h1>
          <p className="mt-1 text-sm text-foreground/70">Environment and scheduler prerequisites for reliable launch operation.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/ops" className="rounded-md border border-(--accent-terra) px-3 py-2 text-sm text-(--accent-terra)">
            Ops Dashboard
          </Link>
          <Link href="/admin" className="rounded-md border border-(--accent-terra) px-3 py-2 text-sm text-(--accent-terra)">
            Admin Dashboard
          </Link>
        </div>
      </div>

      <section className="rounded-xl border border-(--accent-terra)/25 bg-white p-5">
        <p className={`text-sm font-semibold ${requiredPass ? "text-emerald-700" : "text-red-700"}`}>
          {requiredPass ? "Required launch configuration is complete." : "Required launch configuration is incomplete."}
        </p>
        <div className="mt-4 space-y-2">
          {checks.map((check) => (
            <article key={check.key} className="rounded-md border border-(--accent-terra)/20 p-3 text-sm">
              <p className={`font-semibold ${check.configured ? "text-emerald-700" : check.required ? "text-red-700" : "text-amber-700"}`}>
                {check.configured ? "PASS" : check.required ? "FAIL" : "WARN"}: {check.key}
              </p>
              {check.note ? <p className="mt-1 text-xs text-foreground/70">{check.note}</p> : null}
            </article>
          ))}
        </div>

        <div className="mt-4 rounded-md border border-(--accent-terra)/20 bg-(--accent-beige)/20 p-3 text-sm">
          <p className="font-semibold text-(--accent-terra)">Scheduler setup</p>
          <p className="mt-1 text-foreground/70">Configure your scheduler to call:</p>
          <p className="mt-1 font-mono text-xs text-foreground/80">POST /api/internal/ops/daily-reconciliation</p>
          <p className="mt-1 text-foreground/70">With header:</p>
          <p className="mt-1 font-mono text-xs text-foreground/80">x-ops-secret: OPS_CRON_SECRET</p>
        </div>

        <div className="mt-4 rounded-md border border-(--accent-terra)/20 bg-(--accent-beige)/20 p-3 text-sm">
          <p className="font-semibold text-(--accent-terra)">Alert routing test</p>
          <p className="mt-1 text-foreground/70">Use this endpoint to verify your on-call webhook receives alerts:</p>
          <p className="mt-1 font-mono text-xs text-foreground/80">POST /api/admin/ops-alerts/test</p>
        </div>
      </section>
    </main>
  );
}
