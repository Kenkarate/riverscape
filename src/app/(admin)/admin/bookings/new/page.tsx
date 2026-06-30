"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, Plus, Search, Trash2, UserCheck } from "lucide-react";
import { calculatePrice, formatINR } from "@/lib/pricing";
import { BOOKING_SOURCE_OPTIONS, sourceBadge, mealPlanLabel } from "@/lib/badges";
import {
  getAvailability,
  lookupGuest,
  getActiveAddons,
  createAdminBooking,
} from "./actions";
import type { AvailableRoomType } from "@/lib/availability";
import type { ActiveAddon, GuestLookupResult } from "@/types";
import type { MealPlan } from "@prisma/client";

const inputClass =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]/30 bg-white";
const labelClass = "block text-xs font-medium text-gray-500 mb-1";

const MEAL_PLAN_OPTIONS: MealPlan[] = ["ROOM_ONLY", "BREAKFAST", "HALF_BOARD", "FULL_BOARD"];
const PAYMENT_METHODS = ["Cash", "Card", "UPI", "Bank Transfer", "None"] as const;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function tomorrowStr() {
  return new Date(Date.now() + 86400000).toISOString().slice(0, 10);
}

let lineSeq = 0;
function newLineId() {
  lineSeq += 1;
  return `line-${lineSeq}`;
}

// A single room in the booking — its own type and occupancy.
interface RoomLine {
  id: string;
  roomTypeId: string;
  adults: number;
  children: number;
}

const STEPS = ["Stay", "Rooms", "Guest", "Payment"];

export default function NewBookingPage() {
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Step 1 — stay
  const [checkIn, setCheckIn] = useState(todayStr());
  const [checkOut, setCheckOut] = useState(tomorrowStr());
  const [source, setSource] = useState<string>("WALK_IN");

  // Availability
  const [rooms, setRooms] = useState<AvailableRoomType[] | null>(null);
  const [checking, setChecking] = useState(false);

  // Step 2 — rooms (one or more) + meal plan
  const [lines, setLines] = useState<RoomLine[]>([]);
  const [mealPlan, setMealPlan] = useState<MealPlan>("ROOM_ONLY");

  // Step 3 — guest
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [idType, setIdType] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [existingGuest, setExistingGuest] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupDone, setLookupDone] = useState(false);

  // Add-ons
  const [addons, setAddons] = useState<ActiveAddon[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);

  // Step 4 — payment
  const [paymentMethod, setPaymentMethod] = useState<string>("Cash");
  const [amount, setAmount] = useState<string>("");

  const chosenAddons = addons.filter((a) => selectedAddons.includes(a.id));

  // Load add-ons once on mount
  useEffect(() => {
    getActiveAddons()
      .then(setAddons)
      .catch(() => setAddons([]));
  }, []);

  function roomTypeFor(id: string) {
    return rooms?.find((r) => r.id === id) ?? null;
  }

  // Live price per line (recomputed authoritatively on the server at submit).
  function priceForLine(line: RoomLine) {
    const rt = roomTypeFor(line.roomTypeId);
    if (!rt) return null;
    return calculatePrice({
      checkIn: new Date(checkIn),
      checkOut: new Date(checkOut),
      ratePerNight: rt.ratePlan.basePrice,
      extraAdults: Math.max(0, line.adults - rt.baseOccupancy),
      extraAdultPrice: rt.ratePlan.extraAdultPrice,
      extraChildrenWithBed: 0,
      extraChildWithBedPrice: rt.ratePlan.extraChildWithBed,
      extraChildrenNoBed: line.children,
      extraChildNoBedPrice: rt.ratePlan.extraChildNoBed,
      addons: [],
      couponDiscount: 0,
    });
  }

  // Combined summary across all room lines + booking-level add-ons.
  const validLines = lines.filter((l) => l.roomTypeId);
  const linePrices = validLines.map((l) => ({ line: l, price: priceForLine(l) }));
  const roomSubtotal = linePrices.reduce((s, lp) => s + (lp.price?.roomSubtotal ?? 0), 0);
  const extraCharges = linePrices.reduce((s, lp) => s + (lp.price?.addonSubtotal ?? 0), 0);
  const roomTax = linePrices.reduce((s, lp) => s + (lp.price?.roomTax ?? 0), 0);
  const addonBase = chosenAddons.reduce((s, a) => s + a.price, 0);
  const addonTax = chosenAddons.reduce(
    (s, a) => s + Math.round((a.price * a.gstRate) / 100),
    0
  );
  const gstTotal = roomTax + addonTax;
  const grandTotal = roomSubtotal + extraCharges + addonBase + gstTotal;
  const nightsCount = linePrices[0]?.price?.nights.length ?? 0;
  const hasPricing = validLines.length > 0 && grandTotal > 0;

  // Count rooms requested per type, to flag exceeding availability.
  function lineCountForType(typeId: string) {
    return lines.filter((l) => l.roomTypeId === typeId).length;
  }
  const overbookedType = rooms
    ? rooms.find((rt) => lineCountForType(rt.id) > rt.availableCount)
    : undefined;

  function resetRooms() {
    setRooms(null);
    setLines([]);
  }

  function handleCheckAvailability() {
    setError(null);
    if (new Date(checkOut) <= new Date(checkIn)) {
      setError("Check-out must be after check-in.");
      return;
    }
    setChecking(true);
    startTransition(async () => {
      try {
        const result = await getAvailability(checkIn, checkOut, 1);
        setRooms(result);
        if (result.length === 0) {
          setLines([]);
          setError("No room types available for these dates.");
        } else {
          // Seed with a single room line on the cheapest available type.
          setLines([
            { id: newLineId(), roomTypeId: result[0].id, adults: 2, children: 0 },
          ]);
          setStep(2);
        }
      } catch {
        setError("Could not check availability. Try again.");
      } finally {
        setChecking(false);
      }
    });
  }

  function addLine() {
    if (!rooms || rooms.length === 0) return;
    setLines((prev) => [
      ...prev,
      { id: newLineId(), roomTypeId: rooms[0].id, adults: 2, children: 0 },
    ]);
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  function updateLine(id: string, patch: Partial<RoomLine>) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const next = { ...l, ...patch };
        // Clamp occupancy to the chosen room type's limits.
        const rt = roomTypeFor(next.roomTypeId);
        if (rt) {
          next.adults = Math.max(1, Math.min(rt.maxAdults, next.adults));
          next.children = Math.max(0, Math.min(rt.maxChildren, next.children));
        }
        return next;
      })
    );
  }

  function handleLookup() {
    setError(null);
    if (!phone.trim()) return;
    setLookingUp(true);
    startTransition(async () => {
      try {
        const guest: GuestLookupResult | null = await lookupGuest(phone);
        setLookupDone(true);
        if (guest) {
          setExistingGuest(true);
          setName(guest.name);
          setEmail(guest.email ?? "");
          setAddress(guest.address ?? "");
          setIdType(guest.idType ?? "");
          setIdNumber(guest.idNumber ?? "");
        } else {
          setExistingGuest(false);
        }
      } catch {
        setError("Lookup failed. Enter the guest details manually.");
      } finally {
        setLookingUp(false);
      }
    });
  }

  function goToGuestStep() {
    setError(null);
    if (validLines.length === 0) {
      setError("Add at least one room to continue.");
      return;
    }
    if (overbookedType) {
      setError(
        `Only ${overbookedType.availableCount} ${overbookedType.name} room(s) are available for these dates.`
      );
      return;
    }
    setStep(3);
  }

  function goToPaymentStep() {
    setError(null);
    if (!name.trim()) {
      setError("Guest name is required.");
      return;
    }
    if (!phone.trim()) {
      setError("Guest phone is required.");
      return;
    }
    // Pre-fill the payment amount with the full total the first time we land here.
    if (hasPricing && amount === "") {
      setAmount(String(grandTotal / 100));
    }
    setStep(4);
  }

  function handleSubmit() {
    setError(null);
    if (validLines.length === 0) {
      setError("Add at least one room.");
      return;
    }
    const payAmount = paymentMethod === "None" ? 0 : Number(amount || 0);
    if (paymentMethod !== "None" && (Number.isNaN(payAmount) || payAmount < 0)) {
      setError("Enter a valid payment amount.");
      return;
    }

    startTransition(async () => {
      const res = await createAdminBooking({
        checkIn,
        checkOut,
        rooms: validLines.map((l) => ({
          roomTypeId: l.roomTypeId,
          adults: l.adults,
          children: l.children,
        })),
        source,
        mealPlan,
        addonIds: selectedAddons,
        guest: {
          name: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim(),
          address: address.trim() || undefined,
          idType: idType.trim() || undefined,
          idNumber: idNumber.trim() || undefined,
        },
        payment: { method: paymentMethod, amountRupees: payAmount },
      });
      // On success the action redirects; only an error object returns here.
      if (res && !res.ok) setError(res.message);
    });
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link
          href="/admin/bookings"
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mb-3"
        >
          <ArrowLeft size={14} /> Back to bookings
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">New Booking</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Book one or more rooms for a single guest.
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const active = n === step;
          const done = n < step;
          return (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
                  active
                    ? "bg-[#1a3a2a] text-white"
                    : done
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/20">
                  {done ? <Check size={11} /> : n}
                </span>
                {label}
              </div>
              {i < STEPS.length - 1 && <div className="w-4 h-px bg-gray-200" />}
            </div>
          );
        })}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg px-4 py-2.5">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* ── Step 1 — Stay ───────────────────────────────────────────── */}
          {step === 1 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <h2 className="font-medium text-gray-900 text-sm">Stay details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Check-in</label>
                  <input
                    type="date"
                    value={checkIn}
                    min={todayStr()}
                    onChange={(e) => {
                      setCheckIn(e.target.value);
                      resetRooms();
                    }}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Check-out</label>
                  <input
                    type="date"
                    value={checkOut}
                    min={checkIn}
                    onChange={(e) => {
                      setCheckOut(e.target.value);
                      resetRooms();
                    }}
                    className={inputClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Booking source</label>
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    className={inputClass}
                  >
                    {BOOKING_SOURCE_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {sourceBadge[s].label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                type="button"
                disabled={checking || isPending}
                onClick={handleCheckAvailability}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-[#1a3a2a] text-white rounded-lg hover:bg-[#14301f] disabled:opacity-50 transition-colors"
              >
                {checking ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                Check Availability
              </button>
            </div>
          )}

          {/* ── Step 2 — Rooms & meal plan ──────────────────────────────── */}
          {step === 2 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-gray-900 text-sm">Rooms</h2>
                <span className="text-xs text-gray-400">
                  {validLines.length} room{validLines.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="space-y-3">
                {lines.map((line, idx) => {
                  const rt = roomTypeFor(line.roomTypeId);
                  const linePrice = priceForLine(line);
                  return (
                    <div
                      key={line.id}
                      className="rounded-lg border border-gray-200 p-3 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-gray-500">
                          Room {idx + 1}
                        </span>
                        {lines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLine(line.id)}
                            className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-600"
                          >
                            <Trash2 size={13} /> Remove
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="sm:col-span-2">
                          <label className={labelClass}>Room type</label>
                          <select
                            value={line.roomTypeId}
                            onChange={(e) =>
                              updateLine(line.id, { roomTypeId: e.target.value })
                            }
                            className={inputClass}
                          >
                            {rooms?.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name} — {formatINR(r.basePrice)}/night ({r.availableCount} avail)
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>Adults</label>
                          <select
                            value={line.adults}
                            onChange={(e) =>
                              updateLine(line.id, { adults: Number(e.target.value) })
                            }
                            className={inputClass}
                          >
                            {Array.from({ length: rt?.maxAdults ?? 4 }, (_, i) => i + 1).map(
                              (n) => (
                                <option key={n} value={n}>
                                  {n}
                                </option>
                              )
                            )}
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>Children</label>
                          <select
                            value={line.children}
                            onChange={(e) =>
                              updateLine(line.id, { children: Number(e.target.value) })
                            }
                            className={inputClass}
                          >
                            {Array.from({ length: (rt?.maxChildren ?? 2) + 1 }, (_, i) => i).map(
                              (n) => (
                                <option key={n} value={n}>
                                  {n}
                                </option>
                              )
                            )}
                          </select>
                        </div>
                      </div>

                      {linePrice && (
                        <div className="flex items-center justify-between text-xs text-gray-500 border-t border-gray-100 pt-2">
                          <span>
                            {linePrice.nights.length} night
                            {linePrice.nights.length !== 1 ? "s" : ""}
                          </span>
                          <span className="font-medium text-gray-700">
                            {formatINR(linePrice.totalAmount)}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={addLine}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-dashed border-gray-300 text-gray-600 rounded-lg hover:border-[#1a3a2a] hover:text-[#1a3a2a] transition-colors w-full justify-center"
              >
                <Plus size={15} /> Add another room
              </button>

              {overbookedType && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  Only {overbookedType.availableCount} {overbookedType.name} room(s) are
                  available for these dates.
                </p>
              )}

              <div>
                <label className={labelClass}>Meal plan</label>
                <select
                  value={mealPlan}
                  onChange={(e) => setMealPlan(e.target.value as MealPlan)}
                  className={inputClass}
                >
                  {MEAL_PLAN_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {mealPlanLabel[m]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={goToGuestStep}
                  className="px-4 py-2 text-sm bg-[#1a3a2a] text-white rounded-lg hover:bg-[#14301f] transition-colors"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3 — Guest ──────────────────────────────────────────── */}
          {step === 3 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <h2 className="font-medium text-gray-900 text-sm">Guest details</h2>

              <div>
                <label className={labelClass}>Phone</label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setExistingGuest(false);
                      setLookupDone(false);
                    }}
                    placeholder="Guest phone number"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    disabled={lookingUp || !phone.trim()}
                    onClick={handleLookup}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 whitespace-nowrap"
                  >
                    {lookingUp ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Search size={14} />
                    )}
                    Look up
                  </button>
                </div>
                {existingGuest && (
                  <div className="mt-2 inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
                    <UserCheck size={13} /> Using existing guest
                  </div>
                )}
                {lookupDone && !existingGuest && (
                  <p className="mt-2 text-xs text-gray-400">
                    No existing guest found — a new record will be created.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className={labelClass}>Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full name"
                    className={inputClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Email (optional)</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="guest@example.com"
                    className={inputClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Address (optional)</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>ID type (optional)</label>
                  <input
                    type="text"
                    value={idType}
                    onChange={(e) => setIdType(e.target.value)}
                    placeholder="Aadhaar, Passport…"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>ID number (optional)</label>
                  <input
                    type="text"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              {addons.length > 0 && (
                <div>
                  <label className={labelClass}>Add-ons</label>
                  <div className="space-y-2">
                    {addons.map((a) => {
                      const checked = selectedAddons.includes(a.id);
                      return (
                        <label
                          key={a.id}
                          className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-gray-200 cursor-pointer hover:border-gray-300"
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                setSelectedAddons((prev) =>
                                  e.target.checked
                                    ? [...prev, a.id]
                                    : prev.filter((id) => id !== a.id)
                                )
                              }
                              className="accent-[#1a3a2a]"
                            />
                            <span className="text-sm text-gray-800">{a.name}</span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {formatINR(a.price)} {a.unit}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={goToPaymentStep}
                  className="px-4 py-2 text-sm bg-[#1a3a2a] text-white rounded-lg hover:bg-[#14301f] transition-colors"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* ── Step 4 — Payment ────────────────────────────────────────── */}
          {step === 4 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <h2 className="font-medium text-gray-900 text-sm">Payment</h2>

              <div>
                <label className={labelClass}>Payment method</label>
                <div className="flex flex-wrap gap-2">
                  {PAYMENT_METHODS.map((m) => {
                    const selected = paymentMethod === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPaymentMethod(m)}
                        className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                          selected
                            ? "border-[#1a3a2a] bg-[#1a3a2a] text-white"
                            : "border-gray-200 text-gray-600 hover:border-gray-300"
                        }`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>

              {paymentMethod !== "None" && (
                <div className="max-w-xs">
                  <label className={labelClass}>Amount (₹)</label>
                  <input
                    type="number"
                    min={0}
                    step="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className={inputClass}
                  />
                  {hasPricing && (
                    <div className="flex gap-3 mt-1.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setAmount(String(grandTotal / 100))}
                        className="text-[#1a3a2a] hover:underline"
                      >
                        Full ({formatINR(grandTotal)})
                      </button>
                      <button
                        type="button"
                        onClick={() => setAmount(String(Math.round(grandTotal / 2) / 100))}
                        className="text-[#1a3a2a] hover:underline"
                      >
                        50% advance
                      </button>
                    </div>
                  )}
                </div>
              )}

              {paymentMethod === "None" && (
                <p className="text-xs text-gray-500">
                  No payment recorded — booking will be created as <strong>Pending</strong>.
                </p>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleSubmit}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-[#1a3a2a] text-white rounded-lg hover:bg-[#14301f] disabled:opacity-50 transition-colors"
                >
                  {isPending && <Loader2 size={15} className="animate-spin" />}
                  Create Booking
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Price summary panel ──────────────────────────────────────── */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 p-5 sticky top-4">
            <h2 className="font-medium text-gray-900 text-sm mb-3">Summary</h2>
            {!hasPricing ? (
              <p className="text-xs text-gray-400">
                Select dates and at least one room to see pricing.
              </p>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="text-xs text-gray-500">
                  {validLines.length} room{validLines.length !== 1 ? "s" : ""} ·{" "}
                  {nightsCount} night{nightsCount !== 1 ? "s" : ""} · {mealPlanLabel[mealPlan]}
                </div>
                <div className="space-y-1 border-t border-gray-100 pt-2">
                  {linePrices.map((lp, i) => {
                    const rt = roomTypeFor(lp.line.roomTypeId);
                    return (
                      <div key={lp.line.id} className="flex justify-between text-xs">
                        <span className="text-gray-500 truncate pr-2">
                          {i + 1}. {rt?.name ?? "Room"}
                        </span>
                        <span className="text-gray-600 whitespace-nowrap">
                          {formatINR(lp.price?.totalAmount ?? 0)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="border-t border-gray-100 pt-2 flex justify-between">
                  <span className="text-gray-500">Room subtotal</span>
                  <span className="text-gray-700">{formatINR(roomSubtotal)}</span>
                </div>
                {extraCharges > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Extra guest charges</span>
                    <span className="text-gray-700">{formatINR(extraCharges)}</span>
                  </div>
                )}
                {addonBase > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Add-ons</span>
                    <span className="text-gray-700">{formatINR(addonBase)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">GST</span>
                  <span className="text-gray-700">{formatINR(gstTotal)}</span>
                </div>
                <div className="flex justify-between font-semibold text-base border-t border-gray-100 pt-2 mt-1">
                  <span className="text-gray-900">Total</span>
                  <span className="text-gray-900">{formatINR(grandTotal)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
