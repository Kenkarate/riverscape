import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import RoomRackGrid, { type RackEntry } from "@/components/admin/room-rack-grid";

export const dynamic = "force-dynamic";

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Returns { year, month } from a "YYYY-MM" string, defaulting to current month */
function parseMonthParam(param?: string): { year: number; month: number } {
  if (param && /^\d{4}-\d{2}$/.test(param)) {
    const [y, m] = param.split("-").map(Number);
    if (m >= 1 && m <= 12) return { year: y, month: m };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function monthLabel(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

function prevMonth(year: number, month: number) {
  const d = new Date(year, month - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function nextMonth(year: number, month: number) {
  const d = new Date(year, month, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function getRackData(year: number, month: number) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1); // first day of next month
  const daysInMonth = new Date(year, month, 0).getDate();
  const dates = Array.from({ length: daysInMonth }, (_, i) => toISO(addDays(startDate, i)));
  const dateSet = new Set(dates);

  const property = await prisma.property.findFirst({ select: { id: true } });
  if (!property) return null;

  // ─── Physical rooms for the booking Gantt (ordered by type then number) ──────
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
  const roomIds = rooms.map((r) => r.id);

  const flatRooms = rooms.map((r) => ({
    id: r.id,
    number: r.number,
    floor: r.floor,
    roomTypeId: r.roomType.id,
    roomTypeName: r.roomType.name,
  }));

  const session = await auth();
  const role = (session?.user as { role?: string })?.role ?? null;

  // Booking spans pinned to a physical room (all statuses) → Gantt chips.
  const bookingRooms = roomIds.length
    ? await prisma.bookingRoom.findMany({
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
              id: true,
              bookingRef: true,
              status: true,
              adults: true,
              children: true,
              paidAmount: true,
              balanceDue: true,
              guest: { select: { name: true } },
              createdBy: { select: { name: true } },
            },
          },
        },
      })
    : [];

  // ─── Booking Gantt cellMap: roomId → date → RackEntry[] ──────────────────────
  const cellMap: Record<string, Record<string, RackEntry[]>> = {};
  for (const br of bookingRooms) {
    if (!br.roomId) continue;
    const checkInISO = toISO(br.checkIn);
    const checkOutISO = toISO(br.checkOut);
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
          bookingId: br.booking.id,
          bookingRef: br.booking.bookingRef,
          guestName: br.booking.guest.name,
          createdByName: br.booking.createdBy?.name ?? null,
          status: br.booking.status,
          adults: br.booking.adults,
          children: br.booking.children,
          paidAmount: br.booking.paidAmount,
          balanceDue: br.booking.balanceDue,
          checkIn: checkInISO,
          checkOut: checkOutISO,
          isFirst: dateStr === checkInISO,
          nights: totalNights,
        };
        (cellMap[br.roomId] ??= {});
        (cellMap[br.roomId][dateStr] ??= []).push(entry);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return { rooms: flatRooms, cellMap, role };
}

interface SearchParams {
  month?: string;
}

export default async function RoomRackPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const { year, month } = parseMonthParam(sp.month);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let data: Awaited<ReturnType<typeof getRackData>> = null;
  let dbError = false;

  try {
    data = await getRackData(year, month);
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

  const daysInMonth = new Date(year, month, 0).getDate();
  const dates = Array.from(
    { length: daysInMonth },
    (_, i) => toISO(new Date(year, month - 1, i + 1))
  );
  const todayStr = toISO(today);
  const currentMonthParam = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const thisMonthParam = `${year}-${String(month).padStart(2, "0")}`;
  const isCurrentMonth = thisMonthParam === currentMonthParam;

  if (!data || data.rooms.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-gray-900">Room Rack</h1>
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-sm font-medium text-gray-700">No rooms found</p>
          <p className="text-sm text-gray-400 mt-1">
            Add rooms in the{" "}
            <Link href="/admin/rooms" className="text-[#1a3a2a] underline underline-offset-2">
              Rooms
            </Link>{" "}
            section to populate the rack.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Room Rack</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Monthly view — click a chip to manage, or an empty cell to create a booking.
          </p>
        </div>

        {/* Month navigation */}
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/room-rack?month=${prevMonth(year, month)}`}
            className="flex items-center justify-center p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500"
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </Link>
          <span className="text-sm font-medium text-gray-700 whitespace-nowrap text-center min-w-[150px]">
            {monthLabel(year, month)}
          </span>
          <Link
            href={`/admin/room-rack?month=${nextMonth(year, month)}`}
            className="flex items-center justify-center p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500"
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </Link>
          {!isCurrentMonth && (
            <Link
              href="/admin/room-rack"
              className="text-xs px-3 py-1.5 bg-[#1a3a2a] text-white rounded-lg hover:bg-[#14301f] transition-colors whitespace-nowrap"
            >
              This Month
            </Link>
          )}
        </div>
      </div>

      <RoomRackGrid
        rooms={data.rooms}
        dates={dates}
        cellMap={data.cellMap}
        role={data.role}
        todayStr={todayStr}
      />
    </div>
  );
}
