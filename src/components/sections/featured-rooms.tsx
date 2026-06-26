import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { rooms } from "@/lib/data";
import { RoomCard } from "@/components/room-card";
import { SectionHeading } from "@/components/section-heading";
import { StaggerContainer, StaggerItem } from "@/components/animations";

export function FeaturedRooms() {
  const featured = rooms.slice(0, 3);

  return (
    <section className="bg-forest py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <SectionHeading
          light
          eyebrow="Stay With Us"
          title="Featured Rooms & Suites"
          description="Pool villas and water-facing suites in Kalady Neeleswaram — each framing the river in its own way."
        />

        <StaggerContainer className="mt-14 grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((room) => (
            <StaggerItem key={room.id}>
              <RoomCard room={room} />
            </StaggerItem>
          ))}
        </StaggerContainer>

        <div className="mt-12 text-center">
          <Link
            href="/rooms"
            className="inline-flex items-center gap-2 rounded-full bg-gold px-9 py-4 text-sm font-medium tracking-wide text-forest-dark shadow-lg shadow-gold/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-gold-light"
          >
            View All Rooms
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
