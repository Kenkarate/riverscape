import Image from "next/image";
import Link from "next/link";
import { Users, Maximize, ArrowRight } from "lucide-react";
import type { Room } from "@/types";
import { formatPrice } from "@/lib/data";

export function RoomCard({
  room,
  href,
  ctaLabel = "View Details",
  className,
}: {
  room: Room;
  href?: string;
  ctaLabel?: string;
  className?: string;
}) {
  const target = href ?? `/rooms/${room.id}`;

  return (
    <Link
      href={target}
      className={`group flex h-full flex-col overflow-hidden rounded-3xl bg-cream shadow-sm ring-1 ring-forest/5 transition-all duration-500 hover:shadow-2xl hover:shadow-forest/10 ${className ?? ""}`}
    >
      <div className="relative h-60 w-full overflow-hidden">
        <Image
          src={room.image}
          alt={room.name}
          fill
          sizes="(max-width: 768px) 85vw, 360px"
          className="object-cover transition-transform duration-700 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-forest-dark/40 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        <div className="absolute right-4 top-4 rounded-full bg-cream/90 px-3 py-1 text-xs font-semibold text-forest backdrop-blur">
          {formatPrice(room.price)}
          <span className="font-normal text-forest/60"> / night</span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-2xl text-forest">{room.name}</h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-forest/65">
          {room.description}
        </p>

        <div className="mt-4 flex items-center gap-5 text-xs text-forest/55">
          <span className="flex items-center gap-1.5">
            <Users size={15} className="text-gold-dark" /> {room.capacity} Guests
          </span>
          <span className="flex items-center gap-1.5">
            <Maximize size={15} className="text-gold-dark" /> {room.size}
          </span>
        </div>

        <span className="mt-6 inline-flex items-center justify-center gap-2 rounded-full border border-forest/30 px-7 py-2.5 text-sm font-medium tracking-wide text-forest transition-all duration-300 group-hover:bg-forest group-hover:text-cream">
          {ctaLabel}
          <ArrowRight size={15} className="transition-transform duration-300 group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}
