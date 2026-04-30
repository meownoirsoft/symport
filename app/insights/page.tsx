"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";

type Stats = {
  totalDocuments: number;
  totalSpend: number;
  hsaEligibleTotal: number;
  pendingReimbursement: number;
  spendByCategory: { category: string; total: number; count: number }[];
  spendByMonth: { month: string; total: number }[];
  statusCounts: Record<string, number>;
};

const CATEGORY_LABELS: Record<string, string> = {
  medical: "Medical",
  charity: "Charity",
  tax_payment: "Tax payment",
  mortgage_interest: "Mortgage interest",
  business_expense: "Business expense",
  personal: "Personal",
  unknown: "Uncategorised",
};

const CATEGORY_COLORS: Record<string, string> = {
  medical: "#0ea5e9",
  charity: "#22c55e",
  tax_payment: "#f59e0b",
  mortgage_interest: "#8b5cf6",
  business_expense: "#f97316",
  personal: "#6b7280",
  unknown: "#d1d5db",
};

const YEARS = ["all", "2026", "2025", "2024", "2023"];

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5 flex flex-col gap-1">
      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold ${color ?? "text-zinc-900 dark:text-zinc-100"}`}>{value}</p>
      {sub && <p className="text-xs text-zinc-400">{sub}</p>}
    </div>
  );
}

export default function InsightsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [year, setYear] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const qs = year !== "all" ? `?year=${year}` : "";
    fetch(`/api/documents/stats${qs}`)
      .then((r) => r.json())
      .then(setStats)
      .finally(() => setLoading(false));
  }, [year]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <header className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/documents" className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
            ← Documents
          </Link>
          <h1 className="text-xl font-semibold">Spending insights</h1>
        </div>
        <select
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm"
        >
          {YEARS.map((y) => (
            <option key={y} value={y}>{y === "all" ? "All time" : y}</option>
          ))}
        </select>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-4 space-y-6 pb-20">
        {loading || !stats ? (
          <div className="flex items-center justify-center py-24 text-zinc-400">Loading…</div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Documents" value={String(stats.totalDocuments)} />
              <StatCard label="Total spend" value={fmt(stats.totalSpend)} />
              <StatCard
                label="HSA / FSA eligible"
                value={fmt(stats.hsaEligibleTotal)}
                color="text-sky-600 dark:text-sky-400"
              />
              <StatCard
                label="Pending reimbursement"
                value={fmt(stats.pendingReimbursement)}
                sub="HSA/FSA eligible, status: pending"
                color={stats.pendingReimbursement > 0 ? "text-amber-600 dark:text-amber-400" : undefined}
              />
            </div>

            {/* Monthly spend trend */}
            {stats.spendByMonth.length > 0 && (
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5">
                <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-4">Monthly spend</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={stats.spendByMonth} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: "#71717a" }}
                      tickFormatter={(v) => v.slice(5)} // show MM only
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#71717a" }}
                      tickFormatter={(v) => `$${v}`}
                      width={48}
                    />
                    <Tooltip
                      formatter={(v) => [fmt(Number(v)), "Spend"]}
                      labelFormatter={(l) => l}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke="#0ea5e9"
                      strokeWidth={2}
                      fill="url(#spendGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Spend by tax category */}
            {stats.spendByCategory.length > 0 && (
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5">
                <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-4">Spend by category</h2>
                <ResponsiveContainer width="100%" height={Math.max(180, stats.spendByCategory.length * 44)}>
                  <BarChart
                    data={stats.spendByCategory}
                    layout="vertical"
                    margin={{ top: 0, right: 16, left: 100, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: "#71717a" }}
                      tickFormatter={(v) => `$${v}`}
                    />
                    <YAxis
                      type="category"
                      dataKey="category"
                      tick={{ fontSize: 11, fill: "#71717a" }}
                      tickFormatter={(v) => CATEGORY_LABELS[v] ?? v}
                      width={96}
                    />
                    <Tooltip
                      formatter={(v, _name, props) => {
                        const count = (props.payload as { count?: number }).count ?? 0;
                        return [`${fmt(Number(v))} (${count} doc${count !== 1 ? "s" : ""})`, "Spend"];
                      }}
                      labelFormatter={(l) => CATEGORY_LABELS[l as string] ?? l}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                      {stats.spendByCategory.map((entry) => (
                        <Cell
                          key={entry.category}
                          fill={CATEGORY_COLORS[entry.category] ?? "#6b7280"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Status breakdown */}
            {Object.keys(stats.statusCounts).length > 0 && (
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5">
                <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">Document status</h2>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(stats.statusCounts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([status, count]) => (
                      <div key={status} className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2">
                        <span className="text-sm font-medium capitalize">{status.replace(/_/g, " ")}</span>
                        <span className="text-xs bg-zinc-100 dark:bg-zinc-800 rounded-full px-2 py-0.5 font-mono">{count}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {stats.totalDocuments === 0 && (
              <div className="text-center py-16 text-zinc-400">
                <p className="text-4xl mb-4">📊</p>
                <p className="font-medium">No data yet</p>
                <p className="text-sm mt-1">Upload some documents to see spending insights.</p>
                <Link href="/capture" className="mt-4 inline-block text-sm text-sky-600 hover:underline">
                  Upload a document →
                </Link>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
