import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Users, Maximize, Check, MessageCircle, MapPin, UtensilsCrossed } from "lucide-react";
import {
  rooms,
  getRoomBySlug,
  formatPrice,
  waRoomLink,
  EXTRA_CHARGES,
  RESORT,
} from "@/lib/data";
import { RoomGallery } from "@/components/room-gallery";

export function generateStaticParams() {
  return rooms.map((room) => ({ slug: room.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const room = getRoomBySlug(slug);
  if (!room) return { title: "Room Not Found | Riverscape" };
  return {
    title: `${room.name} | Riverscape Resort, Kerala`,
    description: room.description,
    openGraph: { title: `${room.name} | Riverscape`, images: [room.image] },
  };
}

export default async function RoomDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const room = getRoomBySlug(slug);
  if (!room) notFound();

  const isGroup = room.capacity >= 4;

  return (
    <div className="bg-cream pt-28 pb-24 sm:pt-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <Link
          href="/rooms"
          className="inline-flex items-center gap-2 text-sm font-medium text-forest/70 transition-colors hover:text-forest"
        >
          <ArrowLeft size={16} />
          Back to all rooms
        </Link>

        <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-14">
          {/* Gallery */}
          <div>
            <RoomGallery photos={room.gallery} name={room.name} />
          </div>

          {/* Details */}
          <div className="lg:pt-2">
            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-gold-dark">
              {isGroup ? "Group Stay" : "Accommodation"}
            </span>
            <h1 className="mt-2 text-4xl text-forest sm:text-5xl">{room.name}</h1>

            <p className="mt-2 flex items-center gap-2 text-sm text-forest/60">
              <MapPin size={15} className="text-gold-dark" />
              {RESORT.location}
            </p>

            <div className="mt-5 flex items-baseline gap-2">
              <span className="font-serif text-4xl text-forest">{formatPrice(room.price)}</span>
              <span className="text-sm text-forest/60">
                / night · {isGroup ? "4 adults sharing" : "2 adults sharing"}
              </span>
            </div>

            <div className="mt-5 flex items-center gap-6 text-sm text-forest/65">
              <span className="flex items-center gap-1.5">
                <Users size={16} className="text-gold-dark" /> {room.capacity} Guests
              </span>
              <span className="flex items-center gap-1.5">
                <Maximize size={16} className="text-gold-dark" /> {room.size}
              </span>
            </div>

            <p className="mt-6 text-base leading-relaxed text-forest/75">
              {room.longDescription}
            </p>

            {/* Room amenities */}
            <h2 className="mt-8 text-xl text-forest">Room Highlights</h2>
            <ul className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {room.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-forest/75">
                  <Check size={16} className="text-gold-dark" /> {f}
                </li>
              ))}
            </ul>

            <a
              href={waRoomLink(room.name)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-forest px-8 py-4 text-sm font-medium tracking-wide text-cream transition-all duration-300 hover:bg-forest-light sm:w-auto"
            >
              <MessageCircle size={18} />
              Book This Room on WhatsApp
            </a>
          </div>
        </div>

        {/* Charges & meal plan */}
        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-forest/10 bg-white/50 p-7">
            <h3 className="text-xl text-forest">Extra Person Charges</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-forest/75">
              {EXTRA_CHARGES.map((c) => (
                <li key={c.label} className="flex items-center justify-between gap-4 border-b border-forest/5 pb-2.5 last:border-0">
                  <span>{c.label}</span>
                  <span className="font-medium text-forest">
                    {formatPrice(c.price)} {c.unit}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-forest/10 bg-white/50 p-7">
            <h3 className="flex items-center gap-2 text-xl text-forest">
              <UtensilsCrossed size={20} className="text-gold-dark" />
              Meal Plans
            </h3>
            <p className="mt-4 text-sm leading-relaxed text-forest/75">
              Meal plans are available on prior request. Let our team know your preferences
              when you enquire and we&apos;ll tailor breakfast, half-board or full-board
              options to your stay. Farm-to-table Kerala cuisine, crafted from local,
              seasonal harvests.
            </p>
            <a
              href={waRoomLink(room.name)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-gold-dark transition-colors hover:text-forest"
            >
              <MessageCircle size={16} />
              Ask about meal plans
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
