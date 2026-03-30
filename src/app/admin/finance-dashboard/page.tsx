"use client";

import { useState, useEffect } from "react";

interface FinanceMetrics {
  period: string;
  gmvCents: number;
  platformFeeCents: number;
  sellerEarningsCents: number;
  payoutsCents: number;
  pendingPayoutsCents: number;
  orderCount: number;
  sellerCount: number;
  averageOrderValueCents: number;
}

export default function FinanceDashboardPage() {
  const [metrics, setMetrics] = useState<FinanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<"month" | "quarter" | "year">("month");

  useEffect(() => {
    const loadMetrics = async () => {
      setLoading(true);
      const now = new Date();
      let startDate: Date;

      if (dateRange === "month") {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      } else if (dateRange === "quarter") {
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
      } else {
        startDate = new Date(now.getFullYear(), 0, 1);
      }

      try {
        const response = await fetch("/api/admin/finance-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startDate: startDate.toISOString(),
            endDate: now.toISOString(),
          }),
        });
        const data = await response.json();
        setMetrics(data);
      } catch (error) {
        console.error("Failed to load financial metrics:", error);
      } finally {
        setLoading(false);
      }
    };

    loadMetrics();
  }, [dateRange]);

  if (loading) return <div className="p-8">Loading financial data...</div>;

  if (!metrics) {
    return <div className="p-8 text-red-600">Failed to load financial metrics</div>;
  }

  const cards = [
    {
      label: "Gross Merchandise Value",
      value: `£${(metrics.gmvCents / 100).toFixed(2)}`,
      subtext: `${metrics.orderCount} orders`,
      color: "bg-green-50 border-green-200",
      statColor: "text-green-700",
    },
    {
      label: "Platform Fees",
      value: `£${(metrics.platformFeeCents / 100).toFixed(2)}`,
      subtext: "15% commission",
      color: "bg-blue-50 border-blue-200",
      statColor: "text-blue-700",
    },
    {
      label: "Seller Earnings",
      value: `£${(metrics.sellerEarningsCents / 100).toFixed(2)}`,
      subtext: `${metrics.sellerCount} sellers`,
      color: "bg-amber-50 border-amber-200",
      statColor: "text-amber-700",
    },
    {
      label: "Paid Out",
      value: `£${(metrics.payoutsCents / 100).toFixed(2)}`,
      subtext: "Settled",
      color: "bg-purple-50 border-purple-200",
      statColor: "text-purple-700",
    },
    {
      label: "Pending Payouts",
      value: `£${(metrics.pendingPayoutsCents / 100).toFixed(2)}`,
      subtext: "In queue",
      color: "bg-orange-50 border-orange-200",
      statColor: "text-orange-700",
    },
    {
      label: "Avg Order Value",
      value: `£${(metrics.averageOrderValueCents / 100).toFixed(2)}`,
      subtext: "Per transaction",
      color: "bg-indigo-50 border-indigo-200",
      statColor: "text-indigo-700",
    },
  ];

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 text-foreground">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground">Finance Dashboard</h1>
        <p className="mt-2 text-foreground/60">Platform financial metrics and performance</p>
      </div>

      <div className="mb-6 flex gap-4">
        {(["month", "quarter", "year"] as const).map((period) => (
          <button
            key={period}
            onClick={() => setDateRange(period)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              dateRange === period
                ? "bg-green-600 text-white"
                : "bg-white border border-gray-200 text-foreground hover:bg-gray-50"
            }`}
          >
            {period.charAt(0).toUpperCase() + period.slice(1)}
          </button>
        ))}
        <button
          onClick={() => {
            // Export data
            const csvContent = `
Period,${metrics.period}
Gross Merchandise Value,£${(metrics.gmvCents / 100).toFixed(2)}
Platform Fees,£${(metrics.platformFeeCents / 100).toFixed(2)}
Seller Earnings,£${(metrics.sellerEarningsCents / 100).toFixed(2)}
Paid Out,£${(metrics.payoutsCents / 100).toFixed(2)}
Pending Payouts,£${(metrics.pendingPayoutsCents / 100).toFixed(2)}
Orders,${metrics.orderCount}
Active Sellers,${metrics.sellerCount}
Average Order Value,£${(metrics.averageOrderValueCents / 100).toFixed(2)}
            `.trim();

            const blob = new Blob([csvContent], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `finance-report-${dateRange}.csv`;
            link.click();
          }}
          className="ml-auto px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
        >
          Export CSV
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className={`rounded-lg border p-6 ${card.color}`}
          >
            <p className="text-sm font-medium text-foreground/60">{card.label}</p>
            <p className={`mt-2 text-3xl font-bold ${card.statColor}`}>{card.value}</p>
            <p className="mt-1 text-xs text-foreground/50">{card.subtext}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-6">
        <h2 className="text-xl font-bold text-amber-800">DAC7 / HMRC Seller Income Report</h2>
        <p className="mt-2 text-sm text-amber-700">
          Under the Finance Act 2021 (DAC7) UK marketplace rules, you must report annual seller income to HMRC.
          This export generates a CSV of seller identities, business details, and gross order income for a given tax year.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-amber-800">
            Tax year ending 5 April:
            <select
              id="dac7-year"
              className="ml-2 rounded border border-amber-300 bg-white px-2 py-1 text-sm"
              defaultValue={new Date().getFullYear()}
            >
              {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>
          <button
            onClick={async () => {
              const yearEl = document.getElementById("dac7-year") as HTMLSelectElement | null;
              const year = yearEl ? parseInt(yearEl.value) : new Date().getFullYear();
              const response = await fetch(`/api/admin/dac7-export?year=${year}`);
              if (!response.ok) { alert("Export failed."); return; }
              const blob = await response.blob();
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = `dibble-dac7-${year}.csv`;
              link.click();
            }}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          >
            Export DAC7 CSV
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-xl font-bold text-foreground">Monthly Settlement Statements</h2>
        <p className="mt-2 text-sm text-foreground/60">
          Download individual seller settlement reports for accounting and reconciliation
        </p>
        <button
          onClick={async () => {
            const now = new Date();
            const response = await fetch("/api/admin/export-settlements", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                year: now.getFullYear(),
                month: now.getMonth() + 1,
              }),
            });
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `settlements-${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}.zip`;
            link.click();
          }}
          className="mt-4 px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition-colors"
        >
          Export All Settlement Reports (ZIP)
        </button>
      </div>
    </main>
  );
}
