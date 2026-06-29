import Link from "next/link";
import { CheckCircle2, MessageCircle, ArrowRight, Mail } from "lucide-react";
import { BookingLookup } from "@/components/booking/booking-lookup";
import { waLink, RESORT } from "@/lib/data";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ ref?: string }>;

export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { ref } = await searchParams;

  // No reference — gentle fallback so the page is never a dead end.
  if (!ref) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h1 className="font-serif text-3xl text-forest">No booking reference found</h1>
        <p className="mt-3 text-forest/65">
          If you&apos;ve just paid, please check your email for your confirmation, or look up your
          booking below.
        </p>
        <Link
          href="/my-booking"
          className="mt-7 inline-flex items-center gap-2 rounded-full bg-forest px-7 py-3 text-sm font-medium text-cream transition-colors hover:bg-forest-light"
        >
          Find my booking
          <ArrowRight size={16} />
        </Link>
      </div>
    );
  }

  const waMessage = `Hi, I've just completed a booking at Riverscape. My reference is ${ref}.`;

  return (
    <div className="mx-auto max-w-2xl px-6 py-12 lg:py-16">
      {/* Success hero */}
      <div className="overflow-hidden rounded-3xl border border-forest/10 bg-white shadow-sm">
        <div className="bg-forest px-6 py-12 text-center sm:px-10">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gold/20 ring-4 ring-gold/10">
            <CheckCircle2 size={36} className="text-gold-light" />
          </span>
          <h1 className="mt-5 font-serif text-3xl text-cream sm:text-4xl">Booking confirmed</h1>
          <p className="mt-2 text-cream/75">
            Thank you for choosing Riverscape. A confirmation has been sent to your email.
          </p>
          <div className="mx-auto mt-6 inline-flex flex-col items-center rounded-2xl bg-forest-dark/40 px-8 py-4">
            <span className="text-xs font-medium uppercase tracking-[0.25em] text-cream/60">
              Booking reference
            </span>
            <span className="mt-1 font-serif text-2xl tracking-wide text-gold-light">{ref}</span>
          </div>
        </div>

        <div className="px-6 py-7 sm:px-10">
          <p className="flex items-start gap-2 text-sm text-forest/65">
            <Mail size={16} className="mt-0.5 shrink-0 text-gold-dark" />
            Keep your booking reference handy. You can view or manage your reservation anytime using
            your reference and the email you booked with.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a
              href={waLink(waMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-medium text-forest-dark shadow-lg shadow-gold/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-gold-light"
            >
              <MessageCircle size={16} />
              Message us on WhatsApp
            </a>
            <Link
              href="/"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-forest/25 px-6 py-3 text-sm font-medium text-forest transition-colors hover:bg-forest/5"
            >
              Back to homepage
            </Link>
          </div>
        </div>
      </div>

      {/* Retrieve full details */}
      <div className="mt-10">
        <h2 className="font-serif text-2xl text-forest">View your full booking details</h2>
        <p className="mt-1 text-sm text-forest/60">
          Enter the email you used to book to see your complete reservation.
        </p>
        <div className="mt-5">
          <BookingLookup initialRef={ref} lockRef compact />
        </div>
      </div>

      <p className="mt-8 text-center text-xs text-forest/45">
        Need help? Call us at {RESORT.phone} or email{" "}
        <a href={`mailto:${RESORT.email}`} className="underline-offset-2 hover:underline">
          {RESORT.email}
        </a>
        .
      </p>
    </div>
  );
}
