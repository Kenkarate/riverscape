import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Suspense } from "react";
import {
  CalendarCheck,
  CalendarX,
  Percent,
  TrendingUp,
  AlertCircle,
  Clock,
  Sparkles,
} from "lucide-react";
import { formatINR } from "@/lib/pricing";
import { housekeepingBadge } from "@/lib/badges";
import DashboardDateFilter from "@/components/admin/dashboard-date-filter";

export const dynamic = "force-dynamic";

// ─── Date range helpers ────────────────────────────────────────────────────────

function getDateRange(range: string): { from: Date; to: Date; label: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  switch (range) {
    case "yesterday": {
      const from = new Date(today);
      from.setDate(from.getDate() - 1);
      return { from, to: today, label: "Yesterday" };
    }
    case "last7": {
      const from = new Date(today);
      from.setDate(from.getDate() - 6);
      return { from, to: tomorrow, label: "Last 7 Days" };
    }
    case "last30": {
      const from = new Date(today);
      from.setDate(from.getDate() - 29);
      return { from, to: tomorrow, label: "Last 30 Days" };
    }
    case "thisMonth": {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from, to: tomorrow, label: "This Month" };
    }
    case "lastMonth": {
      const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const to = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from, to, label: "Last Month" };
    }
    default: // "today"
      return { from: today, to: tomorrow, label: "Today" };
  }
}

// ─── Data fetching ─────────────────────────────────────────────────────────────

async function getDashboardStats(from: Date, to: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [
    arrivals,
    departures,
    totalRooms,
    occupiedToday,
    pendingPayments,
    revenue,
  ] = await Promise.all([
    prisma.booking.count({
      where: {
        checkIn: { gte: from, lt: to },
        status: { in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] },
      },
    }),
    prisma.booking.count({
      where: {
        checkOut: { gte: from, lt: to },
        status: { in: ["CHECKED_IN", "CHECKED_OUT"] },
      },
    }),
    prisma.room.count({ where: { isActive: true } }),
    // Occupancy is always real-time (today)
    prisma.bookingRoom.count({
      where: {
        checkIn: { lte: today },
        checkOut: { gt: today },
        booking: { status: { in: ["CONFIRMED", "CHECKED_IN"] } },
      },
    }),
    prisma.booking.count({ where: { status: "PENDING" } }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: "CAPTURED", capturedAt: { gte: from, lt: to } },
    }),
  ]);

  const occupancyPct = totalRooms > 0 ? Math.round((occupiedToday / totalRooms) * 100) : 0;

  return { arrivals, departures, occupancyPct, pendingPayments, revenue: revenue._sum.amount ?? 0 };
}

async function getArrivalsDetail(from: Date, to: Date) {
  return prisma.booking.findMany({
    where: {
      checkIn: { gte: from, lt: to },
      status: { in: ["CONFIRMED", "CHECKED_IN"] },
    },
    include: { guest: true, rooms: { include: { room: true, roomType: true } } },
    orderBy: { checkIn: "asc" },
    take: 15,
  });
}

async function getDeparturesDetail(from: Date, to: Date) {
  return prisma.booking.findMany({
    where: {
      checkOut: { gte: from, lt: to },
      status: { in: ["CHECKED_IN", "CHECKED_OUT"] },
    },
    include: { guest: true, rooms: { include: { room: true, roomType: true } } },
    orderBy: { checkOut: "asc" },
    take: 15,
  });
}

async function getRoomsNeedingAttention() {
  return prisma.room.findMany({
    where: { isActive: true, housekeeping: { in: ["DIRTY", "OUT_OF_ORDER"] } },
    include: { roomType: { select: { name: true } } },
    orderBy: [{ housekeeping: "asc" }, { number: "asc" }],
    take: 12,
  });
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range = "today" } = await searchParams;
  const { from, to, label } = getDateRange(range);

  let stats = null;
  let arrivals: Awaited<ReturnType<typeof getArrivalsDetail>> = [];
  let departures: Awaited<ReturnType<typeof getDeparturesDetail>> = [];
  let attentionRooms: Awaited<ReturnType<typeof getRoomsNeedingAttention>> = [];
  let dbError = false;

  try {
    [stats, arrivals, departures, attentionRooms] = await Promise.all([
      getDashboardStats(from, to),
      getArrivalsDetail(from, to),
      getDeparturesDetail(from, to),
      getRoomsNeedingAttention(),
    ]);
  } catch {
    dbError = true;
  }

  if (dbError || !stats) {
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

  const kpis = [
    {
      label: "Arrivals",
      value: stats.arrivals,
      icon: CalendarCheck,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Departures",
      value: stats.departures,
      icon: CalendarX,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Occupancy (Now)",
      value: `${stats.occupancyPct}%`,
      icon: Percent,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      label: "Revenue",
      value: formatINR(stats.revenue),
      icon: TrendingUp,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Pending Payments",
      value: stats.pendingPayments,
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header + date filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <Suspense>
          <DashboardDateFilter />
        </Suspense>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
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
        {/* Arrivals */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-medium text-gray-900">Arrivals</h2>
            <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-md">{label}</span>
          </div>
          {arrivals.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">No arrivals for {label.toLowerCase()}.</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {arrivals.map((b) => (
                <div key={b.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/bookings/${b.bookingRef}`}
                      className="font-medium text-sm text-gray-900 hover:underline"
                    >
                      {b.guest.name}
                    </Link>
                    <span className="text-xs text-gray-400 ml-2 font-mono">{b.bookingRef}</span>
                  </div>
                  <div className="text-xs text-gray-500 shrink-0">
                    {b.rooms.map((r) => r.room?.number ?? r.roomType.name).join(", ")}
                  </div>
                  <div className="shrink-0">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        b.status === "CHECKED_IN"
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {b.status === "CHECKED_IN" ? "Checked In" : "Expected"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Departures */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-medium text-gray-900">Departures</h2>
            <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-md">{label}</span>
          </div>
          {departures.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">No departures for {label.toLowerCase()}.</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {departures.map((b) => (
                <div key={b.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/bookings/${b.bookingRef}`}
                      className="font-medium text-sm text-gray-900 hover:underline"
                    >
                      {b.guest.name}
                    </Link>
                    <span className="text-xs text-gray-400 ml-2 font-mono">{b.bookingRef}</span>
                  </div>
                  <div className="text-xs text-gray-500 shrink-0">
                    {b.rooms.map((r) => r.room?.number ?? r.roomType.name).join(", ")}
                  </div>
                  <div className="shrink-0">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">
                      {b.status === "CHECKED_OUT" ? "Checked Out" : "Departing"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Rooms Needing Attention */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-medium text-gray-900 flex items-center gap-2">
            <Sparkles size={16} className="text-amber-500" />
            Rooms Needing Attention
          </h2>
          <Link href="/admin/rooms" className="text-xs text-[#1a3a2a] hover:underline font-medium">
            View all rooms
          </Link>
        </div>
        {attentionRooms.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">
            All rooms are clean or inspected.
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {attentionRooms.map((room) => {
              const badge = housekeepingBadge[room.housekeeping];
              return (
                <Link
                  key={room.id}
                  href="/admin/rooms"
                  className="px-5 py-3 flex items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center font-mono font-semibold text-gray-700 text-sm">
                      {room.number}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">Room {room.number}</div>
                      <div className="text-xs text-gray-400">{room.roomType.name}</div>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.className}`}>
                    {badge.label}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
