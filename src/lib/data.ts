import type { Room, Amenity, Testimonial, GalleryImage } from "@/types";

export const RESORT = {
  name: "Riverscape",
  tagline: "Where Nature Meets Luxury",
  location: "Kalady Neeleswaram, Kerala",
  locationLong: "Kalady Neeleswaram — just 10 km from Cochin International Airport",
  airportDistance: "10 km from Cochin International Airport",
  phone: "+91 98470 00000",
  email: "stay@riverscape.in",
};

// Resort WhatsApp number (country code + number, no +).
export const WHATSAPP_NUMBER = "917619124660";

/** Build a WhatsApp click-to-chat link with a pre-filled message. */
export function waLink(
  message: string = "Hi, I would like to book a stay at Riverscape, Kalady Neeleswaram."
) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

/** Pre-filled WhatsApp message for a specific room. */
export function waRoomLink(roomName: string) {
  return waLink(
    `Hi, I would like to book the ${roomName} at Riverscape, Kalady Neeleswaram.`
  );
}

export const EXTRA_CHARGES = [
  { label: "Kid (6–11 yrs) with extra bed", price: 1000, unit: "per head" },
  { label: "Kid (6–11 yrs) without extra bed", price: 500, unit: "per head" },
  { label: "Adult (12 yrs & above)", price: 1000, unit: "per head" },
];

export const HERO_VIDEOS = [
  "/videos/reel-2.mp4",
  "/videos/reel-8.mp4",
  "/videos/reel-6.mp4",
];

// Poster shown before/while the hero video loads.
export const HERO_POSTER = "/images/landscape/1.jpg";

export const ABOUT_IMAGES = [
  "/images/landscape/2.jpg",
  "/images/landscape/5.jpg",
  "/images/landscape/7.jpg",
];

export const rooms: Room[] = [
  {
    id: "premium-pool-villa",
    name: "Premium Pool Villa",
    description: "Our flagship villa with a private pool overlooking the river.",
    longDescription:
      "The pinnacle of Riverscape living. The Premium Pool Villa pairs a private pool with sweeping river views, expansive indoor-outdoor living and bespoke service throughout your stay. The ultimate riverside indulgence in Kalady Neeleswaram.",
    price: 20000,
    image: "/images/rooms/premium-pool-villa/1.jpg",
    gallery: [
      "/images/rooms/premium-pool-villa/1.jpg",
      "/images/rooms/premium-pool-villa/2.jpg",
      "/images/rooms/premium-pool-villa/3.jpg",
      "/images/rooms/premium-pool-villa/4.jpg",
      "/images/rooms/premium-pool-villa/5.jpg",
      "/images/rooms/premium-pool-villa/6.jpg",
    ],
    capacity: 2,
    size: "Private Pool Villa",
    features: ["Private pool", "River view", "King bed", "Indoor-outdoor living"],
  },
  {
    id: "heritage-pool-villa",
    name: "Heritage Pool Villa",
    description: "Kerala-inspired villa with its own private pool and timber accents.",
    longDescription:
      "A celebration of Kerala craftsmanship, the Heritage Pool Villa blends traditional architecture with a private pool and modern comforts. Warm timber, cool stone and the sound of water set the scene for a restful retreat.",
    price: 7000,
    image: "/images/rooms/heritage-pool-villa/1.jpg",
    gallery: [
      "/images/rooms/heritage-pool-villa/1.jpg",
      "/images/rooms/heritage-pool-villa/2.jpg",
    ],
    capacity: 2,
    size: "Pool Villa",
    features: ["Private pool", "Heritage decor", "King bed", "Garden setting"],
  },
  {
    id: "aqua-vista-jacuzzi",
    name: "Aqua Vista with Jacuzzi",
    description: "Water-facing suite with a private jacuzzi for two.",
    longDescription:
      "Wake to the river and unwind in your own private jacuzzi. The Aqua Vista with Jacuzzi suite is designed for couples seeking romance and relaxation, with uninterrupted water views from every corner.",
    price: 8000,
    image: "/images/rooms/aqua-vista-jacuzzi/1.jpg",
    gallery: [
      "/images/rooms/aqua-vista-jacuzzi/1.jpg",
      "/images/rooms/aqua-vista-jacuzzi/2.jpg",
    ],
    capacity: 2,
    size: "Water-facing Suite",
    features: ["Private jacuzzi", "River view", "Queen bed", "Lounge area"],
  },
  {
    id: "aqua-vista-suite",
    name: "Aqua Vista Suite",
    description: "Serene suite framing uninterrupted views of the water.",
    longDescription:
      "The Aqua Vista Suite places you right at the water's edge, with floor-to-ceiling views of the river and a calm, contemporary interior. The perfect base for a peaceful Kerala escape.",
    price: 7000,
    image: "/images/rooms/aqua-vista/1.jpg",
    gallery: [
      "/images/rooms/aqua-vista/1.jpg",
      "/images/rooms/aqua-vista/2.jpg",
      "/images/rooms/aqua-vista/3.jpg",
      "/images/rooms/aqua-vista/4.jpg",
    ],
    capacity: 2,
    size: "Water-facing Suite",
    features: ["River view", "Queen bed", "Sitting area", "Modern bath"],
  },
  {
    id: "premium-suite",
    name: "Premium Suite",
    description: "Spacious, elegantly appointed suite with garden views.",
    longDescription:
      "Generously sized and beautifully finished, the Premium Suite offers a refined retreat with plush bedding, a comfortable lounge and serene garden views — comfort and elegance in equal measure.",
    price: 5500,
    // No dedicated photoset yet — using resort property shots as a tasteful placeholder.
    image: "/images/landscape/8.jpg",
    gallery: ["/images/landscape/8.jpg", "/images/landscape/9.jpg"],
    capacity: 2,
    size: "Premium Suite",
    features: ["Garden view", "King bed", "Lounge corner", "Premium amenities"],
  },
  {
    id: "heritage-suite",
    name: "Heritage Suite",
    description: "Traditional Kerala charm with all the modern comforts.",
    longDescription:
      "Steeped in Kerala heritage, this suite features handcrafted woodwork and warm, earthy tones alongside every modern comfort. A cosy and characterful stay for couples and solo travellers.",
    price: 5000,
    image: "/images/rooms/heritage-suite/1.jpg",
    gallery: ["/images/rooms/heritage-suite/1.jpg"],
    capacity: 2,
    size: "Heritage Suite",
    features: ["Heritage decor", "Queen bed", "Sitting area", "En-suite bath"],
  },
  {
    id: "classic-suite",
    name: "Classic Suite",
    description: "Comfortable, well-appointed suite for a relaxed stay.",
    longDescription:
      "The Classic Suite delivers easy comfort and understated style, with a restful bedroom, modern bath and the signature Riverscape calm. An ideal choice for an unhurried getaway.",
    price: 5000,
    image: "/images/rooms/classic-suite/1.jpg",
    gallery: ["/images/rooms/classic-suite/1.jpg"],
    capacity: 2,
    size: "Classic Suite",
    features: ["Queen bed", "Work nook", "Modern bath", "Resort access"],
  },
  {
    id: "aqua-vista-interconnected",
    name: "Aqua Vista Interconnected",
    description: "Two interconnected water-facing suites — ideal for families & groups.",
    longDescription:
      "Designed for families and groups, the Aqua Vista Interconnected pairs two water-facing suites with a connecting door, sleeping four adults in comfort. Share the views, keep your privacy. Priced for 4 adults sharing.",
    price: 13000,
    image: "/images/rooms/aqua-vista-interconnected/1.jpg",
    gallery: [
      "/images/rooms/aqua-vista-interconnected/1.jpg",
      "/images/rooms/aqua-vista-interconnected/2.jpg",
    ],
    capacity: 4,
    size: "Two Interconnected Suites",
    features: ["Sleeps 4 adults", "Interconnected", "River views", "Two bathrooms"],
  },
];

// Room names for the booking form dropdown.
export const ROOM_TYPES = rooms.map((r) => r.name);

export const amenities: Amenity[] = [
  {
    id: "river-view",
    title: "River View",
    description: "Wake to uninterrupted vistas of flowing water and forested banks.",
    icon: "Waves",
  },
  {
    id: "pool",
    title: "Swimming Pool",
    description: "An infinity pool that melts into the horizon of the valley.",
    icon: "Droplets",
  },
  {
    id: "spa",
    title: "Spa & Wellness",
    description: "Restorative treatments and yoga pavilions amid nature's calm.",
    icon: "Flower2",
  },
  {
    id: "dining",
    title: "Gourmet Dining",
    description: "Farm-to-table cuisine crafted from local, seasonal harvests.",
    icon: "UtensilsCrossed",
  },
  {
    id: "adventure",
    title: "Adventure Sports",
    description: "Kayaking, trekking and guided expeditions into the wild.",
    icon: "Mountain",
  },
  {
    id: "decks",
    title: "Private Decks",
    description: "Secluded outdoor spaces to unwind beneath open skies.",
    icon: "Sun",
  },
];

export const testimonials: Testimonial[] = [
  {
    id: "t1",
    name: "Ananya & Rohan Mehta",
    location: "Mumbai, India",
    rating: 5,
    quote:
      "Riverscape exceeded every expectation. Falling asleep to the sound of the river and waking to misty forest views was pure magic. The staff anticipated our every need.",
  },
  {
    id: "t2",
    name: "James Whitfield",
    location: "London, UK",
    rating: 5,
    quote:
      "A masterclass in understated luxury. The Premium Pool Villa's private pool is unforgettable, and the farm-to-table dining was the finest I've had at any resort.",
  },
  {
    id: "t3",
    name: "Priya Nair",
    location: "Bengaluru, India",
    rating: 5,
    quote:
      "The perfect escape from city life. We spent mornings kayaking and afternoons at the spa. Every corner of this place is designed to make you slow down and breathe.",
  },
  {
    id: "t4",
    name: "Sofia & Marco Rossi",
    location: "Milan, Italy",
    rating: 5,
    quote:
      "From the welcome to the farewell, flawless. The riverside villa felt like our own private sanctuary. We are already planning our return for next season.",
  },
];

export const galleryImages: GalleryImage[] = [
  { src: "/images/landscape/1.jpg", alt: "Riverscape resort at the water's edge", span: "wide" },
  { src: "/images/rooms/premium-pool-villa/2.jpg", alt: "Premium Pool Villa", span: "tall" },
  { src: "/images/landscape/3.jpg", alt: "Riverside grounds", span: "normal" },
  { src: "/images/rooms/aqua-vista/2.jpg", alt: "Aqua Vista Suite", span: "normal" },
  { src: "/images/rooms/heritage-pool-villa/1.jpg", alt: "Heritage Pool Villa", span: "tall" },
  { src: "/images/landscape/4.jpg", alt: "Kerala backwaters view", span: "wide" },
  { src: "/images/rooms/aqua-vista-jacuzzi/1.jpg", alt: "Aqua Vista with Jacuzzi", span: "normal" },
  { src: "/images/landscape/6.jpg", alt: "Lush riverside landscape", span: "normal" },
  { src: "/images/rooms/premium-pool-villa/4.jpg", alt: "Pool villa interiors", span: "tall" },
  { src: "/images/landscape/10.jpg", alt: "Evening by the river", span: "normal" },
  { src: "/images/rooms/aqua-vista/3.jpg", alt: "Water-facing suite", span: "wide" },
  { src: "/images/landscape/8.jpg", alt: "Resort property views", span: "normal" },
  { src: "/images/rooms/heritage-suite/1.jpg", alt: "Heritage Suite", span: "normal" },
  { src: "/images/landscape/7.jpg", alt: "Reflections on the water", span: "tall" },
  { src: "/images/rooms/classic-suite/1.jpg", alt: "Classic Suite", span: "normal" },
  { src: "/images/rooms/aqua-vista-interconnected/1.jpg", alt: "Aqua Vista Interconnected", span: "wide" },
  { src: "/images/landscape/9.jpg", alt: "Riverscape at dusk", span: "normal" },
  { src: "/images/rooms/premium-pool-villa/6.jpg", alt: "Private pool deck", span: "normal" },
];

export const navLinks = [
  { label: "Home", href: "/" },
  { label: "Rooms", href: "/rooms" },
  { label: "Gallery", href: "/gallery" },
];

export type GalleryCategory = "room" | "landscape";

export interface GalleryItem {
  src: string;
  alt: string;
  category: GalleryCategory;
}

// Full gallery dataset for /gallery (with category for filter tabs).
export const fullGallery: GalleryItem[] = [
  ...Array.from({ length: 10 }, (_, i) => ({
    src: `/images/landscape/${i + 1}.jpg`,
    alt: `Riverscape grounds ${i + 1}`,
    category: "landscape" as const,
  })),
  ...rooms.flatMap((room) =>
    room.gallery
      // Skip the placeholder room (Premium Suite reuses landscape shots).
      .filter((src) => src.startsWith("/images/rooms/"))
      .map((src, i) => ({
        src,
        alt: `${room.name} — photo ${i + 1}`,
        category: "room" as const,
      }))
  ),
];

export function getRoomBySlug(slug: string): Room | undefined {
  return rooms.find((r) => r.id === slug);
}

export function formatPrice(price: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price);
}
