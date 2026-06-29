"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SALES_COLOR_PALETTE, SALES_COLOR_DEFAULT } from "@/lib/sales-colors";
import {
  createSalesAllocation,
  releaseSalesAllocation,
  updateUserColor,
} from "@/app/(admin)/admin/allocation/actions";

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

interface CellData {
  total: number;
  booked: number;
  blocked: number;
  stopSell: boolean;
}

interface Props {
  roomTypes: { id: string; name: string; rooms: { id: string }[] }[];
  dates: string[]; // ISO date strings
  cellMap: Record<string, Record<string, CellData>>;
  allocMap: Record<string, Record<string, AllocChip[]>>;
  allocations: AllocationRow[];
  currentUser: {
    id: string;
    name: string | null;
    salesColor: string | null;
    role: string | null;
  } | null;
  todayStr: string;
}

// ─── Local-time date helpers (avoid UTC drift on display + math) ──────────────
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

interface SelectedCell {
  roomTypeId: string;
  roomTypeName: string;
  dateStr: string;
}

export default function AllocationGrid({
  roomTypes,
  dates,
  cellMap,
  allocMap,
  allocations,
  currentUser,
  todayStr,
}: Props) {
  const router = useRouter();

  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [units, setUnits] = useState(1);
  const [label, setLabel] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [isCreating, startCreate] = useTransition();
  const [isColorPending, startColor] = useTransition();
  const [releasingId, setReleasingId] = useState<string | null>(null);
  const [, startRelease] = useTransition();

  const isAdmin =
    currentUser?.role === "ADMIN" || currentUser?.role === "SUPER_ADMIN";

  function openForm(roomTypeId: string, roomTypeName: string, dateStr: string) {
    setSelectedCell({ roomTypeId, roomTypeName, dateStr });
    setCheckIn(dateStr);
    setCheckOut(nextISO(dateStr));
    setUnits(1);
    setLabel("");
    setFormError(null);
  }

  function closeForm() {
    setSelectedCell(null);
    setFormError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCell) return;
    setFormError(null);
    startCreate(async () => {
      try {
        await createSalesAllocation({
          roomTypeId: selectedCell.roomTypeId,
          checkIn,
          checkOut,
          units,
          label: label.trim() || undefined,
        });
        setSelectedCell(null);
        router.refresh();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Failed to create allocation");
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
        /* surfaced via the row; server enforces permissions */
      } finally {
        setReleasingId(null);
      }
    });
  }

  function canRelease(alloc: AllocationRow) {
    if (!currentUser) return false;
    return isAdmin || alloc.createdBy?.id === currentUser.id;
  }

  return (
    <div className="space-y-4">
      {/* ─── Grid ─────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="sticky left-0 bg-white px-4 py-3 text-left font-medium text-gray-500 whitespace-nowrap min-w-[140px] z-10">
                  Room Type
                </th>
                {dates.map((iso) => {
                  const today = iso === todayStr;
                  const weekend = isWeekend(iso);
                  return (
                    <th
                      key={iso}
                      className={cn(
                        "px-2 py-3 text-center font-medium min-w-[56px]",
                        today ? "bg-[#1a3a2a]/5 text-[#1a3a2a]" : "text-gray-500",
                        weekend && !today ? "bg-amber-50/50 text-amber-700" : ""
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
            <tbody className="divide-y divide-gray-50">
              {roomTypes.map((rt) => (
                <tr key={rt.id} className="hover:bg-gray-50/50">
                  <td className="sticky left-0 bg-white px-4 py-3 font-medium text-gray-800 whitespace-nowrap z-10 border-r border-gray-100">
                    <div>{rt.name}</div>
                    <div className="text-gray-400 font-normal">{rt.rooms.length} units</div>
                  </td>
                  {dates.map((iso) => {
                    const cell = cellMap[rt.id]?.[iso];
                    const available = cell
                      ? Math.max(0, cell.total - cell.booked - cell.blocked)
                      : rt.rooms.length;
                    const total = cell?.total ?? rt.rooms.length;
                    const stopSell = cell?.stopSell ?? false;
                    const today = iso === todayStr;
                    const allocs = allocMap[rt.id]?.[iso] ?? [];

                    const pct = total > 0 ? available / total : 0;
                    const cellClass = stopSell
                      ? "bg-red-50 text-red-600"
                      : available === 0
                      ? "bg-red-100 text-red-700 font-semibold"
                      : pct <= 0.25
                      ? "bg-amber-50 text-amber-700"
                      : pct <= 0.5
                      ? "bg-yellow-50 text-yellow-700"
                      : "bg-green-50 text-green-700";

                    const isSelected =
                      selectedCell?.roomTypeId === rt.id && selectedCell?.dateStr === iso;

                    return (
                      <td
                        key={iso}
                        onClick={() => openForm(rt.id, rt.name, iso)}
                        className={cn(
                          "px-2 py-2 text-center cursor-pointer transition-colors hover:bg-[#1a3a2a]/5 group",
                          today ? "ring-1 ring-inset ring-[#1a3a2a]/20" : "",
                          isSelected ? "ring-2 ring-inset ring-[#1a3a2a]" : ""
                        )}
                        title={
                          stopSell ? "Stop Sell — click to allocate" : "Click to allocate"
                        }
                      >
                        <div
                          className={cn(
                            "inline-flex items-center justify-center w-8 h-8 rounded-lg font-medium text-xs group-hover:ring-1 group-hover:ring-[#1a3a2a]/30",
                            cellClass
                          )}
                        >
                          {stopSell ? "S" : available}
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-0.5 mt-1 min-h-[8px]">
                          {allocs.map((a) => (
                            <span
                              key={a.id}
                              className="w-2 h-2 rounded-full inline-block"
                              style={{
                                backgroundColor: a.createdBy?.salesColor ?? SALES_COLOR_DEFAULT,
                              }}
                              title={`${a.createdBy?.name ?? "Staff"}: ${a.units} unit(s)${
                                a.label ? ` - ${a.label}` : ""
                              }`}
                            />
                          ))}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="px-4 py-3 border-t border-gray-100 flex flex-wrap items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-green-100 inline-block" /> Available
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-100 inline-block" /> Low (&le;25%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-red-100 inline-block" /> Full
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-red-50 inline-block" /> S = Stop Sell
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block bg-gray-400" /> Sales allocation
          </span>
        </div>
      </div>

      {/* ─── Create allocation form ───────────────────────────────────────── */}
      {selectedCell && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
              <Plus size={15} className="text-[#1a3a2a]" />
              New Sales Allocation
            </h2>
            <button
              type="button"
              onClick={closeForm}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end"
          >
            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Room Type</label>
              <input
                type="text"
                value={selectedCell.roomTypeName}
                readOnly
                className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Check-in</label>
              <input
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]"
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
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Units</label>
              <input
                type="number"
                min={1}
                value={units}
                onChange={(e) => setUnits(Math.max(1, Number(e.target.value) || 1))}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]"
              />
            </div>
            <div className="lg:col-span-5">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Label <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Kerala Tours group, MakeMyTrip hold"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]"
              />
            </div>
            <div>
              <button
                type="submit"
                disabled={isCreating}
                className="w-full inline-flex items-center justify-center gap-1.5 bg-[#1a3a2a] text-white rounded-lg py-2 text-sm font-medium hover:bg-[#14301f] transition-colors disabled:opacity-50"
              >
                {isCreating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                {isCreating ? "Saving…" : "Allocate"}
              </button>
            </div>
            {formError && (
              <p className="lg:col-span-6 text-red-500 text-xs bg-red-50 rounded-lg px-3 py-2">
                {formError}
              </p>
            )}
          </form>
        </div>
      )}

      {/* ─── Color picker ─────────────────────────────────────────────────── */}
      {currentUser && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Your color:</span>
            <span className="flex items-center gap-1.5 text-sm text-gray-500">
              <span
                className="w-3.5 h-3.5 rounded-full inline-block ring-1 ring-black/5"
                style={{ backgroundColor: currentUser.salesColor ?? SALES_COLOR_DEFAULT }}
              />
              {currentUser.name ?? "You"}
            </span>
            <div className="flex items-center gap-1.5">
              {SALES_COLOR_PALETTE.map((hex) => {
                const active = currentUser.salesColor?.toLowerCase() === hex.toLowerCase();
                return (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => handlePickColor(hex)}
                    disabled={isColorPending}
                    aria-label={`Set color ${hex}`}
                    title={hex}
                    className={cn(
                      "w-6 h-6 rounded-full inline-flex items-center justify-center transition-transform hover:scale-110 disabled:opacity-50",
                      active ? "ring-2 ring-offset-2 ring-gray-800" : "ring-1 ring-black/10"
                    )}
                    style={{ backgroundColor: hex }}
                  >
                    {active && <Check size={13} className="text-white" />}
                  </button>
                );
              })}
              {isColorPending && <Loader2 size={14} className="animate-spin text-gray-400" />}
            </div>
          </div>
        </div>
      )}

      {/* ─── Active allocations table ─────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Active Allocations</h2>
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
                  <th className="px-4 py-2.5 text-left font-medium">Check-in</th>
                  <th className="px-4 py-2.5 text-left font-medium">Check-out</th>
                  <th className="px-4 py-2.5 text-center font-medium">Units</th>
                  <th className="px-4 py-2.5 text-left font-medium">Label</th>
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
                            className="w-2.5 h-2.5 rounded-full inline-block ring-1 ring-black/5"
                            style={{
                              backgroundColor: a.createdBy?.salesColor ?? SALES_COLOR_DEFAULT,
                            }}
                          />
                          {a.createdBy?.name ?? "Staff"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-700">{a.roomTypeName}</td>
                      <td className="px-4 py-2.5 text-gray-600">{fmtDate(a.checkIn)}</td>
                      <td className="px-4 py-2.5 text-gray-600">{fmtDate(a.checkOut)}</td>
                      <td className="px-4 py-2.5 text-center text-gray-700">{a.units}</td>
                      <td className="px-4 py-2.5 text-gray-500">{a.label ?? "—"}</td>
                      <td className="px-4 py-2.5 text-right">
                        {canRelease(a) ? (
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
    </div>
  );
}
