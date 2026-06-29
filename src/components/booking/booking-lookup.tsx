"use client";

import { useState } from "react";
import { Search, Mail, Hash, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { BookingDetailsCard } from "@/components/booking/booking-details-card";
import type { BookingDetails } from "@/types/booking";

export function BookingLookup({
  initialRef = "",
  lockRef = false,
  compact = false,
}: {
  initialRef?: string;
  lockRef?: boolean;
  compact?: boolean;
}) {
  const [ref, setRef] = useState(initialRef);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [lookedUpEmail, setLookedUpEmail] = useState("");

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    const trimmedRef = ref.trim().toUpperCase();
    const trimmedEmail = email.trim();
    if (!trimmedRef || !trimmedEmail) return;

    setLoading(true);
    setError(null);
    setBooking(null);
    try {
      const res = await fetch(
        `/api/bookings/${encodeURIComponent(trimmedRef)}?email=${encodeURIComponent(trimmedEmail)}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (res.ok && data.bookingRef) {
        setBooking(data as BookingDetails);
        setLookedUpEmail(trimmedEmail);
      } else {
        setError("No booking found with those details. Check your reference and email.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (booking) {
    return (
      <div className="space-y-5">
        <BookingDetailsCard booking={booking} email={lookedUpEmail} />
        <button
          type="button"
          onClick={() => {
            setBooking(null);
            if (!lockRef) setRef("");
            setEmail("");
            setError(null);
          }}
          className="text-sm font-medium text-forest/60 underline-offset-2 hover:text-forest hover:underline"
        >
          Look up a different booking
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleLookup}
      className={cn(
        "rounded-2xl border border-forest/10 bg-white",
        compact ? "p-5 sm:p-6" : "p-6 sm:p-8"
      )}
    >
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.15em] text-forest/50">
            <Hash size={14} />
            Booking reference
          </span>
          <input
            type="text"
            value={ref}
            onChange={(e) => setRef(e.target.value.toUpperCase())}
            placeholder="RS1A2B3C4D"
            readOnly={lockRef}
            className={cn(
              "w-full rounded-xl border border-forest/15 bg-cream/40 px-4 py-3 text-sm font-medium uppercase tracking-wide text-forest placeholder:text-forest/35 outline-none transition-colors focus:border-forest focus:bg-white",
              lockRef && "cursor-not-allowed opacity-80"
            )}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.15em] text-forest/50">
            <Mail size={14} />
            Email used to book
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className="w-full rounded-xl border border-forest/15 bg-cream/40 px-4 py-3 text-sm text-forest placeholder:text-forest/35 outline-none transition-colors focus:border-forest focus:bg-white"
          />
        </label>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !ref.trim() || !email.trim()}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-forest px-7 py-3.5 text-sm font-medium text-cream transition-all duration-300 hover:bg-forest-light disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Looking up…
          </>
        ) : (
          <>
            <Search size={16} />
            View my booking
          </>
        )}
      </button>
    </form>
  );
}
