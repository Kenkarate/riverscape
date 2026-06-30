import { prisma } from "@/lib/prisma";
import { AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import RoomRackGrid, { type RackEntry } from "@/components/admin/room-rack-grid";

export const dynamic = "force-dynamic";

const DAYS = 14;

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

function shortDate(d: Date) {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

async function getRackData(startDate: Date) {
  const endDate = addDays(startDate, DAYS);

  const property = await prisma.property.findUnique({
    where: { slug: "riverscape" },
    select: { id: true },
  });
  if (!property) return null;

  // All active physical rooms, grouped (ordered) by room type then number.
  const rooms = await prisma.room.findMany({
    where: { propertyId: property.id, isActive: true },
    select: {
      id: true,
      number: true,
      floor: true,
      roomType: { select: { id: true, name: true } },
    },
    orderBy: [{ roomType: { name: "asc" } }, { number: "asc" }],
  });

  const flatRooms = rooms.map((r) => ({
    id: r.id,
    number: r.number,
    floor: r.floor,
    roomTypeId: r.roomType.id,
    roomTypeName: r.roomType.name,
  }));

  if (rooms.length === 0) {
    return { rooms: flatRooms, cellMap: {} as Record<string, Record<string, RackEntry[]>> };
  }

  const roomIds = rooms.map((r) => r.id);

  // Booking spans that overlap the window and are pinned to a physical room.
  const bookingRooms = await prisma.bookingRoom.findMany({
    where: {
      roomId: { in: roomIds },
      checkIn: { lt: endDate },
      checkOut: { gt: startDate },
    },
    select: {
      id: true,
      roomId: true,
      checkIn: true,
      checkOut: true,
      booking: {
        select: {
          bookingRef: true,
          status: true,
          paidAmount: true,
          balanceDue: true,
          guestId: true,
          guest: { select: { name: true } },
        },
      },
    },
  });

  const dates = Array.from({ length: DAYS }, (_, i) => toISO(addDays(startDate, i)));
  const dateSet = new Set(dates);

  // roomId → dateStr → entries
  const cellMap: Record<string, Record<string, RackEntry[]>> = {};

  for (const br of bookingRooms) {
    if (!br.roomId) continue;
    const checkInISO = toISO(br.checkIn);
    const totalNights = Math.max(
      1,
      Math.round((br.checkOut.getTime() - br.checkIn.getTime()) / 86400000)
    );

    const cursor = new Date(br.checkIn);
    while (cursor < br.checkOut) {
      const dateStr = toISO(cursor);
      if (dateSet.has(dateStr)) {
        const entry: RackEntry = {
          bookingRoomId: br.id,
          bookingRef: br.booking.bookingRef,
          guestName: br.booking.guest.name,
          status: br.booking.status,
          paidAmount: br.booking.paidAmount,
          balanceDue: br.booking.balanceDue,
          isFirst: dateStr === checkInISO,
          nights: totalNights,
        };
        (cellMap[br.roomId] ??= {});
        (cellMap[br.roomId][dateStr] ??= []).push(entry);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return { rooms: flatRooms, cellMap };
}

interface SearchParams {
  start?: string;
}

export default async function RoomRackPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let startDate = today;
  if (sp.start) {
    const parsed = new Date(sp.start);
    if (!isNaN(parsed.getTime())) startDate = parsed;
  }

  let data: Awaited<ReturnType<typeof getRackData>> = null;
  let dbError = false;

  try {
    data = await getRackData(startDate);
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

  const dates = Array.from({ length: DAYS }, (_, i) => toISO(addDays(startDate, i)));
  const prevStart = toISO(addDays(startDate, -DAYS));
  const nextStart = toISO(addDays(startDate, DAYS));
  const todayStr = toISO(today);

  if (!data || data.rooms.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-gray-900">Room Rack</h1>
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
          No active rooms found. Add rooms under Rooms to populate the rack.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Room Rack</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Click an empty cell to create a booking · click a chip to open it.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/room-rack?start=${prevStart}`}
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500"
            aria-label="Previous 14 days"
          >
            <ChevronLeft size={16} />
          </Link>
          <span className="text-sm text-gray-600 whitespace-nowrap">
            {shortDate(startDate)} – {shortDate(addDays(startDate, DAYS - 1))}
          </span>
          <Link
            href={`/admin/room-rack?start=${nextStart}`}
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500"
            aria-label="Next 14 days"
          >
            <ChevronRight size={16} />
          </Link>
          {toISO(startDate) !== todayStr && (
            <Link
              href="/admin/room-rack"
              className="text-xs px-3 py-1.5 bg-[#1a3a2a] text-white rounded-lg hover:bg-[#14301f] transition-colors"
            >
              Today
            </Link>
          )}
        </div>
      </div>

      <RoomRackGrid
        rooms={data.rooms}
        dates={dates}
        cellMap={data.cellMap}
        todayStr={todayStr}
      />
    </div>
  );
}
