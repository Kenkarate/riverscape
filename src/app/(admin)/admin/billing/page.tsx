import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  AlertCircle,
  Wallet,
  TrendingUp,
  ReceiptText,
  FolderOpen,
  ArrowRight,
} from "lucide-react";
import { formatINR } from "@/lib/pricing";
import BillingNav from "@/components/admin/billing-nav";

export const dynamic = "force-dynamic";

const ACTIVE_BALANCE_STATUSES = ["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] as const;

function dayWindow() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return { today, tomorrow };
}

function monthWindow() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { from, to };
}

async function getBillingStats() {
  const { today, tomorrow } = dayWindow();
  const { from: monthFrom, to: monthTo } = monthWindow();

  const [
    bookingOutstanding,
    folioOutstanding,
    bookingCollectedToday,
    folioPaymentsToday,
    folioRefundsToday,
    openFolios,
    posRevenueToday,
    bookingPayByMethod,
    folioPayByMethod,
    outstandingBookings,
  ] = await Promise.all([
    prisma.booking.aggregate({
      _sum: { balanceDue: true },
      where: { status: { in: [...ACTIVE_BALANCE_STATUSES] }, balanceDue: { gt: 0 } },
    }),
    prisma.folio.aggregate({
      _sum: { balance: true },
      where: { balance: { gt: 0 } },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: "CAPTURED", capturedAt: { gte: today, lt: tomorrow } },
    }),
    prisma.folioPayment.aggregate({
      _sum: { amount: true },
      where: { direction: "PAYMENT", createdAt: { gte: today, lt: tomorrow } },
    }),
    prisma.folioPayment.aggregate({
      _sum: { amount: true },
      where: { direction: "REFUND", createdAt: { gte: today, lt: tomorrow } },
    }),
    prisma.folio.count({ where: { status: "OPEN" } }),
    prisma.folioCharge.aggregate({
      _sum: { total: true },
      where: { voided: false, createdAt: { gte: today, lt: tomorrow } },
    }),
    prisma.payment.groupBy({
      by: ["method"],
      _sum: { amount: true },
      where: { status: "CAPTURED", capturedAt: { gte: monthFrom, lt: monthTo } },
    }),
    prisma.folioPayment.groupBy({
      by: ["method"],
      _sum: { amount: true },
      where: { direction: "PAYMENT", createdAt: { gte: monthFrom, lt: monthTo } },
    }),
    prisma.booking.findMany({
      where: { status: { in: [...ACTIVE_BALANCE_STATUSES] }, balanceDue: { gt: 0 } },
      select: {
        id: true,
        bookingRef: true,
        balanceDue: true,
        checkOut: true,
        guest: { select: { name: true } },
      },
      orderBy: { balanceDue: "desc" },
      take: 200,
    }),
  ]);

  const collectionsToday =
    (bookingCollectedToday._sum.amount ?? 0) +
    (folioPaymentsToday._sum.amount ?? 0) -
    (folioRefundsToday._sum.amount ?? 0);

  const totalOutstanding =
    (bookingOutstanding._sum.balanceDue ?? 0) + (folioOutstanding._sum.balance ?? 0);

  // Merge payment-method breakdown across both streams.
  const methodMap = new Map<string, number>();
  for (const row of [...bookingPayByMethod, ...folioPayByMethod]) {
    const key = row.method?.trim() || "Other";
    methodMap.set(key, (methodMap.get(key) ?? 0) + (row._sum.amount ?? 0));
  }
  const methodBreakdown = [...methodMap.entries()]
    .map(([method, amount]) => ({ method, amount }))
    .filter((m) => m.amount !== 0)
    .sort((a, b) => b.amount - a.amount);
  const methodTotal = methodBreakdown.reduce((s, m) => s + m.amount, 0);

  // Outstanding aging buckets by check-out date vs today.
  const buckets = { current: 0, b1: 0, b2: 0, b3: 0 };
  for (const b of outstandingBookings) {
    const co = new Date(b.checkOut);
    co.setHours(0, 0, 0, 0);
    const overdue = Math.floor((today.getTime() - co.getTime()) / 86_400_000);
    if (overdue <= 0) buckets.current += b.balanceDue;
    else if (overdue <= 30) buckets.b1 += b.balanceDue;
    else if (overdue <= 60) buckets.b2 += b.balanceDue;
    else buckets.b3 += b.balanceDue;
  }

  const topOutstanding = outstandingBookings.slice(0, 10);

  return {
    totalOutstanding,
    collectionsToday,
    openFolios,
    posRevenueToday: posRevenueToday._sum.total ?? 0,
    methodBreakdown,
    methodTotal,
    buckets,
    topOutstanding,
  };
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function BillingDashboardPage() {
  let stats: Awaited<ReturnType<typeof getBillingStats>> | null = null;
  let dbError = false;

  try {
    stats = await getBillingStats();
  } catch {
    dbError = true;
  }

  if (dbError || !stats) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-gray-900">Billing</h1>
        <BillingNav />
        <div className="flex items-center justify-center h-64">
          <div className="text-center text-gray-500">
            <AlertCircle className="mx-auto mb-2 text-amber-500" size={32} />
            <p className="font-medium">Billing tables not found</p>
            <p className="text-sm mt-1">
              Run the <code className="font-mono">billing_folios</code> migration, then reload.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const kpis = [
    {
      label: "Total Outstanding",
      value: formatINR(stats.totalOutstanding),
      icon: Wallet,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "Collections (Today)",
      value: formatINR(stats.collectionsToday),
      icon: TrendingUp,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Open Folios",
      value: stats.openFolios,
      icon: FolderOpen,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "POS Charges (Today)",
      value: formatINR(stats.posRevenueToday),
      icon: ReceiptText,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
  ];

  const agingRows = [
    { label: "Current / not due", value: stats.buckets.current, className: "text-gray-700" },
    { label: "1–30 days overdue", value: stats.buckets.b1, className: "text-amber-600" },
    { label: "31–60 days overdue", value: stats.buckets.b2, className: "text-orange-600" },
    { label: "60+ days overdue", value: stats.buckets.b3, className: "text-red-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">Billing</h1>
        <Link
          href="/admin/billing/folios"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#1a3a2a] text-white rounded-lg hover:bg-[#14301f] transition-colors self-start sm:self-auto"
        >
          View Folios <ArrowRight size={15} />
        </Link>
      </div>

      <BillingNav />

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg ${k.bg} mb-3`}>
              <k.icon size={18} className={k.color} />
            </div>
            <div className="text-2xl font-semibold text-gray-900">{k.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment method breakdown */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-medium text-gray-900 text-sm">Payment Methods</h2>
            <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-md">This month</span>
          </div>
          {stats.methodBreakdown.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">
              No payments collected this month.
            </div>
          ) : (
            <div className="px-5 py-4 space-y-3">
              {stats.methodBreakdown.map((m) => {
                const pct = stats.methodTotal > 0 ? Math.round((m.amount / stats.methodTotal) * 100) : 0;
                return (
                  <div key={m.method}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-600">{m.method}</span>
                      <span className="text-gray-900 font-medium">
                        {formatINR(m.amount)} <span className="text-gray-400 text-xs">({pct}%)</span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full bg-[#1a3a2a] rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Outstanding aging */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-medium text-gray-900 text-sm">Outstanding Aging</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {agingRows.map((r) => (
              <div key={r.label} className="px-5 py-3 flex items-center justify-between text-sm">
                <span className="text-gray-500">{r.label}</span>
                <span className={`font-medium ${r.className}`}>{formatINR(r.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top outstanding balances */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-medium text-gray-900 text-sm">Top Outstanding Balances</h2>
          <Link href="/admin/billing/folios?balance=due" className="text-xs text-[#1a3a2a] hover:underline font-medium">
            View all folios
          </Link>
        </div>
        {stats.topOutstanding.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">
            No outstanding balances. Everything is settled.
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {stats.topOutstanding.map((b) => (
              <Link
                key={b.id}
                href={`/admin/billing/folios/${b.id}`}
                className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-gray-50/50 transition-colors"
              >
                <div className="min-w-0">
                  <div className="font-medium text-sm text-gray-900 truncate">{b.guest.name}</div>
                  <div className="text-xs text-gray-400 font-mono">{b.bookingRef}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-semibold text-amber-600 text-sm">{formatINR(b.balanceDue)}</div>
                  <div className="text-xs text-gray-400">Out {formatDate(new Date(b.checkOut))}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
