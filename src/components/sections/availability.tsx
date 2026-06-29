"use client";

import { useState } from "react";
import { CalendarDays, Users, BedDouble, MessageCircle } from "lucide-react";
import { ROOM_TYPES, waLink } from "@/lib/data";
import { FadeIn } from "@/components/animations";

function toDisplayDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function nights(checkin: string, checkout: string) {
  if (!checkin || !checkout) return 0;
  return Math.max(0, Math.round((new Date(checkout).getTime() - new Date(checkin).getTime()) / 86_400_000));
}

export function AvailabilityChecker() {
  const today = new Date().toISOString().split("T")[0];

  const [checkin, setCheckin] = useState("");
  const [checkout, setCheckout] = useState("");
  const [guests, setGuests] = useState(2);
  const [roomType, setRoomType] = useState("");

  const numNights = nights(checkin, checkout);

  function handleCheck() {
    const msg = [
      "Hi, I'd like to check availability at Riverscape, Kalady Neeleswaram.",
      "",
      `Check-in: ${checkin ? toDisplayDate(checkin) : "Flexible"}`,
      `Check-out: ${checkout ? toDisplayDate(checkout) : "Flexible"}`,
      numNights > 0 ? `Duration: ${numNights} night${numNights > 1 ? "s" : ""}` : null,
      `Guests: ${guests} adult${guests > 1 ? "s" : ""}`,
      roomType ? `Room preference: ${roomType}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    window.open(waLink(msg), "_blank", "noopener,noreferrer");
  }

  return (
    <section className="bg-cream px-4 pt-8 pb-10">
      <FadeIn>
        <div className="mx-auto max-w-5xl">
          {/* Label */}
          <p className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.3em] text-forest/40">
            Plan Your Stay
          </p>

          <div className="overflow-hidden rounded-2xl border border-forest/8 bg-white shadow-xl shadow-forest/8">
            {/* Header strip */}
            <div className="flex items-center justify-between bg-forest px-6 py-3.5">
              <span className="font-serif text-lg text-cream">Check Availability</span>
              {numNights > 0 && (
                <span className="text-sm font-medium text-gold-light">
                  {numNights} night{numNights > 1 ? "s" : ""}
                </span>
              )}
            </div>

            {/* Fields */}
            <div className="grid grid-cols-1 divide-y divide-forest/6 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
              {/* Check-in */}
              <FieldWrap icon={<CalendarDays size={16} className="text-gold-dark" />} label="Check-in">
                <input
                  type="date"
                  min={today}
                  value={checkin}
                  onChange={(e) => {
                    setCheckin(e.target.value);
                    if (checkout && e.target.value >= checkout) setCheckout("");
                  }}
                  className="w-full cursor-pointer bg-transparent text-sm text-forest outline-none [color-scheme:light]"
                />
              </FieldWrap>

              {/* Check-out */}
              <FieldWrap icon={<CalendarDays size={16} className="text-gold-dark" />} label="Check-out">
                <input
                  type="date"
                  min={checkin || today}
                  value={checkout}
                  onChange={(e) => setCheckout(e.target.value)}
                  className="w-full cursor-pointer bg-transparent text-sm text-forest outline-none [color-scheme:light]"
                />
              </FieldWrap>

              {/* Guests */}
              <FieldWrap icon={<Users size={16} className="text-gold-dark" />} label="Guests">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    aria-label="Remove guest"
                    onClick={() => setGuests((g) => Math.max(1, g - 1))}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-forest/20 text-sm text-forest transition-colors hover:border-forest hover:bg-forest hover:text-cream"
                  >
                    −
                  </button>
                  <span className="w-5 text-center text-sm font-semibold text-forest">{guests}</span>
                  <button
                    type="button"
                    aria-label="Add guest"
                    onClick={() => setGuests((g) => Math.min(12, g + 1))}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-forest/20 text-sm text-forest transition-colors hover:border-forest hover:bg-forest hover:text-cream"
                  >
                    +
                  </button>
                  <span className="text-sm text-forest/55">adult{guests > 1 ? "s" : ""}</span>
                </div>
              </FieldWrap>

              {/* Room type */}
              <FieldWrap icon={<BedDouble size={16} className="text-gold-dark" />} label="Room type">
                <select
                  value={roomType}
                  onChange={(e) => setRoomType(e.target.value)}
                  className="w-full cursor-pointer bg-transparent text-sm text-forest outline-none"
                >
                  <option value="">Any room</option>
                  {ROOM_TYPES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </FieldWrap>
            </div>

            {/* CTA */}
            <div className="flex flex-col items-center justify-between gap-3 border-t border-forest/6 bg-cream/40 px-6 py-4 sm:flex-row">
              <p className="text-xs text-forest/45">
                No payment required — we&apos;ll confirm dates and pricing on WhatsApp.
              </p>
              <button
                type="button"
                onClick={handleCheck}
                className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-full bg-forest px-7 py-3 text-sm font-medium tracking-wide text-cream shadow-md shadow-forest/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-forest-light sm:w-auto"
              >
                <MessageCircle size={16} />
                Check Availability
              </button>
            </div>
          </div>
        </div>
      </FadeIn>
    </section>
  );
}

function FieldWrap({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 px-5 py-4">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-forest/45">{label}</span>
      </div>
      {children}
    </div>
  );
}
