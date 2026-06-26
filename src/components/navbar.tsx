"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import { Menu, X, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { navLinks, waLink } from "@/lib/data";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 60);
  });

  // Transparent navbar only over the homepage hero (before scroll).
  const isHome = pathname === "/";
  const transparent = isHome && !scrolled;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-all duration-500",
          transparent ? "bg-transparent" : "bg-cream/85 shadow-md shadow-forest/5 backdrop-blur-md"
        )}
      >
        <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-10">
          <Link
            href="/"
            className={cn(
              "font-serif text-2xl font-semibold tracking-wide transition-colors duration-500",
              transparent ? "text-cream" : "text-forest"
            )}
          >
            River<span className="text-gold">scape</span>
          </Link>

          <ul className="hidden items-center gap-9 md:flex">
            {navLinks.map((link) => {
              const active = isActive(link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={cn(
                      "group relative text-sm font-medium tracking-wide transition-colors duration-500",
                      transparent
                        ? "text-cream/90 hover:text-cream"
                        : "text-forest/80 hover:text-forest",
                      active && (transparent ? "text-cream" : "text-forest")
                    )}
                  >
                    {link.label}
                    <span
                      className={cn(
                        "absolute -bottom-1 left-0 h-px bg-gold transition-all duration-300",
                        active ? "w-full" : "w-0 group-hover:w-full"
                      )}
                    />
                  </Link>
                </li>
              );
            })}
          </ul>

          <a
            href={waLink()}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "hidden items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium tracking-wide transition-all duration-300 md:inline-flex",
              transparent
                ? "bg-gold text-forest-dark hover:bg-gold-light"
                : "bg-forest text-cream hover:bg-forest-light"
            )}
          >
            <MessageCircle size={16} />
            Book Now
          </a>

          <button
            aria-label="Open menu"
            onClick={() => setOpen(true)}
            className={cn("md:hidden", transparent ? "text-cream" : "text-forest")}
          >
            <Menu size={26} />
          </button>
        </nav>
      </motion.header>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[60] bg-forest-dark/60 backdrop-blur-sm md:hidden"
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-y-0 right-0 z-[70] flex w-72 max-w-[80vw] flex-col bg-cream p-8 md:hidden"
            >
              <div className="mb-10 flex items-center justify-between">
                <span className="font-serif text-xl font-semibold text-forest">
                  River<span className="text-gold">scape</span>
                </span>
                <button aria-label="Close menu" onClick={() => setOpen(false)} className="text-forest">
                  <X size={24} />
                </button>
              </div>
              <ul className="flex flex-col gap-1">
                {navLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "block rounded-lg px-4 py-3 text-lg font-medium transition-colors hover:bg-forest/5",
                        isActive(link.href) ? "text-forest" : "text-forest/70"
                      )}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <a
                href={waLink()}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="mt-auto inline-flex items-center justify-center gap-2 rounded-full bg-forest px-6 py-3 text-center text-sm font-medium text-cream transition-colors hover:bg-forest-light"
              >
                <MessageCircle size={16} />
                Book on WhatsApp
              </a>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
