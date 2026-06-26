import { Hero } from "@/components/sections/hero";
import { About } from "@/components/sections/about";
import { FeaturedRooms } from "@/components/sections/featured-rooms";
import { Amenities } from "@/components/sections/amenities";
import { GalleryTeaser } from "@/components/sections/gallery-teaser";
import { Testimonials } from "@/components/sections/testimonials";

export default function Home() {
  return (
    <>
      <Hero />
      <About />
      <FeaturedRooms />
      <Amenities />
      <GalleryTeaser />
      <Testimonials />
    </>
  );
}
