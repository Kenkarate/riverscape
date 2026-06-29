import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CalendarDays, Users, Pencil, BedDouble, AlertCircle } from "lucide-react";
import { RoomSelectCard } from "@/components/booking/room-select-card";
import { formatStayDate, nightsBetween } from "@/lib/booking-helpers";
import type { AvailabilityResponse } from "@/types/booking";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  checkIn?: string;
  checkOut?: string;
  adults?: string;
  children?: string;
}>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(s: string | undefined): s is string {
  if (!s || !DATE_RE.test(s)) return false;
  const d = new Date(s + "T00:00:00");
  return !Number.isNaN(d.getTime());
}

async function fetchAvailability(
  checkIn: string,
  checkOut: string,
  adults: number,
  children: number
): Promise<AvailabilityResponse | null> {
  const h = await headers();
  const host = h.get("host");
  const protocol = h.get("x-forwarded-proto") ?? "http";
  if (!host) return null;

  const qs = new URLSearchParams({
    checkIn,
    checkOut,
    adults: String(adults),
    children: String(children),
  });

  try {
    const res = await fetch(`${protocol}://${host}/api/availability?${qs.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as AvailabilityResponse;
  } catch {
    return null;
  }
}

export default async function BookRoomsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;

  // --- Validate search params; redirect home on anything malformed ---
  const checkIn = sp.checkIn;
  const checkOut = sp.checkOut;

  if (!isValidDate(checkIn) || !isValidDate(checkOut)) redirect("/");
  if (checkOut <= checkIn) redirect("/");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (new Date(checkIn + "T00:00:00") < today) redirect("/");

  const adults = Math.min(20, Math.max(1, Number(sp.adults) || 2));
  const children = Math.min(20, Math.max(0, Number(sp.children) || 0));
  const nights = nightsBetween(checkIn, checkOut);

  const data = await fetchAvailability(checkIn, checkOut, adults, children);
  const rooms = data?.rooms ?? [];

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10 lg:py-14">
      {/* --- Search summary / modify banner --- */}
      <div className="overflow-hidden rounded-2xl border border-forest/10 bg-white shadow-sm">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <SummaryItem
              icon={<CalendarDays size={16} className="text-gold-dark" />}
              label="Check-in"
              value={formatStayDate(checkIn)}
            />
            <span className="hidden text-forest/20 sm:inline">—</span>
            <SummaryItem
              icon={<CalendarDays size={16} className="text-gold-dark" />}
              label="Check-out"
              value={formatStayDate(checkOut)}
            />
            <SummaryItem
              icon={<Users size={16} className="text-gold-dark" />}
              label="Guests"
              value={`${adults} adult${adults > 1 ? "s" : ""}${
                children > 0 ? `, ${children} child${children > 1 ? "ren" : ""}` : ""
              }`}
            />
            <SummaryItem
              icon={<BedDouble size={16} className="text-gold-dark" />}
              label="Duration"
              value={`${nights} night${nights > 1 ? "s" : ""}`}
            />
          </div>

          <Link
            href="/#availability"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-forest/30 px-5 py-2.5 text-sm font-medium text-forest transition-colors hover:bg-forest hover:text-cream"
          >
            <Pencil size={14} />
            Modify search
          </Link>
        </div>
      </div>

      {/* --- Heading --- */}
      <div className="mt-10 mb-6">
        <span className="text-xs font-semibold uppercase tracking-[0.25em] text-gold-dark">
          Step 1 of 3 · Choose your room
        </span>
        <h1 className="mt-2 font-serif text-4xl text-forest sm:text-5xl">
          {rooms.length > 0
            ? `${rooms.length} room${rooms.length > 1 ? "s" : ""} available`
            : "Availability"}
        </h1>
        <p className="mt-2 max-w-2xl text-forest/65">
          Prices are for your full stay and shown before taxes. Taxes, add-ons and any
          coupon are applied at checkout.
        </p>
      </div>

      {/* --- Results --- */}
      {rooms.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-7 lg:grid-cols-2">
          {rooms.map((room) => (
            <RoomSelectCard
              key={room.id}
              room={room}
              checkIn={checkIn}
              checkOut={checkOut}
              adults={adults}
              childrenCount={children}
              nights={nights}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cream">
        {icon}
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-forest/45">
          {label}
        </span>
        <span className="text-sm font-medium text-forest">{value}</span>
      </span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-forest/20 bg-white px-6 py-20 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-cream">
        <AlertCircle size={26} className="text-gold-dark" />
      </span>
      <h2 className="mt-5 font-serif text-2xl text-forest">No rooms available</h2>
      <p className="mt-2 max-w-md text-sm text-forest/60">
        We couldn&apos;t find rooms matching your dates and guest count. Try adjusting your
        dates, or reach us directly and we&apos;ll do our best to help.
      </p>
      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/#availability"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-forest px-7 py-3 text-sm font-medium text-cream transition-colors hover:bg-forest-light"
        >
          Change dates
        </Link>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 rounded-full border border-forest/30 px-7 py-3 text-sm font-medium text-forest transition-colors hover:bg-forest/5"
        >
          Back to homepage
        </Link>
      </div>
    </div>
  );
}
