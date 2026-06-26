"use client";

import {
  Waves,
  Droplets,
  Flower2,
  UtensilsCrossed,
  Mountain,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { amenities } from "@/lib/data";
import { SectionHeading } from "@/components/section-heading";
import { StaggerContainer, StaggerItem } from "@/components/animations";

const iconMap: Record<string, LucideIcon> = {
  Waves,
  Droplets,
  Flower2,
  UtensilsCrossed,
  Mountain,
  Sun,
};

export function Amenities() {
  return (
    <section id="amenities" className="bg-cream py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <SectionHeading
          eyebrow="The Experience"
          title="Amenities & Indulgences"
          description="Thoughtful comforts and curated experiences, all framed by the river."
        />

        <StaggerContainer className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {amenities.map((amenity) => {
            const Icon = iconMap[amenity.icon] ?? Sun;
            return (
              <StaggerItem key={amenity.id}>
                <div className="group h-full rounded-3xl border border-forest/5 bg-white/40 p-8 transition-all duration-500 hover:border-gold/40 hover:bg-white hover:shadow-xl hover:shadow-forest/5">
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-forest text-gold transition-all duration-500 group-hover:bg-gold group-hover:text-forest">
                    <Icon size={26} strokeWidth={1.6} />
                  </div>
                  <h3 className="text-2xl text-forest">{amenity.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-forest/65">
                    {amenity.description}
                  </p>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      </div>
    </section>
  );
}
