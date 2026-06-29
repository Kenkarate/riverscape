"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, Users, BedDouble, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatINR } from "@/lib/pricing";
import { MEAL_PLANS, type AvailableRoom, type MealPlan } from "@/types/booking";

const FALLBACK_IMAGE = "/images/landscape/1.jpg";

export function RoomSelectCard({
  room,
  checkIn,
  checkOut,
  adults,
  childrenCount,
  nights,
}: {
  room: AvailableRoom;
  checkIn: string;
  checkOut: string;
  adults: number;
  childrenCount: number;
  nights: number;
}) {
  const [mealPlan, setMealPlan] = useState<MealPlan>("ROOM_ONLY");

  const perNight = room.ratePlan.basePrice;
  const roomSubtotal = perNight * nights;

  const checkoutHref =
    `/book/checkout?` +
    new URLSearchParams({
      checkIn,
      checkOut,
      adults: String(adults),
      children: String(childrenCount),
      roomTypeSlug: room.slug,
      mealPlan,
    }).toString();

  const amenities = room.amenities.slice(0, 5);
  const lowStock = room.availableCount <= 2;

  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-3xl border border-forest/8 bg-white shadow-sm transition-shadow duration-500 hover:shadow-xl hover:shadow-forest/10">
      {/* Image */}
      <div className="relative h-56 w-full overflow-hidden sm:h-64">
        <Image
          src={room.images[0] || FALLBACK_IMAGE}
          alt={room.name}
          fill
          sizes="(max-width: 1024px) 100vw, 600px"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-forest-dark/35 to-transparent" />
        {lowStock && (
          <span className="absolute left-4 top-4 rounded-full bg-gold px-3 py-1 text-xs font-semibold text-forest-dark shadow">
            Only {room.availableCount} left
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-serif text-2xl text-forest">{room.name}</h2>
          <div className="text-right">
            <p className="text-lg font-semibold text-forest">{formatINR(perNight)}</p>
            <p className="text-xs text-forest/55">/ night</p>
          </div>
        </div>

        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-forest/65">
          {room.description}
        </p>

        {/* Capacity */}
        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-forest/55">
          <span className="flex items-center gap-1.5">
            <Users size={14} className="text-gold-dark" />
            Up to {room.maxAdults} adults
          </span>
          {room.extraBedAllowed && (
            <span className="flex items-center gap-1.5">
              <BedDouble size={14} className="text-gold-dark" />
              Extra bed available
            </span>
          )}
        </div>

        {/* Amenities */}
        {amenities.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {amenities.map((a) => (
              <span
                key={a}
                className="rounded-full bg-cream px-3 py-1 text-xs font-medium text-forest/70"
              >
                {a}
              </span>
            ))}
          </div>
        )}

        {/* Meal plan selector */}
        <fieldset className="mt-5">
          <legend className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.15em] text-forest/45">
            <Sparkles size={13} className="text-gold-dark" />
            Meal plan
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {MEAL_PLANS.map((mp) => {
              const active = mealPlan === mp.value;
              return (
                <label
                  key={mp.value}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors",
                    active
                      ? "border-forest bg-forest text-cream"
                      : "border-forest/15 bg-cream/40 text-forest/80 hover:border-forest/40"
                  )}
                >
                  <input
                    type="radio"
                    name={`meal-${room.id}`}
                    value={mp.value}
                    checked={active}
                    onChange={() => setMealPlan(mp.value)}
                    className="sr-only"
                  />
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                      active ? "border-cream bg-cream" : "border-forest/30"
                    )}
                  >
                    {active && <Check size={11} className="text-forest" strokeWidth={3} />}
                  </span>
                  <span className="font-medium leading-none">{mp.label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* Price + CTA */}
        <div className="mt-6 flex items-end justify-between border-t border-forest/8 pt-5">
          <div>
            <p className="text-xs text-forest/55">
              {nights} night{nights > 1 ? "s" : ""} subtotal
            </p>
            <p className="font-serif text-2xl text-forest">{formatINR(roomSubtotal)}</p>
            <p className="text-[11px] text-forest/45">+ taxes &amp; extras at checkout</p>
          </div>
          <Link
            href={checkoutHref}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-gold px-7 py-3 text-sm font-medium tracking-wide text-forest-dark shadow-lg shadow-gold/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-gold-light"
          >
            Book Now
          </Link>
        </div>
      </div>
    </div>
  );
}
