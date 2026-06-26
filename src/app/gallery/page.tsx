import type { Metadata } from "next";
import Image from "next/image";
import { MapPin } from "lucide-react";
import { RESORT } from "@/lib/data";
import { GalleryFull } from "@/components/gallery-full";

export const metadata: Metadata = {
  title: "Gallery | Riverscape Resort, Kerala",
  description:
    "Browse the Riverscape gallery — pool villas, water-facing suites and the riverside landscapes of Kalady Neeleswaram, Kerala.",
};

export default function GalleryPage() {
  return (
    <>
      <section className="relative flex h-[45vh] min-h-[22rem] items-center justify-center overflow-hidden">
        <Image
          src="/images/landscape/1.jpg"
          alt="Riverscape resort"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-forest-dark/60 via-forest-dark/40 to-forest-dark/80" />
        <div className="relative z-10 px-6 text-center">
          <span className="mb-3 inline-block text-xs font-semibold uppercase tracking-[0.3em] text-gold-light">
            Moments
          </span>
          <h1 className="font-serif text-5xl text-cream sm:text-6xl md:text-7xl">Gallery</h1>
          <p className="mt-4 flex items-center justify-center gap-2 text-sm text-cream/80">
            <MapPin size={16} className="text-gold-light" />
            {RESORT.locationLong}
          </p>
        </div>
      </section>

      <section className="bg-cream py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <GalleryFull />
        </div>
      </section>
    </>
  );
}
