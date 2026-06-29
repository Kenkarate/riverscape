import { prisma } from "@/lib/prisma";
import { AlertCircle, Sparkles, AlertTriangle } from "lucide-react";
import { housekeepingBadge } from "@/lib/badges";
import HousekeepingSelect from "@/components/admin/housekeeping-select";
import type { HousekeepingStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

async function getRooms() {
  return prisma.room.findMany({
    where: { isActive: true },
    include: {
      roomType: { select: { name: true } },
      housekeepingLogs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
    orderBy: [{ number: "asc" }],
  });
}

type RoomWithLog = Awaited<ReturnType<typeof getRooms>>[number];

const NEEDS_ATTENTION: HousekeepingStatus[] = ["DIRTY", "OUT_OF_ORDER"];

function formatUpdated(d: Date) {
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function RoomCard({ room }: { room: RoomWithLog }) {
  const badge = housekeepingBadge[room.housekeeping];
  const lastLog = room.housekeepingLogs[0];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center font-mono font-semibold text-gray-700 text-sm">
            {room.number}
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900">
              Room {room.number}
              {room.floor && (
                <span className="text-xs text-gray-400 ml-1.5">Floor {room.floor}</span>
              )}
            </div>
            <div className="text-xs text-gray-400">{room.roomType.name}</div>
          </div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.className}`}>
          {badge.label}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs text-gray-400">
          {lastLog ? `Updated ${formatUpdated(lastLog.createdAt)}` : "No updates yet"}
        </span>
        <HousekeepingSelect roomId={room.id} current={room.housekeeping} />
      </div>
    </div>
  );
}

export default async function HousekeepingPage() {
  let rooms: RoomWithLog[] = [];
  let dbError = false;

  try {
    rooms = await getRooms();
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

  const needsAttention = rooms.filter((r) => NEEDS_ATTENTION.includes(r.housekeeping));
  const ready = rooms.filter((r) => !NEEDS_ATTENTION.includes(r.housekeeping));

  const counts = {
    DIRTY: rooms.filter((r) => r.housekeeping === "DIRTY").length,
    OUT_OF_ORDER: rooms.filter((r) => r.housekeeping === "OUT_OF_ORDER").length,
    CLEAN: rooms.filter((r) => r.housekeeping === "CLEAN").length,
    INSPECTED: rooms.filter((r) => r.housekeeping === "INSPECTED").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Housekeeping</h1>
        <span className="text-sm text-gray-400">{rooms.length} rooms</span>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(
          [
            { key: "DIRTY", label: "Dirty", color: "text-amber-700", bg: "bg-amber-50" },
            { key: "OUT_OF_ORDER", label: "Out of Order", color: "text-red-700", bg: "bg-red-50" },
            { key: "CLEAN", label: "Clean", color: "text-green-700", bg: "bg-green-50" },
            { key: "INSPECTED", label: "Inspected", color: "text-blue-700", bg: "bg-blue-50" },
          ] as const
        ).map((s) => (
          <div key={s.key} className={`${s.bg} rounded-xl p-3 text-center`}>
            <div className={`text-2xl font-semibold ${s.color}`}>{counts[s.key]}</div>
            <div className={`text-xs ${s.color} mt-0.5`}>{s.label}</div>
          </div>
        ))}
      </div>

      {rooms.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
          No rooms found. Seed the database to get started.
        </div>
      )}

      {/* Needs Attention */}
      {needsAttention.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <AlertTriangle size={16} className="text-amber-500" />
            Needs Attention
            <span className="text-xs text-gray-400">({needsAttention.length})</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {needsAttention.map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
        </section>
      )}

      {/* Ready */}
      {ready.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Sparkles size={16} className="text-green-500" />
            Ready
            <span className="text-xs text-gray-400">({ready.length})</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ready.map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
