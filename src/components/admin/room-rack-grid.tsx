"use client";

import { Fragment, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Ban,
  CheckCircle2,
  ExternalLink,
  Loader2,
  LogIn,
  LogOut,
  Plus,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatINR } from "@/lib/pricing";
import { createRackBooking } from "@/app/(admin)/admin/room-rack/actions";
import {
  updateBooking,
  checkInBooking,
  checkOutBooking,
  cancelBooking,
} from "@/app/(admin)/admin/bookings/[ref]/actions";
import { bookingStatusBadge } from "@/lib/badges";
import type { BookingStatus } from "@prisma/client";

// ─── Shared entry shape (also consumed by the server page) ────────────────────
export interface RackEntry {
  bookingRoomId: string;
  bookingId: string;
  bookingRef: string;
  guestName: string;
  createdByName: string | null;
  status: BookingStatus;
  adults: number;
  children: number;
  paidAmount: number;
  balanceDue: number;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
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

interface Props {
  rooms: RackRoom[]; // flat, pre-ordered by roomType name then number
  dates: string[]; // 14 ISO date strings
  cellMap: Record<string, Record<string, RackEntry[]>>; // booking gantt
  role: string | null;
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

// Progressive disclosure: 10 days on mobile, 20 on tablet, all on desktop.
function colVisibility(i: number) {
  if (i < 10) return "";
  if (i < 20) return "hidden md:table-cell";
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
      kind: "create";
      roomId: string;
      roomNumber: string;
      roomTypeName: string;
      checkIn: string;
    }
  | {
      kind: "edit";
      entry: RackEntry;
      roomNumber: string;
      roomTypeName: string;
    };

export default function RoomRackGrid({ rooms, dates, cellMap, role, todayStr }: Props) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);

  const isStaff = !!role && STAFF_ROLES.includes(role);
  const isAdmin = !!role && ADMIN_ROLES.includes(role);

  // ── Panel (create OR edit) ──────────────────────────────────────────────────
  const [panel, setPanel] = useState<Panel | null>(null);
  const [entered, setEntered] = useState(false);

  // shared stay fields (used by both create and edit)
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);

  // create-only fields
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [source, setSource] = useState("WALK_IN");
  const [paymentMethod, setPaymentMethod] = useState("None");
  const [amount, setAmount] = useState("");
  const [successRef, setSuccessRef] = useState<string | null>(null);

  // edit-only fields
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function playEnter() {
    setEntered(false);
    requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)));
  }

  function openCreatePanel(room: RackRoom, dateStr: string) {
    setPanel({
      kind: "create",
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
    setChildren(0);
    setSource("WALK_IN");
    setPaymentMethod("None");
    setAmount("");
    setSuccessRef(null);
    setFormError(null);
    playEnter();
  }

  function openEditPanel(entry: RackEntry, room: RackRoom) {
    setPanel({
      kind: "edit",
      entry,
      roomNumber: room.number,
      roomTypeName: room.roomTypeName,
    });
    setCheckIn(entry.checkIn);
    setCheckOut(entry.checkOut);
    setAdults(entry.adults);
    setChildren(entry.children);
    setShowCancel(false);
    setCancelReason("");
    setFormError(null);
    playEnter();
  }

  function closePanel() {
    setEntered(false);
    setTimeout(() => {
      setPanel(null);
      setFormError(null);
      setSuccessRef(null);
      setShowCancel(false);
    }, 200);
  }

  function handleCheckInChange(value: string) {
    setCheckIn(value);
    if (parseLocal(value) >= parseLocal(checkOut)) {
      setCheckOut(nextISO(value));
    }
  }

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!panel || panel.kind !== "create") return;
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

  function handleEditSave() {
    if (!panel || panel.kind !== "edit") return;
    setFormError(null);
    if (parseLocal(checkOut) <= parseLocal(checkIn)) {
      setFormError("Check-out must be after check-in.");
      return;
    }
    startTransition(async () => {
      const res = await updateBooking({
        bookingRef: panel.entry.bookingRef,
        checkIn,
        checkOut,
        adults,
        children,
      });
      if (res.success) {
        router.refresh();
        closePanel();
      } else {
        setFormError(res.error ?? "Could not update booking.");
      }
    });
  }

  function runStatusAction(fn: () => Promise<void>) {
    setFormError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
        closePanel();
      } catch {
        setFormError("Action failed. Please try again.");
      }
    });
  }

  function handleCancel() {
    if (!panel || panel.kind !== "edit") return;
    setFormError(null);
    startTransition(async () => {
      try {
        await cancelBooking(panel.entry.bookingId, cancelReason);
        router.refresh();
        closePanel();
      } catch {
        setFormError("Could not cancel — admin access is required.");
      }
    });
  }

  const totalCols = dates.length + 1;

  // Non front-desk roles (e.g. SALES) don't manage the physical room rack.
  if (!isStaff) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <p className="text-sm font-medium text-gray-700">Front-desk access required</p>
        <p className="text-sm text-gray-400 mt-1">
          The room booking rack is available to front-desk staff and administrators.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ─── Payment status legend ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 bg-white rounded-xl border border-gray-200 px-3 py-2 text-[11px] text-gray-500 w-fit">
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
      </div>

      {/* ─── Booking Gantt ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div ref={scrollRef} className="overflow-x-auto">
          <table className="w-full text-xs border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-30 bg-gray-50 px-2 sm:px-3 py-2.5 text-left font-medium text-gray-500 whitespace-nowrap min-w-[112px] sm:min-w-[160px] border-b border-r border-gray-200">
                  Room
                </th>
                {dates.map((iso, i) => {
                  const today = iso === todayStr;
                  return (
                    <th
                      key={iso}
                      className={cn(
                        "sticky top-0 z-20 px-0.5 py-1.5 text-center font-medium w-[44px] min-w-[44px] sm:w-[56px] sm:min-w-[56px] lg:w-[72px] lg:min-w-[72px] border-b border-r border-gray-100",
                        today ? "bg-amber-100 text-[#1a3a2a]" : "bg-gray-50 text-gray-500",
                        colVisibility(i)
                      )}
                    >
                      <div
                        className={cn("text-[11px] font-bold leading-tight", today ? "text-[#1a3a2a]" : "text-gray-700")}
                      >
                        {dayNum(iso)}
                      </div>
                      <div className="text-[9px] opacity-60 leading-tight">{dayLabel(iso)}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
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
                            onClick={isEmpty ? () => openCreatePanel(room, iso) : undefined}
                            className={cn(
                              "h-12 w-[44px] min-w-[44px] sm:w-[56px] sm:min-w-[56px] lg:w-[72px] lg:min-w-[72px] align-middle px-0.5 border-b border-r border-gray-100",
                              today ? "bg-amber-50/60" : "",
                              isEmpty ? "cursor-pointer hover:bg-[#1a3a2a]/5 group/cell" : "",
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
                                  const tip = `${e.guestName} · ${e.bookingRef} · ${e.nights} night${
                                    e.nights !== 1 ? "s" : ""
                                  }`;
                                  if (e.isFirst) {
                                    return (
                                      <button
                                        key={e.bookingRoomId}
                                        type="button"
                                        onClick={(ev) => {
                                          ev.stopPropagation();
                                          openEditPanel(e, room);
                                        }}
                                        title={tip}
                                        className={cn(
                                          "w-full rounded-md px-1 py-1 text-left leading-tight transition-shadow hover:shadow-sm",
                                          TONE_CHIP[tone]
                                        )}
                                      >
                                        {/* Mobile: dot only */}
                                        <span className="sm:hidden flex items-center justify-center">
                                          <span className={cn("w-2 h-2 rounded-full", TONE_DOT[tone])} />
                                        </span>
                                        {/* Tablet: first name only */}
                                        <span className="hidden sm:block lg:hidden font-semibold text-[10px] truncate leading-tight">
                                          {e.guestName.split(" ")[0]}
                                        </span>
                                        {/* Desktop: full name + ref */}
                                        <span className="hidden lg:block font-semibold text-[11px] truncate leading-tight">
                                          {e.guestName}
                                        </span>
                                        <span className="hidden lg:block text-[9px] opacity-60 truncate font-mono leading-tight">
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
                                        openEditPanel(e, room);
                                      }}
                                      title={tip}
                                      aria-label={`Manage booking ${e.bookingRef}`}
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
            </tbody>
          </table>
        </div>
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
                  {panel.kind === "create"
                    ? `New Booking — Room ${panel.roomNumber}`
                    : `Manage Booking — Room ${panel.roomNumber}`}
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

            {panel.kind === "create" && successRef ? (
              /* ─── Booking success ─────────────────────────────────────────── */
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
            ) : panel.kind === "create" ? (
              /* ─── Create booking form ─────────────────────────────────────── */
              <form
                onSubmit={handleCreateSubmit}
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
                    <label className="block text-xs font-medium text-gray-500 mb-1">Check-out</label>
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
              /* ─── Quick-edit booking ───────────────────────────────────────── */
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {/* Guest + ref + status summary */}
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-gray-900 text-sm truncate">
                      {panel.entry.guestName}
                    </span>
                    <span
                      className={cn(
                        "text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0",
                        bookingStatusBadge[panel.entry.status].className
                      )}
                    >
                      {bookingStatusBadge[panel.entry.status].label}
                    </span>
                  </div>
                  <Link
                    href={`/admin/bookings/${panel.entry.bookingRef}`}
                    className="inline-flex items-center gap-1 text-xs font-mono text-[#1a3a2a] hover:underline"
                  >
                    {panel.entry.bookingRef}
                  </Link>
                  <div className="flex items-center gap-4 text-xs text-gray-500 pt-1">
                    <span>
                      Paid{" "}
                      <span className="font-medium text-green-700">
                        {formatINR(panel.entry.paidAmount)}
                      </span>
                    </span>
                    <span>
                      Balance{" "}
                      <span
                        className={cn(
                          "font-medium",
                          panel.entry.balanceDue > 0 ? "text-amber-600" : "text-gray-400"
                        )}
                      >
                        {formatINR(panel.entry.balanceDue)}
                      </span>
                    </span>
                  </div>
                  {panel.entry.createdByName && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 pt-0.5 border-t border-gray-100 mt-1">
                      <span>Booked by</span>
                      <span className="font-medium text-gray-600">{panel.entry.createdByName}</span>
                    </div>
                  )}
                </div>

                {/* Editable stay */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Check-in</label>
                    <input
                      type="date"
                      value={checkIn}
                      onChange={(e) => handleCheckInChange(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Check-out</label>
                    <input
                      type="date"
                      value={checkOut}
                      min={nextISO(checkIn)}
                      onChange={(e) => setCheckOut(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]/30"
                    />
                  </div>
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
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Children</label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={children}
                      onChange={(e) =>
                        setChildren(Math.max(0, Math.min(10, Number(e.target.value) || 0)))
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]/30"
                    />
                  </div>
                </div>

                <p className="text-[11px] text-gray-400">
                  Totals and GST are recalculated automatically when you save changes.
                </p>

                {formError && (
                  <p className="text-red-600 text-xs bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    {formError}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleEditSave}
                  disabled={isPending}
                  className="inline-flex w-full items-center justify-center gap-1.5 bg-[#1a3a2a] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#14301f] transition-colors disabled:opacity-50"
                >
                  {isPending ? (
                    <>
                      <Loader2 size={15} className="animate-spin" /> Saving…
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </button>

                {/* Quick status actions */}
                <div className="border-t border-gray-100 pt-4 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    {panel.entry.status === "CONFIRMED" && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => runStatusAction(() => checkInBooking(panel.entry.bookingId))}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        <LogIn size={14} /> Check In
                      </button>
                    )}
                    {panel.entry.status === "CHECKED_IN" && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => runStatusAction(() => checkOutBooking(panel.entry.bookingId))}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#1a3a2a] text-white rounded-lg hover:bg-[#14301f] disabled:opacity-50 transition-colors"
                      >
                        <LogOut size={14} /> Check Out
                      </button>
                    )}
                    {isAdmin &&
                      !showCancel &&
                      (panel.entry.status === "PENDING" ||
                        panel.entry.status === "CONFIRMED" ||
                        panel.entry.status === "CHECKED_IN") && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => setShowCancel(true)}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                        >
                          <Ban size={14} /> Cancel
                        </button>
                      )}
                    <Link
                      href={`/admin/bookings/${panel.entry.bookingRef}`}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <ExternalLink size={14} /> View Full Booking
                    </Link>
                  </div>

                  {showCancel && (
                    <div className="space-y-2 rounded-lg border border-red-100 bg-red-50/50 p-3">
                      <label className="block text-xs font-medium text-red-700">
                        Cancellation reason
                      </label>
                      <input
                        type="text"
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder="Reason (optional)"
                        className="w-full border border-red-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-200"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={handleCancel}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                        >
                          {isPending && <Loader2 size={12} className="animate-spin" />}
                          Confirm Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowCancel(false)}
                          className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
                        >
                          Back
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
