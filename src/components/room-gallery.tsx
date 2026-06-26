"use client";

import { useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function RoomGallery({ photos, name }: { photos: string[]; name: string }) {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(0);

  const go = (d: number) => {
    setDir(d);
    setIndex((i) => (i + d + photos.length) % photos.length);
  };
  const select = (i: number) => {
    setDir(i > index ? 1 : -1);
    setIndex(i);
  };

  const multiple = photos.length > 1;

  return (
    <div className="w-full">
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-3xl bg-forest/5 sm:aspect-[16/9]">
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.div
            key={index}
            custom={dir}
            initial={{ opacity: 0, x: dir > 0 ? 60 : -60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir > 0 ? -60 : 60 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0"
          >
            <Image
              src={photos[index]}
              alt={`${name} — photo ${index + 1}`}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 60vw"
              className="object-cover"
            />
          </motion.div>
        </AnimatePresence>

        {multiple && (
          <>
            <button
              aria-label="Previous photo"
              onClick={() => go(-1)}
              className="absolute left-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-forest-dark/40 text-cream backdrop-blur transition-colors hover:bg-forest-dark/70"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              aria-label="Next photo"
              onClick={() => go(1)}
              className="absolute right-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-forest-dark/40 text-cream backdrop-blur transition-colors hover:bg-forest-dark/70"
            >
              <ChevronRight size={22} />
            </button>
            <span className="absolute bottom-4 right-4 z-10 rounded-full bg-forest-dark/50 px-3 py-1 text-xs text-cream backdrop-blur">
              {index + 1} / {photos.length}
            </span>
          </>
        )}
      </div>

      {multiple && (
        <div className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-6">
          {photos.map((src, i) => (
            <button
              key={src + i}
              aria-label={`View photo ${i + 1}`}
              onClick={() => select(i)}
              className={cn(
                "relative aspect-square overflow-hidden rounded-xl ring-2 transition-all duration-300",
                i === index ? "ring-gold" : "ring-transparent opacity-70 hover:opacity-100"
              )}
            >
              <Image
                src={src}
                alt={`${name} thumbnail ${i + 1}`}
                fill
                sizes="120px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
