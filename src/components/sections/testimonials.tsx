"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Star, Quote } from "lucide-react";
import { testimonials } from "@/lib/data";
import { SectionHeading } from "@/components/section-heading";

export function Testimonials() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const go = useCallback((dir: number) => {
    setIndex((i) => (i + dir + testimonials.length) % testimonials.length);
  }, []);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => go(1), 6000);
    return () => clearInterval(id);
  }, [paused, go]);

  const active = testimonials[index];

  return (
    <section
      className="bg-cream py-24 sm:py-32"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="mx-auto max-w-4xl px-6 lg:px-10">
        <SectionHeading
          eyebrow="Kind Words"
          title="Cherished by Our Guests"
        />

        <div className="relative mt-14 min-h-[18rem] sm:min-h-[15rem]">
          <Quote
            className="absolute -top-4 left-1/2 -translate-x-1/2 text-gold/30"
            size={64}
            strokeWidth={1}
          />
          <AnimatePresence mode="wait">
            <motion.blockquote
              key={active.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="relative px-2 pt-12 text-center"
            >
              <div className="mb-5 flex justify-center gap-1">
                {Array.from({ length: active.rating }).map((_, i) => (
                  <Star key={i} size={20} className="fill-gold text-gold" />
                ))}
              </div>
              <p className="font-serif text-2xl leading-relaxed text-forest sm:text-3xl">
                &ldquo;{active.quote}&rdquo;
              </p>
              <footer className="mt-7">
                <p className="text-base font-semibold text-forest">{active.name}</p>
                <p className="text-sm text-forest/55">{active.location}</p>
              </footer>
            </motion.blockquote>
          </AnimatePresence>
        </div>

        <div className="mt-10 flex justify-center gap-2.5">
          {testimonials.map((t, i) => (
            <button
              key={t.id}
              aria-label={`Show testimonial ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-2.5 rounded-full transition-all duration-500 ${
                i === index ? "w-8 bg-gold" : "w-2.5 bg-forest/20 hover:bg-forest/40"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
