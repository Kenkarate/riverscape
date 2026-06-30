"use client";

import { Fragment, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Lock,
  Plus,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatINR } from "@/lib/pricing";
import { createRackBooking } from "@/app/(admin)/admin/room-rack/actions";
import {
  createSalesAllocation,
  releaseSalesAllocation,
  updateUserColor,
} from "@/app/(admin)/admin/allocation/actions";
import { SALES_COLOR_PALETTE, SALES_COLOR_DEFAULT } from "@/lib/sales-colors";
import type { BookingStatus } from "@prisma/client";

// ─── Shared entry shape (also consumed by the server page) ────────────────────
export interface RackEntry {
  bookingRoomId: string;
  bookingRef: string;
  guestName: string;
  status: BookingStatus;
  paidAmount: number;
  balanceDue: number;
  isFirst: boolean; // true on the check-in night → render the labelled chip
  nights: number; // total nights of the stay (tooltip)
}

interface RackRoom {
  id: string;
  number: string;
  floor: string | null;
  roomTypeId: string;
  roomTypeName: string;
}

interface RoomTypeSummary {
  id: string;
  name: string;
  unitCount: number;
}

interface InventoryCell {
  total: number;
  booked: number;
  blocked: number;
  stopSell: boolean;
}

interface AllocChip {
  id: string;
  units: number;
  label: string | null;
  createdBy: { id: string; name: string | null; salesColor: string | null } | null;
}

interface AllocationRow {
  id: string;
  roomTypeId: string;
  roomTypeName: string;
  checkIn: string;
  checkOut: string;
  units: number;
  label: string | null;
  createdBy: { id: string; name: string | null; salesColor: string | null } | null;
}

interface CurrentUser {
  id: string;
  name: string | null;
  salesColor: string | null;
  role: string | null;
}

interface Props {
  rooms: RackRoom[]; // flat, pre-ordered by roomType name then number
  roomTypes: RoomTypeSummary[];
  dates: string[]; // 14 ISO date strings
  cellMap: Record<string, Record<string, RackEntry[]>>; // booking gantt
  inventoryMap: Record<string, Record<string, InventoryCell>>;
  allocMap: Record<string, Record<string, AllocChip[]>>;
  allocations: AllocationRow[];
  currentUser: CurrentUser | null;
  colorLocked: boolean;
  todayStr: string;
}

type Tone = "green" | "blue" | "amber" | "gray";

const TONE_CHIP: Record<Tone, string> = {
  green: "bg-green-100 text-green-800 border border-green-200",
  blue: "bg-blue-100 text-blue-700 border border-blue-200",
  amber: "bg-amber-100 text-amber-800 border border-amber-200",
  gray: "bg-gray-100 text-gray-500 border border-gray-200",
};

const TONE_DOT: Record<Tone, string> = {
  green: "bg-green-500",
  blue: "bg-blue-500",
  amber: "bg-amber-500",
  gray: "bg-gray-400",
};

const TONE_BAR: Record<Tone, string> = {
  green: "bg-green-300",
  blue: "bg-blue-300",
  amber: "bg-amber-300",
  gray: "bg-gray-300",
};

// Colour is derived from payment status, per spec.
function toneFor(e: RackEntry): Tone {
  if (e.status === "CANCELLED" || e.status === "NO_SHOW") return "gray";
  if (e.balanceDue === 0) return "green";
  if (e.paidAmount > 0 && e.balanceDue > 0) return "blue";
  return "amber"; // paidAmount === 0, not cancelled
}

// First letter of the room type for the compact mobile room label (e.g. "D").
function typeInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

// ─── Local-time date helpers (avoid UTC drift on display) ─────────────────────
function parseLocal(iso: string) {
  return new Date(iso + "T00:00:00");
}
function toLocalISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function nextISO(iso: string) {
  const d = parseLocal(iso);
  d.setDate(d.getDate() + 1);
  return toLocalISO(d);
}
function dayLabel(iso: string) {
  return parseLocal(iso).toLocaleDateString("en-IN", { weekday: "short" });
}
function dayNum(iso: string) {
  return parseLocal(iso).getDate();
}
function isWeekend(iso: string) {
  const g = parseLocal(iso).getDay();
  return g === 0 || g === 6;
}
function fmtDate(iso: string) {
  return parseLocal(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

// Progressive disclosure of columns: 7 on mobile, 10 on tablet, 14 on desktop.
function colVisibility(i: number) {
  if (i < 7) return "";
  if (i < 10) return "hidden md:table-cell";
  return "hidden lg:table-cell";
}

const SOURCE_OPTIONS = [
  { value: "DIRECT", label: "Direct" },
  { value: "WALK_IN", label: "Walk-in" },
  { value: "PHONE", label: "Phone" },
];
const PAYMENT_METHODS = ["Cash", "Card", "UPI", "Online", "None"] as const;

const STAFF_ROLES = ["STAFF", "ADMIN", "SUPER_ADMIN"];
const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

type Panel =
  | {
      kind: "booking";
      roomId: string;
      roomNumber: string;
      roomTypeName: string;
      checkIn: string;
    }
  | { kind: "alloc"; roomTypeId: string; roomTypeName: string; checkIn: string };

export default function RoomRackGrid({
  rooms,
  roomTypes,
  dates,
  cellMap,
  inventoryMap,
  allocMap,
  allocations,
  currentUser,
  colorLocked,
  todayStr,
}: Props) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);

  const role = currentUser?.role ?? null;
  const isStaff = !!role && STAFF_ROLES.includes(role);
  const isAdmin = !!role && ADMIN_ROLES.includes(role);
  // Everyone who reaches this admin page may allocate (SALES + staff).
  const canAllocate = !!currentUser;

  // ── Panel (booking OR allocation) ───────────────────────────────────────────
  const [panel, setPanel] = useState<Panel | null>(null);
  const [entered, setEntered] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(true);

  // booking form
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [adults, setAdults] = useState(2);
  const [source, setSource] = useState("WALK_IN");
  const [paymentMethod, setPaymentMethod] = useState("None");
  const [amount, setAmount] = useState("");
  const [successRef, setSuccessRef] = useState<string | null>(null);

  // allocation form
  const [units, setUnits] = useState(1);
  const [label, setLabel] = useState("");

  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isColorPending, startColor] = useTransition();
  const [releasingId, setReleasingId] = useState<string | null>(null);
  const [, startRelease] = useTransition();

  function playEnter() {
    setEntered(false);
    requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)));
  }

  function openBookingPanel(room: RackRoom, dateStr: string) {
    setPanel({
      kind: "booking",
      roomId: room.id,
      roomNumber: room.number,
      roomTypeName: room.roomTypeName,
      checkIn: dateStr,
    });
    setCheckIn(dateStr);
    setCheckOut(nextISO(dateStr));
    setGuestName("");
    setGuestPhone("");
    setAdults(2);
    setSource("WALK_IN");
    setPaymentMethod("None");
    setAmount("");
    setSuccessRef(null);
    setFormError(null);
    playEnter();
  }

  function openAllocPanel(rt: { id: string; name: string }, dateStr: string) {
    setPanel({
      kind: "alloc",
      roomTypeId: rt.id,
      roomTypeName: rt.name,
      checkIn: dateStr,
    });
    setCheckIn(dateStr);
    setCheckOut(nextISO(dateStr));
    setUnits(1);
    setLabel("");
    setFormError(null);
    playEnter();
  }

  function closePanel() {
    setEntered(false);
    setTimeout(() => {
      setPanel(null);
      setFormError(null);
      setSuccessRef(null);
    }, 200);
  }

  function openBooking(ref: string) {
    router.push(`/admin/bookings/${ref}`);
  }

  function handleCheckInChange(value: string) {
    setCheckIn(value);
    if (parseLocal(value) >= parseLocal(checkOut)) {
      setCheckOut(nextISO(value));
    }
  }

  function handleBookingSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!panel || panel.kind !== "booking") return;
    setFormError(null);

    if (!guestName.trim()) {
      setFormError("Guest name is required.");
      return;
    }
    const cleanPhone = guestPhone.replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      setFormError("Enter a valid 10-digit Indian mobile number.");
      return;
    }
    if (parseLocal(checkOut) <= parseLocal(checkIn)) {
      setFormError("Check-out must be after check-in.");
      return;
    }
    const payAmount = paymentMethod === "None" ? 0 : Number(amount || 0);
    if (paymentMethod !== "None" && (Number.isNaN(payAmount) || payAmount < 0)) {
      setFormError("Enter a valid payment amount.");
      return;
    }

    startTransition(async () => {
      const res = await createRackBooking({
        roomId: panel.roomId,
        checkIn,
        checkOut,
        guestName: guestName.trim(),
        guestPhone: cleanPhone,
        adults,
        source,
        paymentMethod,
        amountRupees: payAmount,
      });
      if (res.success && res.bookingRef) {
        setSuccessRef(res.bookingRef);
        router.refresh();
        setTimeout(() => closePanel(), 2000);
      } else {
        setFormError(res.error ?? "Could not create booking.");
      }
    });
  }

  function handleAllocSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!panel || panel.kind !== "alloc") return;
    setFormError(null);

    if (parseLocal(checkOut) <= parseLocal(checkIn)) {
      setFormError("Check-out must be after check-in.");
      return;
    }
    if (units < 1) {
      setFormError("Units must be at least 1.");
      return;
    }

    startTransition(async () => {
      try {
        await createSalesAllocation({
          roomTypeId: panel.roomTypeId,
          checkIn,
          checkOut,
          units,
          label: label.trim() || undefined,
        });
        router.refresh();
        closePanel();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Failed to create allocation.");
      }
    });
  }

  function handlePickColor(hex: string) {
    startColor(async () => {
      try {
        await updateUserColor(hex);
        router.refresh();
      } catch {
        /* validation is enforced server-side; ignore client errors */
      }
    });
  }

  function handleRelease(id: string) {
    setReleasingId(id);
    startRelease(async () => {
      try {
        await releaseSalesAllocation(id);
        router.refresh();
      } catch {
        /* server enforces permissions */
      } finally {
        setReleasingId(null);
      }
    });
  }

  function canReleaseRow(alloc: AllocationRow) {
    if (!currentUser) return false;
    return isAdmin || alloc.createdBy?.id === currentUser.id;
  }

  // Unique staff colours present in the active allocations → legend.
  const allocLegend = Array.from(
    new Map(
      allocations
        .filter((a) => a.createdBy)
        .map((a) => [
          a.createdBy!.id,
          {
            name: a.createdBy!.name ?? "Staff",
            color: a.createdBy!.salesColor ?? SALES_COLOR_DEFAULT,
          },
        ])
    ).values()
  );

  const totalCols = dates.length + 1;

  return (
    <div className="space-y-4">
      {/* ─── Top strip: Your Color + payment legend ───────────────────────────── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {currentUser ? (
          <div className="flex flex-wrap items-center gap-2 bg-white rounded-xl border border-gray-200 px-3 py-2">
            <span className="text-xs font-medium text-gray-500">Your colour</span>
            <span className="flex items-center gap-1.5 text-xs text-gray-600">
              <span
                className="w-3.5 h-3.5 rounded-full inline-block ring-1 ring-black/10"
                style={{ backgroundColor: currentUser.salesColor ?? SALES_COLOR_DEFAULT }}
              />
              {currentUser.name ?? "You"}
            </span>
            {colorLocked ? (
              <span className="flex items-center gap-1 text-[11px] text-gray-400">
                <Lock size={11} /> locked
              </span>
            ) : (
              <div className="flex items-center gap-1">
                {SALES_COLOR_PALETTE.map((hex) => {
                  const active = currentUser.salesColor?.toLowerCase() === hex.toLowerCase();
                  return (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => handlePickColor(hex)}
                      disabled={isColorPending}
                      aria-label={`Set colour ${hex}`}
                      title={hex}
                      className={cn(
                        "w-5 h-5 rounded-full inline-flex items-center justify-center transition-transform hover:scale-110 disabled:opacity-50",
                        active ? "ring-2 ring-offset-1 ring-gray-800" : "ring-1 ring-black/10"
                      )}
                      style={{ backgroundColor: hex }}
                    >
                      {active && <Check size={11} className="text-white" />}
                    </button>
                  );
                })}
                {isColorPending && <Loader2 size={13} className="animate-spin text-gray-400" />}
              </div>
            )}
          </div>
        ) : (
          <div />
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 bg-white rounded-xl border border-gray-200 px-3 py-2 text-[11px] text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> Fully paid
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> Advance
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Pending
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-gray-400 inline-block" /> Cancelled
          </span>
          {allocLegend.length > 0 && (
            <span className="w-px h-3 bg-gray-200 hidden sm:inline-block" />
          )}
          {allocLegend.map((u) => (
            <span key={u.name + u.color} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block ring-1 ring-black/5"
                style={{ backgroundColor: u.color }}
              />
              {u.name}
            </span>
          ))}
        </div>
      </div>

      {/* ─── Unified scrollable grid ──────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div ref={scrollRef} className="overflow-auto max-h-[calc(100vh-220px)]">
          <table className="w-full text-xs border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-30 bg-gray-50 px-2 sm:px-3 py-2.5 text-left font-medium text-gray-500 whitespace-nowrap min-w-[112px] sm:min-w-[160px] border-b border-r border-gray-200">
                  Room
                </th>
                {dates.map((iso, i) => {
                  const today = iso === todayStr;
                  const weekend = isWeekend(iso);
                  return (
                    <th
                      key={iso}
                      className={cn(
                        "sticky top-0 z-20 px-1 py-2 text-center font-medium w-[64px] min-w-[64px] sm:w-[80px] sm:min-w-[80px] border-b border-r border-gray-100",
                        today
                          ? "bg-amber-100 text-[#1a3a2a]"
                          : weekend
                          ? "bg-gray-50 text-gray-500"
                          : "bg-gray-50 text-gray-500",
                        colVisibility(i)
                      )}
                    >
                      <div>{dayLabel(iso)}</div>
                      <div
                        className={cn(
                          "font-semibold",
                          today ? "text-[#1a3a2a]" : "text-gray-700"
                        )}
                      >
                        {dayNum(iso)}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {/* ─── Availability & Sales Allocation section ──────────────────── */}
              {roomTypes.length > 0 && (
                <tr>
                  <td
                    colSpan={totalCols}
                    className="sticky left-0 bg-[#1a3a2a] text-white px-3 py-1.5 border-b border-[#14301f]"
                  >
                    <button
                      type="button"
                      onClick={() => setInventoryOpen((o) => !o)}
                      className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide"
                      aria-expanded={inventoryOpen}
                    >
                      <ChevronDown
                        size={13}
                        className={cn("transition-transform", inventoryOpen ? "" : "-rotate-90")}
                      />
                      Availability &amp; Sales Allocation
                    </button>
                  </td>
                </tr>
              )}

              {inventoryOpen &&
                roomTypes.map((rt) => (
                  <tr key={`inv-${rt.id}`} className="group/row">
                    <td className="sticky left-0 z-10 bg-white px-2 sm:px-3 py-2 whitespace-nowrap border-b border-r border-gray-100 group-hover/row:bg-gray-50">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium text-gray-800 truncate max-w-[90px] sm:max-w-none">
                            {rt.name}
                          </div>
                          <div className="text-[11px] text-gray-400 font-normal">
                            {rt.unitCount} unit{rt.unitCount !== 1 ? "s" : ""}
                          </div>
                        </div>
                        {canAllocate && (
                          <button
                            type="button"
                            onClick={() =>
                              openAllocPanel({ id: rt.id, name: rt.name }, dates[0])
                            }
                            title={`Allocate ${rt.name}`}
                            className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-1 rounded-md border border-[#1a3a2a]/20 text-[#1a3a2a] hover:bg-[#1a3a2a]/5 transition-colors"
                          >
                            <Plus size={11} />
                            <span className="hidden sm:inline">Allocate</span>
                          </button>
                        )}
                      </div>
                    </td>
                    {dates.map((iso, i) => {
                      const cell = inventoryMap[rt.id]?.[iso];
                      const total = cell?.total ?? rt.unitCount;
                      const available = cell
                        ? Math.max(0, cell.total - cell.booked - cell.blocked)
                        : rt.unitCount;
                      const stopSell = cell?.stopSell ?? false;
                      const today = iso === todayStr;
                      const allocs = allocMap[rt.id]?.[iso] ?? [];
                      const pct = total > 0 ? available / total : 0;

                      const badgeClass = stopSell
                        ? "bg-red-100 text-red-600"
                        : available === 0
                        ? "bg-red-100 text-red-700"
                        : pct <= 0.5
                        ? "bg-amber-100 text-amber-700"
                        : "bg-green-100 text-green-700";

                      return (
                        <td
                          key={iso}
                          onClick={
                            canAllocate
                              ? () => openAllocPanel({ id: rt.id, name: rt.name }, iso)
                              : undefined
                          }
                          title={
                            stopSell
                              ? "Stop sell — click to allocate"
                              : canAllocate
                              ? `${available} free — click to allocate`
                              : `${available} free`
                          }
                          className={cn(
                            "h-12 w-[64px] min-w-[64px] sm:w-[80px] sm:min-w-[80px] text-center align-middle px-0.5 border-b border-r border-gray-100",
                            today ? "bg-amber-50/60" : "",
                            canAllocate ? "cursor-pointer hover:bg-[#1a3a2a]/5" : "",
                            colVisibility(i)
                          )}
                        >
                          <div
                            className={cn(
                              "inline-flex items-center justify-center min-w-[22px] h-5 px-1 rounded-md font-semibold text-[11px]",
                              badgeClass
                            )}
                          >
                            {stopSell ? "S" : available}
                          </div>
                          {allocs.length > 0 && (
                            <div className="flex flex-wrap items-center justify-center gap-0.5 mt-1">
                              {allocs.slice(0, 6).map((a) => (
                                <span
                                  key={a.id}
                                  className="w-2 h-2 rounded-full inline-block ring-1 ring-black/5"
                                  style={{
                                    backgroundColor:
                                      a.createdBy?.salesColor ?? SALES_COLOR_DEFAULT,
                                  }}
                                  title={`${a.createdBy?.name ?? "Staff"}: ${a.units} unit${
                                    a.units !== 1 ? "s" : ""
                                  }${a.label ? ` · ${a.label}` : ""}`}
                                />
                              ))}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}

              {/* ─── Physical room booking Gantt (staff only) ─────────────────── */}
              {isStaff && rooms.length > 0 && (
                <>
                  <tr>
                    <td
                      colSpan={totalCols}
                      className="sticky left-0 bg-[#1a3a2a] text-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide border-b border-[#14301f]"
                    >
                      Room Rack — Bookings
                    </td>
                  </tr>

                  {rooms.map((room, idx) => {
                    const showGroup =
                      idx === 0 || rooms[idx - 1].roomTypeName !== room.roomTypeName;
                    return (
                      <Fragment key={room.id}>
                        {showGroup && (
                          <tr>
                            <td
                              colSpan={totalCols}
                              className="sticky left-0 bg-[#1a3a2a]/[0.06] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#1a3a2a] border-b border-gray-200"
                            >
                              {room.roomTypeName}
                            </td>
                          </tr>
                        )}
                        <tr className="group/row">
                          <td className="sticky left-0 z-10 bg-white px-2 sm:px-3 py-2 whitespace-nowrap border-b border-r border-gray-100 group-hover/row:bg-gray-50">
                            {/* Compact on mobile: "101 · D"; full on desktop */}
                            <div className="font-medium text-gray-800">
                              <span className="sm:hidden">
                                {room.number} · {typeInitial(room.roomTypeName)}
                              </span>
                              <span className="hidden sm:inline">Room {room.number}</span>
                            </div>
                            <div className="hidden sm:block text-[11px] text-gray-400 font-normal">
                              {room.roomTypeName}
                              {room.floor ? ` · Floor ${room.floor}` : ""}
                            </div>
                          </td>
                          {dates.map((iso, i) => {
                            const entries = cellMap[room.id]?.[iso] ?? [];
                            const isEmpty = entries.length === 0;
                            const today = iso === todayStr;

                            return (
                              <td
                                key={iso}
                                onClick={isEmpty ? () => openBookingPanel(room, iso) : undefined}
                                className={cn(
                                  "h-12 w-[64px] min-w-[64px] sm:w-[80px] sm:min-w-[80px] align-middle px-0.5 border-b border-r border-gray-100",
                                  today ? "bg-amber-50/60" : "",
                                  isEmpty
                                    ? "cursor-pointer hover:bg-[#1a3a2a]/5 group/cell"
                                    : "",
                                  colVisibility(i)
                                )}
                                title={isEmpty ? "Click to create a booking" : undefined}
                              >
                                {isEmpty ? (
                                  <span className="hidden group-hover/cell:flex items-center justify-center h-full text-[#1a3a2a]/70">
                                    <Plus size={14} />
                                  </span>
                                ) : (
                                  <div className="flex flex-col gap-0.5">
                                    {entries.map((e) => {
                                      const tone = toneFor(e);
                                      const tip = `${e.guestName} · ${e.bookingRef} · ${
                                        e.nights
                                      } night${e.nights !== 1 ? "s" : ""}`;
                                      if (e.isFirst) {
                                        return (
                                          <button
                                            key={e.bookingRoomId}
                                            type="button"
                                            onClick={(ev) => {
                                              ev.stopPropagation();
                                              openBooking(e.bookingRef);
                                            }}
                                            title={tip}
                                            className={cn(
                                              "w-full rounded-md px-1 py-1 text-left leading-tight transition-shadow hover:shadow-sm",
                                              TONE_CHIP[tone]
                                            )}
                                          >
                                            {/* Mobile: coloured dot only. Desktop: name + ref */}
                                            <span className="sm:hidden flex items-center justify-center">
                                              <span
                                                className={cn(
                                                  "w-2.5 h-2.5 rounded-full inline-block",
                                                  TONE_DOT[tone]
                                                )}
                                              />
                                            </span>
                                            <span className="hidden sm:block font-medium truncate">
                                              {e.guestName.slice(0, 12)}
                                            </span>
                                            <span className="hidden sm:block text-[10px] opacity-70 truncate">
                                              {e.bookingRef}
                                            </span>
                                          </button>
                                        );
                                      }
                                      return (
                                        <button
                                          key={e.bookingRoomId}
                                          type="button"
                                          onClick={(ev) => {
                                            ev.stopPropagation();
                                            openBooking(e.bookingRef);
                                          }}
                                          title={tip}
                                          aria-label={`Open booking ${e.bookingRef}`}
                                          className={cn(
                                            "block w-full h-2.5 rounded-sm transition-opacity hover:opacity-80",
                                            TONE_BAR[tone]
                                          )}
                                        />
                                      );
                                    })}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      </Fragment>
                    );
                  })}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Active sales allocations (release list) ──────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Active Sales Allocations</h2>
        </div>
        {allocations.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-gray-400">
            No active allocations in this date range.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500">
                  <th className="px-4 py-2.5 text-left font-medium">Staff</th>
                  <th className="px-4 py-2.5 text-left font-medium">Room Type</th>
                  <th className="px-4 py-2.5 text-left font-medium hidden sm:table-cell">
                    Check-in
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium hidden sm:table-cell">
                    Check-out
                  </th>
                  <th className="px-4 py-2.5 text-center font-medium">Units</th>
                  <th className="px-4 py-2.5 text-left font-medium hidden md:table-cell">Label</th>
                  <th className="px-4 py-2.5 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {allocations.map((a) => {
                  const releasing = releasingId === a.id;
                  return (
                    <tr key={a.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-2 text-gray-700">
                          <span
                            className="w-2.5 h-2.5 rounded-full inline-block ring-1 ring-black/5 shrink-0"
                            style={{
                              backgroundColor: a.createdBy?.salesColor ?? SALES_COLOR_DEFAULT,
                            }}
                          />
                          {a.createdBy?.name ?? "Staff"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-700">{a.roomTypeName}</td>
                      <td className="px-4 py-2.5 text-gray-600 hidden sm:table-cell">
                        {fmtDate(a.checkIn)}
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 hidden sm:table-cell">
                        {fmtDate(a.checkOut)}
                      </td>
                      <td className="px-4 py-2.5 text-center text-gray-700">{a.units}</td>
                      <td className="px-4 py-2.5 text-gray-500 hidden md:table-cell">
                        {a.label ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {canReleaseRow(a) ? (
                          <button
                            type="button"
                            onClick={() => handleRelease(a.id)}
                            disabled={releasing}
                            className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors disabled:opacity-50"
                          >
                            {releasing ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <X size={12} />
                            )}
                            Release
                          </button>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Slide / bottom-sheet panel ───────────────────────────────────────── */}
      {panel && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className={cn(
              "absolute inset-0 bg-black/40 transition-opacity duration-200",
              entered ? "opacity-100" : "opacity-0"
            )}
            onClick={closePanel}
            aria-hidden
          />
          {/* Panel: bottom sheet on mobile, right drawer on desktop */}
          <div
            className={cn(
              "absolute bg-white shadow-xl flex flex-col transition-transform duration-200 ease-out",
              "inset-x-0 bottom-0 max-h-[90vh] rounded-t-2xl",
              "sm:inset-x-auto sm:right-0 sm:top-0 sm:bottom-0 sm:h-full sm:max-h-none sm:w-[480px] sm:max-w-full sm:rounded-none",
              entered
                ? "translate-y-0 sm:translate-x-0"
                : "translate-y-full sm:translate-y-0 sm:translate-x-full"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-gray-900 truncate">
                  {panel.kind === "booking"
                    ? `New Booking — Room ${panel.roomNumber}`
                    : "New Sales Allocation"}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{panel.roomTypeName}</p>
              </div>
              <button
                type="button"
                onClick={closePanel}
                className="text-gray-400 hover:text-gray-600 shrink-0"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Booking success */}
            {panel.kind === "booking" && successRef ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
                <CheckCircle2 size={40} className="text-green-500" />
                <div>
                  <p className="font-medium text-gray-900">Booking created</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Reference{" "}
                    <span className="font-mono font-medium text-gray-700">{successRef}</span>
                  </p>
                </div>
                <Link
                  href={`/admin/bookings/${successRef}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-[#1a3a2a] text-white rounded-lg hover:bg-[#14301f] transition-colors"
                >
                  View Booking
                </Link>
              </div>
            ) : panel.kind === "booking" ? (
              /* ─── Booking form ─────────────────────────────────────────────── */
              <form
                onSubmit={handleBookingSubmit}
                className="flex-1 overflow-y-auto px-5 py-4 space-y-4"
              >
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Room</label>
                  <div className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700">
                    Room {panel.roomNumber} · {panel.roomTypeName}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Check-in</label>
                    <input
                      type="date"
                      value={checkIn}
                      onChange={(e) => handleCheckInChange(e.target.value)}
                      required
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Check-out
                    </label>
                    <input
                      type="date"
                      value={checkOut}
                      min={nextISO(checkIn)}
                      onChange={(e) => setCheckOut(e.target.value)}
                      required
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]/30"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Guest Name</label>
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Full name"
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Guest Phone</label>
                  <input
                    type="tel"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder="10-digit mobile number"
                    inputMode="numeric"
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]/30"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Adults</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={adults}
                      onChange={(e) =>
                        setAdults(Math.max(1, Math.min(10, Number(e.target.value) || 1)))
                      }
                      required
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Source</label>
                    <select
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]/30 bg-white"
                    >
                      {SOURCE_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Payment Method
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]/30 bg-white"
                    >
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  {paymentMethod !== "None" && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Amount Paid (₹)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="1"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]/30"
                      />
                      {amount && Number(amount) > 0 && (
                        <p className="text-[11px] text-gray-400 mt-1">
                          {formatINR(Math.round(Number(amount) * 100))} captured
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {paymentMethod === "None" && (
                  <p className="text-xs text-gray-500">
                    No payment recorded — booking will be created as <strong>Pending</strong>.
                  </p>
                )}

                {formError && (
                  <p className="text-red-600 text-xs bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    {formError}
                  </p>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="inline-flex items-center justify-center gap-1.5 flex-1 bg-[#1a3a2a] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#14301f] transition-colors disabled:opacity-50"
                  >
                    {isPending ? (
                      <>
                        <Loader2 size={15} className="animate-spin" /> Creating…
                      </>
                    ) : (
                      "Create Booking"
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={closePanel}
                    className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              /* ─── Allocation form ──────────────────────────────────────────── */
              <form
                onSubmit={handleAllocSubmit}
                className="flex-1 overflow-y-auto px-5 py-4 space-y-4"
              >
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Room Type</label>
                  <div className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700">
                    {panel.roomTypeName}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Check-in</label>
                    <input
                      type="date"
                      value={checkIn}
                      onChange={(e) => handleCheckInChange(e.target.value)}
                      required
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Check-out
                    </label>
                    <input
                      type="date"
                      value={checkOut}
                      min={nextISO(checkIn)}
                      onChange={(e) => setCheckOut(e.target.value)}
                      required
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]/30"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Units</label>
                  <input
                    type="number"
                    min={1}
                    value={units}
                    onChange={(e) => setUnits(Math.max(1, Number(e.target.value) || 1))}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Label <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g. Kerala Tours group, MakeMyTrip hold"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]/30"
                  />
                </div>

                {formError && (
                  <p className="text-red-600 text-xs bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    {formError}
                  </p>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="inline-flex items-center justify-center gap-1.5 flex-1 bg-[#1a3a2a] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#14301f] transition-colors disabled:opacity-50"
                  >
                    {isPending ? (
                      <>
                        <Loader2 size={15} className="animate-spin" /> Saving…
                      </>
                    ) : (
                      "Allocate"
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={closePanel}
                    className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
