import { prisma } from "@/lib/prisma";
import Link from "next/link";
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

export const dynamic = "force-dynamic";

async function getDashboardStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [
    todayArrivals,
    todayDepartures,
    totalRooms,
    occupiedToday,
    pendingPayments,
    revenueToday,
  ] = await Promise.all([
    prisma.booking.count({
      where: { checkIn: { gte: today, lt: tomorrow }, status: { in: ["CONFIRMED", "CHECKED_IN"] } },
    }),
    prisma.booking.count({
      where: { checkOut: { gte: today, lt: tomorrow }, status: "CHECKED_IN" },
    }),
    prisma.room.count({ where: { isActive: true } }),
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
      where: {
        status: "CAPTURED",
        capturedAt: { gte: today, lt: tomorrow },
      },
    }),
  ]);

  const occupancyPct = totalRooms > 0 ? Math.round((occupiedToday / totalRooms) * 100) : 0;

  return {
    todayArrivals,
    todayDepartures,
    occupancyPct,
    pendingPayments,
    revenueToday: revenueToday._sum.amount ?? 0,
  };
}

async function getTodayArrivalsDetail() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return prisma.booking.findMany({
    where: { checkIn: { gte: today, lt: tomorrow }, status: { in: ["CONFIRMED", "CHECKED_IN"] } },
    include: { guest: true, rooms: { include: { room: true, roomType: true } } },
    orderBy: { createdAt: "asc" },
    take: 10,
  });
}

async function getTodayDeparturesDetail() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return prisma.booking.findMany({
    where: { checkOut: { gte: today, lt: tomorrow }, status: "CHECKED_IN" },
    include: { guest: true, rooms: { include: { room: true, roomType: true } } },
    orderBy: { createdAt: "asc" },
    take: 10,
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

export default async function AdminDashboardPage() {
  let stats = null;
  let arrivals: Awaited<ReturnType<typeof getTodayArrivalsDetail>> = [];
  let departures: Awaited<ReturnType<typeof getTodayDeparturesDetail>> = [];
  let attentionRooms: Awaited<ReturnType<typeof getRoomsNeedingAttention>> = [];
  let dbError = false;

  try {
    [stats, arrivals, departures, attentionRooms] = await Promise.all([
      getDashboardStats(),
      getTodayArrivalsDetail(),
      getTodayDeparturesDetail(),
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
    { label: "Today's Arrivals", value: stats.todayArrivals, icon: CalendarCheck, color: "text-green-600", bg: "bg-green-50" },
    { label: "Today's Departures", value: stats.todayDepartures, icon: CalendarX, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Occupancy", value: `${stats.occupancyPct}%`, icon: Percent, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Revenue Today", value: formatINR(stats.revenueToday), icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Pending Payments", value: stats.pendingPayments, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>

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
        {/* Today's Arrivals */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-medium text-gray-900">Today&apos;s Arrivals</h2>
          </div>
          {arrivals.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">No arrivals today.</div>
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
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      b.status === "CHECKED_IN"
                        ? "bg-green-100 text-green-700"
                        : "bg-amber-100 text-amber-700"
                    }`}>
                      {b.status === "CHECKED_IN" ? "Checked In" : "Expected"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Today's Departures */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-medium text-gray-900">Today&apos;s Departures</h2>
          </div>
          {departures.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">No departures today.</div>
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
                      Departing
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
