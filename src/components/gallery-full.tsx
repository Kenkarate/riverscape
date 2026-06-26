"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { fullGallery, type GalleryCategory } from "@/lib/data";
import { cn } from "@/lib/utils";

type Filter = "all" | GalleryCategory;

const TABS: { label: string; value: Filter }[] = [
  { label: "All", value: "all" },
  { label: "Rooms & Suites", value: "room" },
  { label: "Landscapes", value: "landscape" },
];

export function GalleryFull() {
  const [filter, setFilter] = useState<Filter>("all");
  const [index, setIndex] = useState<number | null>(null);

  const items = useMemo(
    () => (filter === "all" ? fullGallery : fullGallery.filter((i) => i.category === filter)),
    [filter]
  );

  const isOpen = index !== null;
  const close = useCallback(() => setIndex(null), []);
  const prev = useCallback(
    () => setIndex((i) => (i === null ? i : (i - 1 + items.length) % items.length)),
    [items.length]
  );
  const next = useCallback(
    () => setIndex((i) => (i === null ? i : (i + 1) % items.length)),
    [items.length]
  );

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, close, prev, next]);

  return (
    <>
      {/* Filter tabs */}
      <div className="flex flex-wrap justify-center gap-3">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setFilter(tab.value);
              setIndex(null);
            }}
            className={cn(
              "rounded-full px-6 py-2.5 text-sm font-medium tracking-wide transition-all duration-300",
              filter === tab.value
                ? "bg-forest text-cream shadow-md"
                : "border border-forest/20 text-forest/70 hover:border-forest/40 hover:text-forest"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Masonry grid */}
      <div className="mt-12 columns-2 gap-3 sm:columns-3 sm:gap-4 lg:columns-4 [&>*]:mb-3 sm:[&>*]:mb-4">
        {items.map((img, i) => (
          <motion.button
            key={img.src}
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: (i % 6) * 0.04 }}
            onClick={() => setIndex(i)}
            className="group relative block w-full overflow-hidden rounded-xl"
          >
            <Image
              src={img.src}
              alt={img.alt}
              width={600}
              height={450}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="h-auto w-full object-cover transition-transform duration-700 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-forest-dark/0 transition-colors duration-500 group-hover:bg-forest-dark/25" />
          </motion.button>
        ))}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {isOpen && index !== null && items[index] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-forest-dark/95 p-4 backdrop-blur"
            onClick={close}
          >
            <button
              aria-label="Close gallery"
              onClick={close}
              className="absolute right-5 top-5 z-10 text-cream/80 transition-colors hover:text-cream"
            >
              <X size={32} />
            </button>
            <button
              aria-label="Previous image"
              onClick={(e) => {
                e.stopPropagation();
                prev();
              }}
              className="absolute left-3 z-10 flex h-12 w-12 items-center justify-center rounded-full text-cream/80 transition-colors hover:bg-cream/10 hover:text-cream sm:left-8"
            >
              <ChevronLeft size={32} />
            </button>
            <button
              aria-label="Next image"
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
              className="absolute right-3 z-10 flex h-12 w-12 items-center justify-center rounded-full text-cream/80 transition-colors hover:bg-cream/10 hover:text-cream sm:right-8"
            >
              <ChevronRight size={32} />
            </button>

            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              onClick={(e) => e.stopPropagation()}
              className="relative h-[78vh] w-full max-w-5xl"
            >
              <Image
                src={items[index].src}
                alt={items[index].alt}
                fill
                sizes="100vw"
                className="object-contain"
                priority
              />
              <p className="absolute -bottom-9 left-1/2 -translate-x-1/2 text-sm text-cream/70">
                {items[index].alt} · {index + 1} / {items.length}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
