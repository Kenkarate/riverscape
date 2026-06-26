"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { FadeIn } from "@/components/animations";
import { ABOUT_IMAGES } from "@/lib/data";

export function About() {
  return (
    <section id="about" className="bg-cream py-24 sm:py-32">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 px-6 lg:grid-cols-2 lg:gap-20 lg:px-10">
        {/* Text */}
        <FadeIn className="order-2 lg:order-1">
          <span className="mb-3 inline-block text-xs font-semibold uppercase tracking-[0.25em] text-gold-dark">
            Our Story
          </span>
          <h2 className="text-4xl leading-tight text-forest sm:text-5xl">
            A sanctuary woven into the riverbank
          </h2>
          <div className="mt-6 space-y-5 text-base leading-relaxed text-forest/75 sm:text-lg">
            <p>
              Set along the gentle curve of a pristine Kerala river in
              <span className="font-medium text-forest"> Kalady Neeleswaram</span> — just
              10 km from Cochin International Airport — Riverscape is where the rush of the
              modern world dissolves into birdsong and flowing water. Every villa and suite
              has been positioned to honour the landscape, framing the water, the coconut
              palms and the backwaters beyond.
            </p>
            <p>
              Here, luxury is quiet and considered. Wake to mist rising off the river,
              spend your afternoons gliding across the water by kayak, and let our farm-to-table
              kitchen turn the day&apos;s harvest into something unforgettable. This is nature,
              refined.
            </p>
          </div>

          <div className="mt-10 flex flex-wrap gap-10">
            {[
              { value: "24", label: "Private Villas & Suites" },
              { value: "8 km", label: "Of Riverfront" },
              { value: "5★", label: "Guest Rating" },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="font-serif text-4xl text-gold-dark">{stat.value}</p>
                <p className="mt-1 text-sm text-forest/60">{stat.label}</p>
              </div>
            ))}
          </div>
        </FadeIn>

        {/* Staggered image grid */}
        <div className="order-1 grid grid-cols-2 gap-4 lg:order-2">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="relative col-span-1 row-span-2 h-[28rem] overflow-hidden rounded-2xl"
          >
            <Image
              src={ABOUT_IMAGES[0]}
              alt="Riverscape landscape view"
              fill
              sizes="(max-width: 1024px) 50vw, 25vw"
              className="object-cover transition-transform duration-700 hover:scale-105"
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="relative h-[13.5rem] overflow-hidden rounded-2xl"
          >
            <Image
              src={ABOUT_IMAGES[1]}
              alt="Forest surroundings"
              fill
              sizes="(max-width: 1024px) 50vw, 25vw"
              className="object-cover transition-transform duration-700 hover:scale-105"
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="relative h-[13.5rem] overflow-hidden rounded-2xl"
          >
            <Image
              src={ABOUT_IMAGES[2]}
              alt="River reflections"
              fill
              sizes="(max-width: 1024px) 50vw, 25vw"
              className="object-cover transition-transform duration-700 hover:scale-105"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
