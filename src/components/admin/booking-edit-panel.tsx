"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { updateBooking } from "@/app/(admin)/admin/bookings/[ref]/actions";
import { mealPlanLabel, sourceBadge, BOOKING_SOURCE_OPTIONS } from "@/lib/badges";
import type { BookingStatus, MealPlan } from "@prisma/client";

const MEAL_PLANS: MealPlan[] = ["ROOM_ONLY", "BREAKFAST", "HALF_BOARD", "FULL_BOARD"];

const CLOSED_STATUSES: BookingStatus[] = ["CANCELLED", "CHECKED_OUT", "NO_SHOW"];

const inputClass =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]/30";
const labelClass = "block text-xs font-medium text-gray-500 mb-1";

interface RoomTypeOption {
  id: string;
  name: string;
}

interface InitialValues {
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  adults: number;
  children: number;
  mealPlan: MealPlan;
  source: string;
  specialRequests: string | null;
  roomTypeId: string;
}

interface Props {
  bookingRef: string;
  status: BookingStatus;
  roomTypes: RoomTypeOption[];
  initial: InitialValues;
}

function nextISO(iso: string) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function BookingEditPanel({ bookingRef, status, roomTypes, initial }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [entered, setEntered] = useState(false);

  const [checkIn, setCheckIn] = useState(initial.checkIn);
  const [checkOut, setCheckOut] = useState(initial.checkOut);
  const [adults, setAdults] = useState(initial.adults);
  const [children, setChildren] = useState(initial.children);
  const [mealPlan, setMealPlan] = useState<MealPlan>(initial.mealPlan);
  const [source, setSource] = useState<string>(initial.source);
  const [roomTypeId, setRoomTypeId] = useState(initial.roomTypeId);
  const [specialRequests, setSpecialRequests] = useState(initial.specialRequests ?? "");

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // The booking is no longer editable once it is closed out.
  if (CLOSED_STATUSES.includes(status)) return null;

  function playEnter() {
    setEntered(false);
    requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)));
  }

  function openPanel() {
    // Reset to the latest server values each time the panel is opened.
    setCheckIn(initial.checkIn);
    setCheckOut(initial.checkOut);
    setAdults(initial.adults);
    setChildren(initial.children);
    setMealPlan(initial.mealPlan);
    setSource(initial.source);
    setRoomTypeId(initial.roomTypeId);
    setSpecialRequests(initial.specialRequests ?? "");
    setError(null);
    setOpen(true);
    playEnter();
  }

  function closePanel() {
    setEntered(false);
    setTimeout(() => setOpen(false), 200);
  }

  function handleCheckInChange(value: string) {
    setCheckIn(value);
    if (new Date(value + "T00:00:00") >= new Date(checkOut + "T00:00:00")) {
      setCheckOut(nextISO(value));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (new Date(checkOut + "T00:00:00") <= new Date(checkIn + "T00:00:00")) {
      setError("Check-out must be after check-in.");
      return;
    }
    startTransition(async () => {
      const res = await updateBooking({
        bookingRef,
        checkIn,
        checkOut,
        adults,
        children,
        mealPlan,
        source,
        specialRequests: specialRequests.trim() || null,
        roomTypeId: roomTypeId || undefined,
      });
      if (res.success) {
        router.refresh();
        closePanel();
      } else {
        setError(res.error ?? "Could not update the booking.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <Pencil size={14} /> Edit Booking
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div
            className={cn(
              "absolute inset-0 bg-black/40 transition-opacity duration-200",
              entered ? "opacity-100" : "opacity-0"
            )}
            onClick={closePanel}
            aria-hidden
          />
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
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-gray-900 truncate">Edit Booking</h2>
                <p className="text-xs text-gray-400 mt-0.5 font-mono truncate">{bookingRef}</p>
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

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Check-in</label>
                  <input
                    type="date"
                    value={checkIn}
                    onChange={(e) => handleCheckInChange(e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Check-out</label>
                  <input
                    type="date"
                    value={checkOut}
                    min={nextISO(checkIn)}
                    onChange={(e) => setCheckOut(e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Adults</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={adults}
                    onChange={(e) =>
                      setAdults(Math.max(1, Math.min(10, Number(e.target.value) || 1)))
                    }
                    required
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Children</label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={children}
                    onChange={(e) =>
                      setChildren(Math.max(0, Math.min(10, Number(e.target.value) || 0)))
                    }
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Meal Plan</label>
                  <select
                    value={mealPlan}
                    onChange={(e) => setMealPlan(e.target.value as MealPlan)}
                    className={cn(inputClass, "bg-white")}
                  >
                    {MEAL_PLANS.map((m) => (
                      <option key={m} value={m}>
                        {mealPlanLabel[m]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Source</label>
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    className={cn(inputClass, "bg-white")}
                  >
                    {BOOKING_SOURCE_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {sourceBadge[s].label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {roomTypes.length > 1 && (
                <div>
                  <label className={labelClass}>Room Type</label>
                  <select
                    value={roomTypeId}
                    onChange={(e) => setRoomTypeId(e.target.value)}
                    className={cn(inputClass, "bg-white")}
                  >
                    {roomTypes.map((rt) => (
                      <option key={rt.id} value={rt.id}>
                        {rt.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Changing room type re-prices the stay and may reassign the physical room.
                  </p>
                </div>
              )}

              <div>
                <label className={labelClass}>Notes / Special Requests</label>
                <textarea
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  rows={3}
                  placeholder="Any special requests for this stay"
                  className={cn(inputClass, "resize-none")}
                />
              </div>

              <p className="text-[11px] text-gray-400">
                Totals and GST are recalculated automatically when you save.
              </p>

              {error && (
                <p className="text-red-600 text-xs bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {error}
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
                    "Save Changes"
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
          </div>
        </div>
      )}
    </>
  );
}
