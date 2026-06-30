import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
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

// ─── Shapes shared with the client grid ───────────────────────────────────────
export interface InventoryCell {
  total: number;
  booked: number;
  blocked: number;
  stopSell: boolean;
}

async function getUnifiedRackData(startDate: Date) {
  const endDate = addDays(startDate, DAYS);
  const dates = Array.from({ length: DAYS }, (_, i) => toISO(addDays(startDate, i)));
  const dateSet = new Set(dates);

  // Property + its active room types (with unit counts) drive the inventory section.
  const property = await prisma.property.findFirst({
    include: {
      roomTypes: {
        where: { isActive: true },
        include: { rooms: { where: { isActive: true }, select: { id: true } } },
        orderBy: { name: "asc" },
      },
    },
  });
  if (!property) return null;

  const roomTypeIds = property.roomTypes.map((rt) => rt.id);

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

  // ─── Parallel reads for the rest of the window ───────────────────────────────
  const session = await auth();
  const userId = session?.user?.id;
  const role = (session?.user as { role?: string })?.role ?? null;

  const [bookingRoomsForRooms, inventoryRows, bookingRoomsByType, salesAllocations, dbUser] =
    await Promise.all([
      // Booking spans pinned to a physical room (all statuses) → Gantt chips.
      roomIds.length
        ? prisma.bookingRoom.findMany({
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
                  guest: { select: { name: true } },
                },
              },
            },
          })
        : Promise.resolve([]),
      // Daily inventory overrides (total / blocked / stop-sell).
      roomTypeIds.length
        ? prisma.dailyInventory.findMany({
            where: { roomTypeId: { in: roomTypeIds }, date: { gte: startDate, lt: endDate } },
          })
        : Promise.resolve([]),
      // Confirmed/checked-in spans per room type → booked counts.
      roomTypeIds.length
        ? prisma.bookingRoom.findMany({
            where: {
              roomTypeId: { in: roomTypeIds },
              checkIn: { lt: endDate },
              checkOut: { gt: startDate },
              booking: { status: { in: ["CONFIRMED", "CHECKED_IN"] } },
            },
            select: { roomTypeId: true, checkIn: true, checkOut: true },
          })
        : Promise.resolve([]),
      // Active sales allocations overlapping the window.
      prisma.salesAllocation.findMany({
        where: {
          propertyId: property.id,
          status: "ACTIVE",
          checkIn: { lt: endDate },
          checkOut: { gt: startDate },
        },
        include: { createdBy: { select: { id: true, name: true, salesColor: true } } },
        orderBy: { checkIn: "asc" },
      }),
      userId
        ? prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, salesColor: true, colorLocked: true },
          })
        : Promise.resolve(null),
    ]);

  // ─── Booking Gantt cellMap: roomId → date → RackEntry[] ──────────────────────
  const cellMap: Record<string, Record<string, RackEntry[]>> = {};
  for (const br of bookingRoomsForRooms) {
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

  // ─── Inventory map: roomTypeId → date → InventoryCell ────────────────────────
  const inventoryMap: Record<string, Record<string, InventoryCell>> = {};
  for (const rt of property.roomTypes) {
    inventoryMap[rt.id] = {};
    const totalRooms = rt.rooms.length;
    for (const date of dates) {
      inventoryMap[rt.id][date] = {
        total: totalRooms,
        booked: 0,
        blocked: 0,
        stopSell: false,
      };
    }
  }
  for (const row of inventoryRows) {
    const dateStr = toISO(row.date);
    const cell = inventoryMap[row.roomTypeId]?.[dateStr];
    if (cell) {
      cell.total = row.totalUnits;
      cell.blocked = row.blockedUnits;
      cell.stopSell = row.stopSell;
    }
  }
  for (const br of bookingRoomsByType) {
    const cursor = new Date(br.checkIn);
    while (cursor < br.checkOut) {
      const dateStr = toISO(cursor);
      const cell = inventoryMap[br.roomTypeId]?.[dateStr];
      if (cell) cell.booked += 1;
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  // ─── Sales allocation map + flat list ────────────────────────────────────────
  type AllocChip = {
    id: string;
    units: number;
    label: string | null;
    createdBy: { id: string; name: string | null; salesColor: string | null } | null;
  };

  const allocMap: Record<string, Record<string, AllocChip[]>> = {};
  for (const rt of property.roomTypes) {
    allocMap[rt.id] = {};
    for (const date of dates) allocMap[rt.id][date] = [];
  }
  for (const alloc of salesAllocations) {
    const chip: AllocChip = {
      id: alloc.id,
      units: alloc.units,
      label: alloc.label,
      createdBy: alloc.createdBy,
    };
    const cursor = new Date(alloc.checkIn);
    while (cursor < alloc.checkOut) {
      const dateStr = toISO(cursor);
      if (allocMap[alloc.roomTypeId]?.[dateStr]) {
        allocMap[alloc.roomTypeId][dateStr].push(chip);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  const rtNameById = new Map(property.roomTypes.map((rt) => [rt.id, rt.name]));
  const allocations = salesAllocations.map((a) => ({
    id: a.id,
    roomTypeId: a.roomTypeId,
    roomTypeName: rtNameById.get(a.roomTypeId) ?? "—",
    checkIn: toISO(a.checkIn),
    checkOut: toISO(a.checkOut),
    units: a.units,
    label: a.label,
    createdBy: a.createdBy,
  }));

  const roomTypes = property.roomTypes.map((rt) => ({
    id: rt.id,
    name: rt.name,
    unitCount: rt.rooms.length,
  }));

  const currentUser = dbUser
    ? { id: dbUser.id, name: dbUser.name, salesColor: dbUser.salesColor, role }
    : null;
  const colorLocked = dbUser?.colorLocked ?? false;

  return {
    rooms: flatRooms,
    roomTypes,
    cellMap,
    inventoryMap,
    allocMap,
    allocations,
    currentUser,
    colorLocked,
  };
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

  let data: Awaited<ReturnType<typeof getUnifiedRackData>> = null;
  let dbError = false;

  try {
    data = await getUnifiedRackData(startDate);
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

  const hasContent = data && (data.rooms.length > 0 || data.roomTypes.length > 0);

  if (!hasContent) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-gray-900">Allocation &amp; Room Rack</h1>
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
          <h1 className="text-xl font-semibold text-gray-900">Allocation &amp; Room Rack</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Live availability, sales allocations and the physical room booking rack.
          </p>
        </div>

        {/* Date navigation — full-width row on mobile, inline on desktop */}
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/room-rack?start=${prevStart}`}
            className="flex-1 sm:flex-none flex items-center justify-center p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500"
            aria-label="Previous period"
          >
            <ChevronLeft size={16} />
          </Link>
          <span className="text-sm text-gray-600 whitespace-nowrap text-center min-w-[130px]">
            {shortDate(startDate)} – {shortDate(addDays(startDate, DAYS - 1))}
          </span>
          <Link
            href={`/admin/room-rack?start=${nextStart}`}
            className="flex-1 sm:flex-none flex items-center justify-center p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500"
            aria-label="Next period"
          >
            <ChevronRight size={16} />
          </Link>
          {toISO(startDate) !== todayStr && (
            <Link
              href="/admin/room-rack"
              className="text-xs px-3 py-1.5 bg-[#1a3a2a] text-white rounded-lg hover:bg-[#14301f] transition-colors whitespace-nowrap"
            >
              Today
            </Link>
          )}
        </div>
      </div>

      <RoomRackGrid
        rooms={data!.rooms}
        roomTypes={data!.roomTypes}
        dates={dates}
        cellMap={data!.cellMap}
        inventoryMap={data!.inventoryMap}
        allocMap={data!.allocMap}
        allocations={data!.allocations}
        currentUser={data!.currentUser}
        colorLocked={data!.colorLocked}
        todayStr={todayStr}
      />
    </div>
  );
}
