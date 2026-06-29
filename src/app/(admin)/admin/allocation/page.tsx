import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import AllocationGrid from "@/components/admin/allocation-grid";

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

async function getAllocationData(startDate: Date) {
  const endDate = addDays(startDate, DAYS);

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

  // Fetch daily inventory records for the date window
  const inventoryRows = await prisma.dailyInventory.findMany({
    where: {
      roomTypeId: { in: roomTypeIds },
      date: { gte: startDate, lt: endDate },
    },
  });

  // Fetch booking counts per room type per night in range
  const bookingRooms = await prisma.bookingRoom.findMany({
    where: {
      roomTypeId: { in: roomTypeIds },
      checkIn: { lt: endDate },
      checkOut: { gt: startDate },
      booking: { status: { in: ["CONFIRMED", "CHECKED_IN"] } },
    },
    select: { roomTypeId: true, checkIn: true, checkOut: true },
  });

  // Build a map: roomTypeId → date → { total, booked, blocked, stopSell }
  type CellData = { total: number; booked: number; blocked: number; stopSell: boolean };
  const cellMap: Record<string, Record<string, CellData>> = {};

  for (const rt of property.roomTypes) {
    cellMap[rt.id] = {};
    const totalRooms = rt.rooms.length;
    for (let i = 0; i < DAYS; i++) {
      const date = toISO(addDays(startDate, i));
      cellMap[rt.id][date] = {
        total: totalRooms,
        booked: 0,
        blocked: 0,
        stopSell: false,
      };
    }
  }

  // Fill from DailyInventory (overrides total if record exists)
  for (const row of inventoryRows) {
    const dateStr = toISO(row.date);
    if (cellMap[row.roomTypeId]?.[dateStr]) {
      cellMap[row.roomTypeId][dateStr].total = row.totalUnits;
      cellMap[row.roomTypeId][dateStr].blocked = row.blockedUnits;
      cellMap[row.roomTypeId][dateStr].stopSell = row.stopSell;
    }
  }

  // Fill booked count from BookingRoom spans
  for (const br of bookingRooms) {
    const ciDate = new Date(br.checkIn);
    const coDate = new Date(br.checkOut);
    const cursor = new Date(ciDate);
    while (cursor < coDate) {
      const dateStr = toISO(cursor);
      if (cellMap[br.roomTypeId]?.[dateStr]) {
        cellMap[br.roomTypeId][dateStr].booked += 1;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  // ─── Current user (for color picker + release permissions) ──────────────────
  const session = await auth();
  const userId = session?.user?.id;
  const role = (session?.user as { role?: string })?.role ?? null;

  const dbUser = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, salesColor: true },
      })
    : null;
  const currentUser = dbUser ? { ...dbUser, role } : null;

  // ─── Active sales allocations for the window ────────────────────────────────
  const salesAllocations = await prisma.salesAllocation.findMany({
    where: {
      propertyId: property.id,
      status: "ACTIVE",
      checkIn: { lt: endDate },
      checkOut: { gt: startDate },
    },
    include: {
      createdBy: { select: { id: true, name: true, salesColor: true } },
    },
    orderBy: { checkIn: "asc" },
  });

  type AllocChip = {
    id: string;
    units: number;
    label: string | null;
    createdBy: { id: string; name: string | null; salesColor: string | null } | null;
  };

  // Build a per-cell allocation map: roomTypeId → dateStr → AllocChip[]
  const allocMap: Record<string, Record<string, AllocChip[]>> = {};
  for (const rt of property.roomTypes) {
    allocMap[rt.id] = {};
    for (let i = 0; i < DAYS; i++) {
      allocMap[rt.id][toISO(addDays(startDate, i))] = [];
    }
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

  // Flat list for the "Active Allocations" table below the grid
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
    rooms: rt.rooms.map((r) => ({ id: r.id })),
  }));

  return { roomTypes, cellMap, allocMap, allocations, currentUser };
}

interface SearchParams {
  start?: string;
}

export default async function AllocationPage({
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

  let data: Awaited<ReturnType<typeof getAllocationData>> = null;
  let dbError = false;

  try {
    data = await getAllocationData(startDate);
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

  if (!data || data.roomTypes.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-gray-900">Allocation Chart</h1>
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
          No room types found. Seed the database to get started.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Allocation Chart</h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/allocation?start=${prevStart}`}
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500"
          >
            <ChevronLeft size={16} />
          </Link>
          <span className="text-sm text-gray-600">
            {shortDate(startDate)} – {shortDate(addDays(startDate, DAYS - 1))}
          </span>
          <Link
            href={`/admin/allocation?start=${nextStart}`}
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500"
          >
            <ChevronRight size={16} />
          </Link>
          {toISO(startDate) !== todayStr && (
            <Link
              href="/admin/allocation"
              className="text-xs px-3 py-1.5 bg-[#1a3a2a] text-white rounded-lg hover:bg-[#14301f] transition-colors"
            >
              Today
            </Link>
          )}
        </div>
      </div>

      <AllocationGrid
        roomTypes={data.roomTypes}
        dates={dates}
        cellMap={data.cellMap}
        allocMap={data.allocMap}
        allocations={data.allocations}
        currentUser={data.currentUser}
        todayStr={todayStr}
      />
    </div>
  );
}
