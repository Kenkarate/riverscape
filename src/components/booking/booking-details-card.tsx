"use client";

import { useState } from "react";
import Image from "next/image";
import {
  CalendarDays,
  Users,
  Utensils,
  CreditCard,
  Loader2,
  XCircle,
  MessageSquare,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatINR } from "@/lib/pricing";
import {
  formatStayDate,
  nightsBetween,
  statusBadgeClass,
  statusLabel,
} from "@/lib/booking-helpers";
import { mealPlanLabel, type BookingDetails } from "@/types/booking";

const CANCELLABLE = ["PENDING", "CONFIRMED"];

export function BookingDetailsCard({
  booking: initial,
  email,
}: {
  booking: BookingDetails;
  email: string;
}) {
  const [booking, setBooking] = useState<BookingDetails>(initial);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const nights = nightsBetween(booking.checkIn, booking.checkOut);
  const room = booking.rooms[0];
  const canCancel = CANCELLABLE.includes(booking.status);

  async function handleCancel() {
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await fetch(`/api/bookings/${booking.bookingRef}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, reason: "Cancelled by guest" }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBooking((b) => ({ ...b, status: "CANCELLED", cancelledAt: new Date().toISOString() }));
        setConfirmOpen(false);
      } else {
        setCancelError(
          typeof data.error === "string" ? data.error : "Could not cancel this booking."
        );
      }
    } catch {
      setCancelError("Something went wrong. Please try again.");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-forest/10 bg-white shadow-sm">
      {/* Header */}
      <div className="relative">
        <div className="relative h-40 w-full sm:h-48">
          <Image
            src={room?.roomType.images?.[0] || "/images/landscape/1.jpg"}
            alt={room?.roomType.name ?? "Riverscape"}
            fill
            sizes="(max-width: 768px) 100vw, 640px"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-forest-dark/80 via-forest-dark/30 to-transparent" />
        </div>
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-cream/70">
              Booking reference
            </p>
            <p className="font-serif text-2xl text-cream">{booking.bookingRef}</p>
          </div>
          <span
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold",
              statusBadgeClass(booking.status)
            )}
          >
            {statusLabel(booking.status)}
          </span>
        </div>
      </div>

      <div className="p-5 sm:p-7">
        {/* Stay facts */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Fact icon={<CalendarDays size={16} />} label="Check-in" value={formatStayDate(booking.checkIn)} />
          <Fact icon={<CalendarDays size={16} />} label="Check-out" value={formatStayDate(booking.checkOut)} />
          <Fact
            icon={<Users size={16} />}
            label="Guests"
            value={`${booking.adults} adult${booking.adults > 1 ? "s" : ""}${
              booking.children > 0
                ? `, ${booking.children} child${booking.children > 1 ? "ren" : ""}`
                : ""
            }`}
          />
          <Fact
            icon={<Utensils size={16} />}
            label="Meal plan"
            value={mealPlanLabel(booking.mealPlan)}
          />
        </div>

        {/* Room */}
        {room && (
          <div className="mt-6 rounded-xl bg-cream/50 px-4 py-4">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-forest/45">Room</p>
            <p className="mt-1 font-serif text-xl text-forest">{room.roomType.name}</p>
            <p className="text-sm text-forest/55">
              {nights} night{nights > 1 ? "s" : ""}
              {room.room?.number ? ` · Room ${room.room.number}` : ""}
            </p>
          </div>
        )}

        {/* Add-ons */}
        {booking.addons.length > 0 && (
          <div className="mt-6">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-forest/45">Add-ons</p>
            <ul className="mt-2 space-y-1.5">
              {booking.addons.map((ba, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span className="text-forest/70">
                    {ba.addon.name}
                    {ba.quantity > 1 ? ` × ${ba.quantity}` : ""}
                  </span>
                  <span className="font-medium text-forest">{formatINR(ba.total)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Guest */}
        <div className="mt-6">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-forest/45">Guest</p>
          <p className="mt-1 text-sm text-forest">{booking.guest.name}</p>
          <p className="text-sm text-forest/55">{booking.guest.email}</p>
          <p className="text-sm text-forest/55">{booking.guest.phone}</p>
          {booking.specialRequests && (
            <p className="mt-2 flex items-start gap-1.5 text-sm text-forest/60">
              <MessageSquare size={14} className="mt-0.5 shrink-0 text-gold-dark" />
              {booking.specialRequests}
            </p>
          )}
        </div>

        {/* Financials */}
        <div className="mt-6 rounded-xl border border-forest/10 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-forest/45">Summary</p>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Room subtotal" value={formatINR(booking.roomSubtotal)} />
            {booking.addonSubtotal > 0 && (
              <Row label="Add-ons & extras" value={formatINR(booking.addonSubtotal)} />
            )}
            <Row label="Taxes & GST" value={formatINR(booking.taxAmount)} />
            {booking.discountAmount > 0 && (
              <Row label="Discount" value={`− ${formatINR(booking.discountAmount)}`} accent />
            )}
            <div className="flex items-center justify-between border-t border-forest/10 pt-2.5">
              <dt className="font-semibold text-forest">Total</dt>
              <dd className="font-serif text-xl text-forest">{formatINR(booking.totalAmount)}</dd>
            </div>
            <Row label="Paid" value={formatINR(booking.paidAmount)} />
            {booking.balanceDue > 0 && (
              <Row label="Balance due" value={formatINR(booking.balanceDue)} />
            )}
          </dl>
        </div>

        {/* Payments */}
        {booking.payments.length > 0 && (
          <div className="mt-6">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-forest/45">Payments</p>
            <ul className="mt-2 space-y-2">
              {booking.payments.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-lg bg-cream/50 px-3 py-2.5 text-sm"
                >
                  <span className="flex items-center gap-2 text-forest/70">
                    <CreditCard size={15} className="text-gold-dark" />
                    {p.type}
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-medium",
                        p.status === "CAPTURED"
                          ? "bg-forest/10 text-forest"
                          : "bg-amber-100 text-amber-700"
                      )}
                    >
                      {p.status}
                    </span>
                  </span>
                  <span className="font-medium text-forest">{formatINR(p.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Cancel */}
        {canCancel && (
          <div className="mt-7 border-t border-forest/10 pt-6">
            {confirmOpen ? (
              <div className="rounded-xl bg-red-50 p-4">
                <p className="text-sm font-medium text-red-800">
                  Are you sure you want to cancel this booking?
                </p>
                <p className="mt-1 text-xs text-red-600">This action cannot be undone.</p>
                {cancelError && <p className="mt-2 text-xs text-red-700">{cancelError}</p>}
                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-red-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60"
                  >
                    {cancelling ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        Cancelling…
                      </>
                    ) : (
                      "Yes, cancel booking"
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmOpen(false)}
                    disabled={cancelling}
                    className="inline-flex items-center justify-center rounded-full border border-forest/25 px-6 py-2.5 text-sm font-medium text-forest transition-colors hover:bg-forest/5 disabled:opacity-50"
                  >
                    Keep booking
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className="inline-flex items-center gap-2 rounded-full border border-red-200 px-6 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
              >
                <XCircle size={16} />
                Cancel booking
              </button>
            )}
          </div>
        )}

        {booking.status === "CANCELLED" && (
          <div className="mt-7 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            <XCircle size={16} className="shrink-0" />
            This booking has been cancelled
            {booking.cancelledAt
              ? ` on ${formatStayDate(booking.cancelledAt.slice(0, 10))}`
              : ""}
            .
          </div>
        )}

        {(booking.status === "CONFIRMED" || booking.status === "CHECKED_IN") && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-forest/5 px-4 py-3 text-sm text-forest">
            <CheckCircle2 size={16} className="shrink-0 text-forest" />
            Your stay is confirmed. We look forward to welcoming you.
          </div>
        )}
      </div>
    </div>
  );
}

function Fact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cream text-gold-dark">
        {icon}
      </span>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-forest/45">{label}</p>
        <p className="text-sm font-medium text-forest">{value}</p>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-forest/60">{label}</dt>
      <dd className={cn("font-medium", accent ? "text-gold-dark" : "text-forest")}>{value}</dd>
    </div>
  );
}
