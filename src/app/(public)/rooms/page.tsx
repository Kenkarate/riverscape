import type { Metadata } from "next";
import Image from "next/image";
import { MapPin, MessageCircle } from "lucide-react";
import { rooms, RESORT, waLink } from "@/lib/data";
import { RoomCard } from "@/components/room-card";
import { StaggerContainer, StaggerItem } from "@/components/animations";

export const metadata: Metadata = {
  title: "Rooms & Suites | Riverscape Resort, Kerala",
  description:
    "Explore Riverscape's pool villas and water-facing suites in Kalady Neeleswaram, Kerala — from the Premium Pool Villa to the Aqua Vista suites. View details and pricing.",
};

export default function RoomsPage() {
  return (
    <>
      {/* Page header */}
      <section className="relative flex h-[55vh] min-h-[26rem] items-center justify-center overflow-hidden">
        <Image
          src="/images/landscape/4.jpg"
          alt="Riverscape grounds"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-forest-dark/60 via-forest-dark/40 to-forest-dark/80" />
        <div className="relative z-10 px-6 text-center">
          <span className="mb-3 inline-block text-xs font-semibold uppercase tracking-[0.3em] text-gold-light">
            Accommodation
          </span>
          <h1 className="font-serif text-5xl text-cream sm:text-6xl md:text-7xl">
            Rooms &amp; Suites
          </h1>
          <p className="mt-4 flex items-center justify-center gap-2 text-sm text-cream/80">
            <MapPin size={16} className="text-gold-light" />
            {RESORT.locationLong}
          </p>
        </div>
      </section>

      <section className="bg-cream py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="mb-12 max-w-2xl">
            <h2 className="text-3xl text-forest sm:text-4xl">
              Find your perfect riverside retreat
            </h2>
            <p className="mt-3 text-forest/65">
              Every room is priced for 2 adults sharing. Meal plans are available on prior
              request. Tap any room to view full details and photos.
            </p>
          </div>

          <StaggerContainer className="grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => (
              <StaggerItem key={room.id}>
                <RoomCard room={room} />
              </StaggerItem>
            ))}
          </StaggerContainer>

          <div className="mt-16 text-center">
            <a
              href={waLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-gold px-9 py-4 text-sm font-medium tracking-wide text-forest-dark shadow-lg shadow-gold/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-gold-light"
            >
              <MessageCircle size={18} />
              Enquire on WhatsApp
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
