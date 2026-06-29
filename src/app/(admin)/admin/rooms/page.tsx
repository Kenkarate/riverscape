import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { AlertCircle, Users, BedDouble } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatINR } from "@/lib/pricing";
import { housekeepingBadge } from "@/lib/badges";
import HousekeepingSelect from "@/components/admin/housekeeping-select";
import MaintenanceBlockForm from "@/components/admin/maintenance-block-form";
import MaintenanceBlockResolve from "@/components/admin/maintenance-block-resolve";
import AddRoomPanel from "@/components/admin/add-room-panel";
import EditRoomPanel from "@/components/admin/edit-room-panel";
import DeactivateRoomButton from "@/components/admin/deactivate-room-button";
import ReactivateRoomButton from "@/components/admin/reactivate-room-button";
import AddRoomTypePanel from "@/components/admin/add-room-type-panel";
import EditRoomTypePanel from "@/components/admin/edit-room-type-panel";
import DeactivateRoomTypeButton from "@/components/admin/deactivate-room-type-button";
import ReactivateRoomTypeButton from "@/components/admin/reactivate-room-type-button";

export const dynamic = "force-dynamic";

async function getData() {
  const property = await prisma.property.findUniqueOrThrow({
    where: { slug: "riverscape" },
  });

  const [rooms, roomTypes] = await Promise.all([
    prisma.room.findMany({
      where: { propertyId: property.id },
      include: {
        roomType: { select: { id: true, name: true, slug: true } },
        maintenanceBlocks: {
          where: { status: "ACTIVE" },
          select: { id: true, reason: true, startDate: true, endDate: true },
          orderBy: { startDate: "asc" },
        },
      },
      orderBy: [{ roomType: { name: "asc" } }, { number: "asc" }],
    }),
    prisma.roomType.findMany({
      where: { propertyId: property.id },
      include: { _count: { select: { rooms: { where: { isActive: true } } } } },
      orderBy: { name: "asc" },
    }),
  ]);

  return { rooms, roomTypes, propertyId: property.id };
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export default async function RoomsPage() {
  const session = await auth();
  const role = session?.user?.role ?? "STAFF";
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";

  let data: Awaited<ReturnType<typeof getData>> | null = null;
  let dbError = false;

  try {
    data = await getData();
  } catch {
    dbError = true;
  }

  if (dbError || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-gray-500">
          <AlertCircle className="mx-auto mb-2 text-amber-500" size={32} />
          <p className="font-medium">Database not connected</p>
          <p className="text-sm mt-1">
            Add your DATABASE_URL to .env.local and run migrations.
          </p>
        </div>
      </div>
    );
  }

  const { rooms, roomTypes } = data;

  // Dropdown options for the room forms — only active types can be assigned.
  const roomTypeOptions = roomTypes
    .filter((rt) => rt.isActive)
    .map((rt) => ({ id: rt.id, name: rt.name }));

  const activeRooms = rooms.filter((r) => r.isActive);

  // Group all rooms (active + inactive) by room type name.
  const grouped = rooms.reduce(
    (acc, room) => {
      const key = room.roomType.name;
      if (!acc[key]) acc[key] = [];
      acc[key].push(room);
      return acc;
    },
    {} as Record<string, typeof rooms>
  );

  // Status summary is computed from active rooms only.
  const statusCounts = {
    CLEAN: activeRooms.filter((r) => r.housekeeping === "CLEAN").length,
    DIRTY: activeRooms.filter((r) => r.housekeeping === "DIRTY").length,
    INSPECTED: activeRooms.filter((r) => r.housekeeping === "INSPECTED").length,
    OUT_OF_ORDER: activeRooms.filter((r) => r.housekeeping === "OUT_OF_ORDER")
      .length,
  };

  return (
    <div className="space-y-12">
      {/* ─── Rooms ──────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Rooms</h1>
          <span className="text-sm text-gray-400">
            {activeRooms.length} active · {rooms.length} total
          </span>
        </div>

        {isAdmin && <AddRoomPanel roomTypes={roomTypeOptions} />}

        {/* Status summary (active rooms only) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(
            [
              { key: "CLEAN", label: "Clean", color: "text-green-700", bg: "bg-green-50" },
              { key: "DIRTY", label: "Dirty", color: "text-amber-700", bg: "bg-amber-50" },
              { key: "INSPECTED", label: "Inspected", color: "text-blue-700", bg: "bg-blue-50" },
              { key: "OUT_OF_ORDER", label: "Out of Order", color: "text-red-700", bg: "bg-red-50" },
            ] as const
          ).map((s) => (
            <div key={s.key} className={`${s.bg} rounded-xl p-3 text-center`}>
              <div className={`text-2xl font-semibold ${s.color}`}>
                {statusCounts[s.key]}
              </div>
              <div className={`text-xs ${s.color} mt-0.5`}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Room list grouped by type */}
        {Object.entries(grouped).map(([typeName, typeRooms]) => (
          <div
            key={typeName}
            className="bg-white rounded-xl border border-gray-200 overflow-hidden"
          >
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
              <h2 className="font-medium text-gray-700 text-sm">{typeName}</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {typeRooms.map((room) => {
                const badge = housekeepingBadge[room.housekeeping];
                return (
                  <div key={room.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div
                          className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center font-mono font-semibold text-sm",
                            room.isActive
                              ? "bg-gray-100 text-gray-700"
                              : "bg-gray-50 text-gray-400"
                          )}
                        >
                          {room.number}
                        </div>
                        <div>
                          <div
                            className={cn(
                              "text-sm font-medium",
                              room.isActive
                                ? "text-gray-900"
                                : "text-gray-400 line-through"
                            )}
                          >
                            Room {room.number}
                            {room.floor && (
                              <span className="text-xs text-gray-400 ml-1.5 no-underline">
                                Floor {room.floor}
                              </span>
                            )}
                          </div>
                          {room.notes && (
                            <div className="text-xs text-gray-400 mt-0.5">
                              {room.notes}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {room.isActive ? (
                          <>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                            <HousekeepingSelect
                              roomId={room.id}
                              current={room.housekeeping}
                            />
                            {isAdmin && (
                              <DeactivateRoomButton
                                roomId={room.id}
                                roomNumber={room.number}
                              />
                            )}
                          </>
                        ) : (
                          <>
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500">
                              Inactive
                            </span>
                            {isAdmin && (
                              <ReactivateRoomButton roomId={room.id} />
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Edit + maintenance controls */}
                    <div className="mt-2 pl-14 space-y-1.5">
                      {isAdmin && (
                        <EditRoomPanel
                          room={{
                            id: room.id,
                            number: room.number,
                            floor: room.floor,
                            notes: room.notes,
                            roomTypeId: room.roomType.id,
                          }}
                          roomTypes={roomTypeOptions}
                        />
                      )}

                      {room.isActive && (
                        <>
                          {room.maintenanceBlocks.map((block) => (
                            <div
                              key={block.id}
                              className="flex items-center justify-between gap-3 rounded-lg bg-red-50/60 px-2.5 py-1.5"
                            >
                              <span className="text-xs text-red-600">
                                Maintenance: {block.reason} (
                                {formatDate(block.startDate)}–
                                {formatDate(block.endDate)})
                              </span>
                              <MaintenanceBlockResolve blockId={block.id} />
                            </div>
                          ))}
                          <MaintenanceBlockForm roomId={room.id} />
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {rooms.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
            No rooms found. {isAdmin ? "Add a room to get started." : "Seed the database to get started."}
          </div>
        )}
      </section>

      {/* ─── Room Types ─────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Room Types</h2>
          <span className="text-sm text-gray-400">
            {roomTypes.length} type{roomTypes.length === 1 ? "" : "s"}
          </span>
        </div>

        {isAdmin && <AddRoomTypePanel />}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {roomTypes.map((rt) => (
            <div
              key={rt.id}
              className={cn(
                "bg-white rounded-xl border border-gray-200 p-5",
                !rt.isActive && "opacity-70"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3
                    className={cn(
                      "font-medium text-gray-900 truncate",
                      !rt.isActive && "line-through text-gray-500"
                    )}
                  >
                    {rt.name}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5 font-mono">
                    {rt.slug}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 text-xs px-2 py-0.5 rounded-full font-medium",
                    rt.isActive
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  )}
                >
                  {rt.isActive ? "Active" : "Inactive"}
                </span>
              </div>

              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-lg font-semibold text-[#1a3a2a]">
                  {formatINR(rt.basePrice)}
                </span>
                <span className="text-xs text-gray-400">/ night</span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                <div className="flex items-center gap-1.5">
                  <Users size={13} className="text-gray-400" />
                  Sleeps {rt.baseOccupancy}
                </div>
                <div className="flex items-center gap-1.5">
                  <BedDouble size={13} className="text-gray-400" />
                  {rt._count.rooms} room{rt._count.rooms === 1 ? "" : "s"}
                </div>
                <div>
                  Max {rt.maxAdults} adult{rt.maxAdults === 1 ? "" : "s"}
                </div>
                <div>
                  Max {rt.maxChildren} child{rt.maxChildren === 1 ? "" : "ren"}
                </div>
                <div className="col-span-2 text-gray-500">
                  {rt.extraBedAllowed
                    ? `Extra beds allowed (up to ${rt.maxExtraBeds})`
                    : "No extra beds"}
                </div>
              </div>

              {isAdmin && (
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                  <EditRoomTypePanel
                    roomType={{
                      id: rt.id,
                      name: rt.name,
                      slug: rt.slug,
                      description: rt.description,
                      basePrice: rt.basePrice,
                      baseOccupancy: rt.baseOccupancy,
                      maxAdults: rt.maxAdults,
                      maxChildren: rt.maxChildren,
                      extraBedAllowed: rt.extraBedAllowed,
                      maxExtraBeds: rt.maxExtraBeds,
                    }}
                  />
                  {rt.isActive ? (
                    <DeactivateRoomTypeButton
                      roomTypeId={rt.id}
                      roomTypeName={rt.name}
                    />
                  ) : (
                    <ReactivateRoomTypeButton roomTypeId={rt.id} />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {roomTypes.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
            No room types yet.{" "}
            {isAdmin ? "Add a room type to get started." : "Seed the database to get started."}
          </div>
        )}
      </section>
    </div>
  );
}
