"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, MapPin, MessageCircle } from "lucide-react";
import { HERO_IMAGES, RESORT, waLink } from "@/lib/data";

const SLIDE_DURATION = 5000;

export function Hero() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActive((prev) => (prev + 1) % HERO_IMAGES.length);
    }, SLIDE_DURATION);
    return () => clearInterval(timer);
  }, []);

  return (
    <section id="home" className="relative h-svh min-h-[640px] w-full overflow-hidden">
      {/* Image slideshow */}
      <div className="absolute inset-0">
        <AnimatePresence initial={false}>
          <motion.div
            key={active}
            initial={{ opacity: 0, scale: 1.08 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              opacity: { duration: 1.2, ease: "easeInOut" },
              scale: { duration: 8, ease: "linear" },
            }}
            className="absolute inset-0"
          >
            <Image
              src={HERO_IMAGES[active]}
              alt="Riverscape resort"
              fill
              priority={active === 0}
              sizes="100vw"
              className="object-cover"
              quality={90}
            />
          </motion.div>
        </AnimatePresence>

        {/* Preload next image */}
        <link
          rel="preload"
          as="image"
          href={HERO_IMAGES[(active + 1) % HERO_IMAGES.length]}
        />
      </div>

      {/* Overlays for legibility */}
      <div className="absolute inset-0 bg-gradient-to-b from-forest-dark/50 via-forest-dark/30 to-forest-dark/80" />
      <div className="absolute inset-0 bg-forest-dark/20" />

      <div className="relative z-10 mx-auto flex h-full max-w-5xl flex-col items-center justify-center px-6 text-center">
        <motion.span
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mb-5 text-xs font-semibold uppercase tracking-[0.4em] text-gold-light"
        >
          A Luxury Riverside Resort
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="font-serif text-6xl font-medium leading-none text-cream drop-shadow-lg sm:text-7xl md:text-8xl lg:text-9xl"
        >
          Riverscape
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.7 }}
          className="mt-5 max-w-xl text-balance text-lg font-light text-cream/90 sm:text-xl md:text-2xl"
        >
          Where Nature Meets Luxury
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.8 }}
          className="mt-5 flex items-center gap-2 text-sm font-medium tracking-wide text-cream/80"
        >
          <MapPin size={16} className="text-gold-light" />
          {RESORT.locationLong}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.9 }}
          className="mt-10 flex flex-col items-center gap-4 sm:flex-row"
        >
          <Link
            href="/rooms"
            className="rounded-full bg-gold px-9 py-4 text-sm font-medium tracking-wide text-forest-dark shadow-xl shadow-gold/30 transition-all duration-300 hover:-translate-y-0.5 hover:bg-gold-light"
          >
            Explore Rooms
          </Link>
          <a
            href={waLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-cream/50 px-9 py-4 text-sm font-medium tracking-wide text-cream backdrop-blur-sm transition-all duration-300 hover:bg-cream hover:text-forest"
          >
            <MessageCircle size={16} />
            Book Now
          </a>
        </motion.div>
      </div>

      {/* Slide indicators */}
      <div className="absolute bottom-24 left-1/2 z-10 flex -translate-x-1/2 gap-2">
        {HERO_IMAGES.map((_, i) => (
          <button
            key={i}
            aria-label={`Show slide ${i + 1}`}
            onClick={() => setActive(i)}
            className={`h-1 rounded-full transition-all duration-500 ${
              i === active ? "w-8 bg-gold" : "w-4 bg-cream/40 hover:bg-cream/70"
            }`}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, y: [0, 10, 0] }}
        transition={{ opacity: { delay: 1.2 }, y: { duration: 2, repeat: Infinity } }}
        className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 text-cream/70"
      >
        <ChevronDown size={28} />
      </motion.div>
    </section>
  );
}
