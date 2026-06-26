"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { fullGallery } from "@/lib/data";
import { SectionHeading } from "@/components/section-heading";

export function GalleryTeaser() {
  // Pick a varied set of 8 images for the teaser.
  const teaser = [
    fullGallery[0],
    fullGallery[10],
    fullGallery[2],
    fullGallery[14],
    fullGallery[4],
    fullGallery[18],
    fullGallery[6],
    fullGallery[12],
  ].filter(Boolean);

  return (
    <section className="bg-cream py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <SectionHeading
          eyebrow="Moments"
          title="A Glimpse of Riverscape"
          description="The river, the villas, the rituals — explore life at the resort."
        />

        <div className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {teaser.map((img, i) => (
            <motion.div
              key={img.src + i}
              initial={{ opacity: 0, scale: 0.92 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: (i % 4) * 0.06, ease: [0.22, 1, 0.36, 1] }}
              className="group relative aspect-square overflow-hidden rounded-xl"
            >
              <Image
                src={img.src}
                alt={img.alt}
                fill
                sizes="(max-width: 640px) 50vw, 25vw"
                className="object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-forest-dark/0 transition-colors duration-500 group-hover:bg-forest-dark/20" />
            </motion.div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/gallery"
            className="inline-flex items-center gap-2 rounded-full border border-forest/30 px-9 py-4 text-sm font-medium tracking-wide text-forest transition-all duration-300 hover:bg-forest hover:text-cream"
          >
            View Full Gallery
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
