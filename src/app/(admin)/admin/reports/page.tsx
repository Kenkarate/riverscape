import { prisma } from "@/lib/prisma";
import { AlertCircle, Download } from "lucide-react";
import { formatINR } from "@/lib/pricing";
import { sourceBadge } from "@/lib/badges";
import type { BookingSource } from "@prisma/client";
import Link from "next/link";

export const dynamic = "force-dynamic";

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

function parseDate(str: string | undefined, fallback: Date): Date {
  if (!str) return fallback;
  const d = new Date(str);
  return isNaN(d.getTime()) ? fallback : d;
}

async function getReportData(from: Date, to: Date) {
  const toEnd = new Date(to);
  toEnd.setHours(23, 59, 59, 999);

  const [bookings, payments] = await Promise.all([
    // Bookings by source (checked in or confirmed in the date window)
    prisma.booking.groupBy({
      by: ["source"],
      where: {
        checkIn: { gte: from, lte: toEnd },
        status: { in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] },
      },
      _count: { id: true },
      _sum: { totalAmount: true, paidAmount: true, balanceDue: true },
    }),

    // Revenue captured in the date window (payment-level)
    prisma.payment.findMany({
      where: {
        status: "CAPTURED",
        capturedAt: { gte: from, lte: toEnd },
      },
      select: { capturedAt: true, amount: true, booking: { select: { source: true } } },
      orderBy: { capturedAt: "asc" },
    }),
  ]);

  // Group payments by date
  const byDate: Record<string, number> = {};
  for (const p of payments) {
    if (!p.capturedAt) continue;
    const date = toISO(p.capturedAt);
    byDate[date] = (byDate[date] ?? 0) + p.amount;
  }

  // Total stats
  const totalBookings = bookings.reduce((s, b) => s + b._count.id, 0);
  const totalRevenue = bookings.reduce((s, b) => s + (b._sum.totalAmount ?? 0), 0);
  const totalCollected = bookings.reduce((s, b) => s + (b._sum.paidAmount ?? 0), 0);
  const totalBalance = bookings.reduce((s, b) => s + (b._sum.balanceDue ?? 0), 0);

  return { bookings, byDate, totalBookings, totalRevenue, totalCollected, totalBalance };
}

interface SearchParams {
  from?: string;
  to?: string;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const today = new Date();
  const defaultFrom = startOfMonth(today);
  const defaultTo = endOfMonth(today);

  const from = parseDate(sp.from, defaultFrom);
  const to = parseDate(sp.to, defaultTo);

  let data = null;
  let dbError = false;

  try {
    data = await getReportData(from, to);
  } catch {
    dbError = true;
  }

  if (dbError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-gray-500">
          <AlertCircle className="mx-auto mb-2 text-amber-500" size={32} />
          <p className="font-medium">Database not connected</p>
          <p className="text-sm mt-1">Add your DATABASE_URL to .env.local and run migrations.</p>
        </div>
      </div>
    );
  }

  const { bookings, byDate, totalBookings, totalRevenue, totalCollected, totalBalance } = data!;

  // Sort by-source descending revenue
  const bySource = [...bookings].sort(
    (a, b) => (b._sum.totalAmount ?? 0) - (a._sum.totalAmount ?? 0)
  );
  const maxSourceRevenue = bySource[0]?._sum.totalAmount ?? 1;

  // Date entries sorted
  const dateEntries = Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0]));
  const maxDayRevenue = Math.max(...Object.values(byDate), 1);

  return (
    <div className="space-y-6">
      {/* Header + date range filter */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-gray-900">Reports</h1>
          <a
            href={`/api/admin/reports/export?from=${toISO(from)}&to=${toISO(to)}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            download
          >
            <Download size={14} />
            Download CSV
          </a>
        </div>
        <form method="GET" action="/admin/reports" className="flex items-end gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">From</label>
            <input
              type="date"
              name="from"
              defaultValue={toISO(from)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]/30"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">To</label>
            <input
              type="date"
              name="to"
              defaultValue={toISO(to)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]/30"
            />
          </div>
          <button
            type="submit"
            className="bg-[#1a3a2a] text-white px-4 py-1.5 rounded-lg text-sm hover:bg-[#14301f] transition-colors"
          >
            Apply
          </button>
        </form>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Bookings", value: totalBookings.toString(), sub: "confirmed / checked-in / out" },
          {
            label: "Total Revenue",
            value: formatINR(totalRevenue),
            sub: "billed (incl. GST)",
          },
          {
            label: "Collected",
            value: formatINR(totalCollected),
            sub: "payments captured",
          },
          {
            label: "Balance Due",
            value: formatINR(totalBalance),
            sub: "outstanding",
            highlight: totalBalance > 0,
          },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className={`text-2xl font-semibold ${k.highlight ? "text-amber-600" : "text-gray-900"}`}>
              {k.value}
            </div>
            <div className="text-xs font-medium text-gray-600 mt-0.5">{k.label}</div>
            <div className="text-xs text-gray-400 mt-0.5">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by source */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-medium text-gray-900 text-sm">Revenue by Source</h2>
          </div>
          {bySource.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">No data for this period.</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {bySource.map((row) => {
                const badge = sourceBadge[row.source as BookingSource];
                const rev = row._sum.totalAmount ?? 0;
                const pct = (rev / maxSourceRevenue) * 100;
                return (
                  <div key={row.source} className="px-5 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${badge.className}`}>
                          {badge.label}
                        </span>
                        <span className="text-xs text-gray-500">{row._count.id} bookings</span>
                      </div>
                      <span className="text-sm font-medium text-gray-900">{formatINR(rev)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#1a3a2a] rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Daily revenue */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-medium text-gray-900 text-sm">Daily Collections</h2>
          </div>
          {dateEntries.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">
              No payments captured in this period.
            </div>
          ) : (
            <div className="overflow-y-auto max-h-72">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-5 py-2 text-left font-medium text-gray-400">Date</th>
                    <th className="px-5 py-2 text-right font-medium text-gray-400">Collected</th>
                    <th className="px-3 py-2 w-28" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {dateEntries.map(([date, amount]) => {
                    const barPct = (amount / maxDayRevenue) * 100;
                    return (
                      <tr key={date}>
                        <td className="px-5 py-2 text-gray-600">
                          {new Date(date).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-5 py-2 text-right font-medium text-gray-800">
                          {formatINR(amount)}
                        </td>
                        <td className="px-3 py-2">
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#c9a84c] rounded-full"
                              style={{ width: `${barPct}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Booking source breakdown table */}
      {bySource.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-medium text-gray-900 text-sm">Source Breakdown</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-3 text-left font-medium text-gray-400 text-xs">Source</th>
                  <th className="px-5 py-3 text-right font-medium text-gray-400 text-xs">Bookings</th>
                  <th className="px-5 py-3 text-right font-medium text-gray-400 text-xs">Total Billed</th>
                  <th className="px-5 py-3 text-right font-medium text-gray-400 text-xs">Collected</th>
                  <th className="px-5 py-3 text-right font-medium text-gray-400 text-xs">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {bySource.map((row) => {
                  const badge = sourceBadge[row.source as BookingSource];
                  return (
                    <tr key={row.source}>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${badge.className}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right text-gray-700">{row._count.id}</td>
                      <td className="px-5 py-3 text-right font-medium text-gray-900">
                        {formatINR(row._sum.totalAmount ?? 0)}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-700">
                        {formatINR(row._sum.paidAmount ?? 0)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className={(row._sum.balanceDue ?? 0) > 0 ? "text-amber-600 font-medium" : "text-gray-400"}>
                          {formatINR(row._sum.balanceDue ?? 0)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
