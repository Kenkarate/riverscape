import type { Metadata } from "next";
import { BookingLookup } from "@/components/booking/booking-lookup";
import { RESORT } from "@/lib/data";

export const metadata: Metadata = {
  title: "Manage Your Booking | Riverscape Resort",
  description:
    "Look up your Riverscape reservation with your booking reference and email. View details, payments and cancel if you need to.",
};

export default function MyBookingPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12 lg:py-16">
      <div className="text-center">
        <span className="text-xs font-semibold uppercase tracking-[0.25em] text-gold-dark">
          Reservations
        </span>
        <h1 className="mt-2 font-serif text-4xl text-forest sm:text-5xl">Manage your booking</h1>
        <p className="mx-auto mt-3 max-w-md text-forest/65">
          Enter your booking reference and the email you booked with to view your reservation,
          payments, and cancel if your plans change.
        </p>
      </div>

      <div className="mt-9">
        <BookingLookup />
      </div>

      <p className="mt-8 text-center text-xs text-forest/45">
        Can&apos;t find your reference? Check your confirmation email, or contact us at{" "}
        {RESORT.phone} /{" "}
        <a href={`mailto:${RESORT.email}`} className="underline-offset-2 hover:underline">
          {RESORT.email}
        </a>
        .
      </p>
    </div>
  );
}
