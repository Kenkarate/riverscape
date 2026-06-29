import dynamic from "next/dynamic";
import { Hero } from "@/components/sections/hero";
import { AvailabilityChecker } from "@/components/sections/availability";
import { About } from "@/components/sections/about";
import { FeaturedRooms } from "@/components/sections/featured-rooms";

const Amenities = dynamic(() => import("@/components/sections/amenities").then(m => ({ default: m.Amenities })));
const GalleryTeaser = dynamic(() => import("@/components/sections/gallery-teaser").then(m => ({ default: m.GalleryTeaser })));
const Testimonials = dynamic(() => import("@/components/sections/testimonials").then(m => ({ default: m.Testimonials })));

export default function Home() {
  return (
    <>
      <Hero />
      <AvailabilityChecker />
      <About />
      <FeaturedRooms />
      <Amenities />
      <GalleryTeaser />
      <Testimonials />
    </>
  );
}
