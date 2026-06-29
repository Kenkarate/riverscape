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

export const HERO_IMAGES = [
  "/images/landscape/1.jpg",
  "/images/landscape/3.jpg",
  "/images/landscape/6.jpg",
  "/images/landscape/4.jpg",
];

export const ABOUT_IMAGES = [
  "/images/landscape/2.jpg",
  "/images/landscape/5.jpg",
  "/images/landscape/7.jpg",
];

export const rooms: Room[] = [
  // --- Pool Villa ---
  {
    id: "pool-villa",
    name: "Pool Villa",
    description: "Our signature pool villa with a private pool, king bed and single bed — the ultimate riverside retreat.",
    longDescription:
      "Room 7010 — The crown jewel of Riverscape. This private pool villa offers a king-size bed, an additional single bed and exclusive pool access, set against the tranquil backdrop of Kalady Neeleswaram. Ideal for couples or small families seeking total privacy and indulgence by the river.",
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
    capacity: 3,
    size: "Pool Villa",
    features: ["Private pool", "King bed", "Single bed", "River view", "Indoor-outdoor living"],
  },
  // --- Near-Pool Villas (Building A) ---
  {
    id: "villa-a3",
    name: "Villa A3",
    description: "Our most exclusive near-pool villa — a secluded king-bed haven steps from the pool.",
    longDescription:
      "The finest villa in the A-block complex, Villa A3 offers a king-size bed, premium finishes and direct pool access within a lush, landscaped setting. A rare combination of privacy and resort living at its finest.",
    price: 70000,
    image: "/images/rooms/aqua-vista/1.jpg",
    gallery: [
      "/images/rooms/aqua-vista/1.jpg",
      "/images/rooms/aqua-vista/2.jpg",
      "/images/rooms/aqua-vista/3.jpg",
      "/images/rooms/aqua-vista/4.jpg",
    ],
    capacity: 2,
    size: "Pool-side Villa",
    features: ["Pool access", "King bed", "Premium finishes", "Garden setting"],
  },
  {
    id: "villa-a2",
    name: "Villa A2",
    description: "Spacious near-pool villa with three king-size beds — perfect for families and groups.",
    longDescription:
      "The largest villa in the A-block, Villa A2 accommodates up to six guests across three king-size beds with direct pool access. A warm, resort-contemporary interior and generous living spaces make this ideal for families or groups travelling together.",
    price: 30000,
    image: "/images/rooms/aqua-vista-interconnected/1.jpg",
    gallery: [
      "/images/rooms/aqua-vista-interconnected/1.jpg",
      "/images/rooms/aqua-vista-interconnected/2.jpg",
    ],
    capacity: 6,
    size: "Pool-side Villa",
    features: ["3 King beds", "Pool access", "Sleeps 6", "Spacious layout"],
  },
  {
    id: "villa-a1",
    name: "Villa A1",
    description: "Elegant near-pool villa with a king bed and direct pool access.",
    longDescription:
      "Villa A1 opens onto the A-block pool area, offering a king-size bed and a calm, contemporary interior. Part of the two-building near-pool complex, this villa pairs resort facilities with genuine seclusion. Book all A-block villas together for ₹30,000.",
    price: 10000,
    image: "/images/rooms/aqua-vista-jacuzzi/1.jpg",
    gallery: [
      "/images/rooms/aqua-vista-jacuzzi/1.jpg",
      "/images/rooms/aqua-vista-jacuzzi/2.jpg",
    ],
    capacity: 2,
    size: "Pool-side Villa",
    features: ["Pool access", "King bed", "Garden setting"],
  },
  {
    id: "villa-a4",
    name: "Villa A4",
    description: "Tranquil near-pool villa with a king bed — a serene escape by the water.",
    longDescription:
      "Set within the landscaped A-block compound, Villa A4 provides a peaceful king-bed retreat with easy pool access. Thoughtfully designed to blend into the natural surroundings, it is the perfect base for guests who want nature and comfort in equal measure.",
    price: 10000,
    image: "/images/rooms/heritage-pool-villa/1.jpg",
    gallery: [
      "/images/rooms/heritage-pool-villa/1.jpg",
      "/images/rooms/heritage-pool-villa/2.jpg",
    ],
    capacity: 2,
    size: "Pool-side Villa",
    features: ["Pool access", "King bed", "Garden setting"],
  },
  // --- Floor Rooms with Private Pool ---
  {
    id: "room-101",
    name: "Room 101",
    description: "Premium king room with a private pool — a riverside haven for two.",
    longDescription:
      "Room 101 is a premium king room with its own private pool, set in the main building of the resort. Rich finishes, warm natural materials and attentive service define your stay. Book Rooms 101 & 102 together for a combined rate of ₹10,000.",
    price: 7000,
    image: "/images/rooms/heritage-suite/1.jpg",
    gallery: ["/images/rooms/heritage-suite/1.jpg"],
    capacity: 2,
    size: "Premium Room",
    features: ["Private pool", "King bed", "Premium finishes"],
  },
  {
    id: "room-102",
    name: "Room 102",
    description: "Spacious twin-king room with a private pool — ideal for families.",
    longDescription:
      "Room 102 offers two king-size beds and a private pool, making it one of Riverscape's most versatile stays. Perfect for families or friends. Book Rooms 101 & 102 together for a combined rate of ₹10,000.",
    price: 5000,
    image: "/images/rooms/classic-suite/1.jpg",
    gallery: ["/images/rooms/classic-suite/1.jpg"],
    capacity: 4,
    size: "Twin King Room",
    features: ["Private pool", "2 King beds", "Spacious layout"],
  },
  // --- Premium Rooms (7011–7018) ---
  {
    id: "room-7011",
    name: "Room 7011",
    description: "Premium king room with full resort access and refined amenities.",
    longDescription:
      "Room 7011 is a well-appointed premium room with a king-size bed and all Riverscape comforts — attentive service, resort-wide access and the serene atmosphere of Kalady Neeleswaram.",
    price: 4000,
    image: "/images/landscape/8.jpg",
    gallery: ["/images/landscape/8.jpg", "/images/landscape/9.jpg"],
    capacity: 2,
    size: "Premium Room",
    features: ["King bed", "Premium amenities", "Resort access"],
  },
  {
    id: "room-7012",
    name: "Room 7012",
    description: "Premium king room with full resort access and refined amenities.",
    longDescription:
      "Room 7012 provides a comfortable king-bed stay with full resort access. Warm interiors and the hallmark Riverscape calm make it an ideal retreat.",
    price: 5000,
    image: "/images/landscape/2.jpg",
    gallery: ["/images/landscape/2.jpg", "/images/landscape/5.jpg"],
    capacity: 2,
    size: "Premium Room",
    features: ["King bed", "Premium amenities", "Resort access"],
  },
  {
    id: "room-7013",
    name: "Room 7013",
    description: "Premium king room with full resort access and refined amenities.",
    longDescription:
      "Room 7013 is a serene premium room with a king-size bed and a comfortable lounge area, with full access to all Riverscape facilities.",
    price: 5000,
    image: "/images/landscape/3.jpg",
    gallery: ["/images/landscape/3.jpg", "/images/landscape/6.jpg"],
    capacity: 2,
    size: "Premium Room",
    features: ["King bed", "Premium amenities", "Resort access"],
  },
  {
    id: "room-7014",
    name: "Room 7014",
    description: "Premium king room with full resort access and refined amenities.",
    longDescription:
      "Room 7014 offers a restful king-bed retreat within the Riverscape complex, with access to the resort's gardens, pool and dining.",
    price: 5000,
    image: "/images/landscape/4.jpg",
    gallery: ["/images/landscape/4.jpg", "/images/landscape/7.jpg"],
    capacity: 2,
    size: "Premium Room",
    features: ["King bed", "Premium amenities", "Resort access"],
  },
  {
    id: "room-7015",
    name: "Room 7015",
    description: "Premium king room with full resort access and refined amenities.",
    longDescription:
      "Room 7015 provides a peaceful base for exploring Kerala, with a king-size bed and the full suite of Riverscape amenities on your doorstep.",
    price: 5000,
    image: "/images/landscape/10.jpg",
    gallery: ["/images/landscape/10.jpg"],
    capacity: 2,
    size: "Premium Room",
    features: ["King bed", "Premium amenities", "Resort access"],
  },
  {
    id: "room-7016",
    name: "Room 7016",
    description: "Premium king room with full resort access and refined amenities.",
    longDescription:
      "Room 7016 is a thoughtfully appointed premium room with a king-size bed, modern bath and access to the entire Riverscape resort.",
    price: 4000,
    image: "/images/landscape/1.jpg",
    gallery: ["/images/landscape/1.jpg"],
    capacity: 2,
    size: "Premium Room",
    features: ["King bed", "Premium amenities", "Resort access"],
  },
  {
    id: "room-7017",
    name: "Room 7017",
    description: "Comfortable king room with full resort access.",
    longDescription:
      "Room 7017 is a comfortable king-bed room set within the resort, offering all Riverscape facilities at an attractive rate.",
    price: 3500,
    image: "/images/landscape/5.jpg",
    gallery: ["/images/landscape/5.jpg"],
    capacity: 2,
    size: "Premium Room",
    features: ["King bed", "Premium amenities", "Resort access"],
  },
  {
    id: "room-7018",
    name: "Room 7018",
    description: "Comfortable king room with full resort access.",
    longDescription:
      "Room 7018 provides a relaxed and comfortable stay with a king-size bed and full resort access — a great choice for guests looking to experience Riverscape at an accessible price.",
    price: 3500,
    image: "/images/landscape/6.jpg",
    gallery: ["/images/landscape/6.jpg"],
    capacity: 2,
    size: "Premium Room",
    features: ["King bed", "Premium amenities", "Resort access"],
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
  { src: "/images/rooms/premium-pool-villa/2.jpg", alt: "Pool Villa", span: "tall" },
  { src: "/images/landscape/3.jpg", alt: "Riverside grounds", span: "normal" },
  { src: "/images/rooms/aqua-vista/2.jpg", alt: "Villa A3", span: "normal" },
  { src: "/images/rooms/heritage-pool-villa/1.jpg", alt: "Villa A4", span: "tall" },
  { src: "/images/landscape/4.jpg", alt: "Kerala backwaters view", span: "wide" },
  { src: "/images/rooms/aqua-vista-jacuzzi/1.jpg", alt: "Villa A1", span: "normal" },
  { src: "/images/landscape/6.jpg", alt: "Lush riverside landscape", span: "normal" },
  { src: "/images/rooms/premium-pool-villa/4.jpg", alt: "Pool Villa interiors", span: "tall" },
  { src: "/images/landscape/10.jpg", alt: "Evening by the river", span: "normal" },
  { src: "/images/rooms/aqua-vista/3.jpg", alt: "Villa A3 interiors", span: "wide" },
  { src: "/images/landscape/8.jpg", alt: "Resort property views", span: "normal" },
  { src: "/images/rooms/heritage-suite/1.jpg", alt: "Room 101", span: "normal" },
  { src: "/images/landscape/7.jpg", alt: "Reflections on the water", span: "tall" },
  { src: "/images/rooms/classic-suite/1.jpg", alt: "Room 102", span: "normal" },
  { src: "/images/rooms/aqua-vista-interconnected/1.jpg", alt: "Villa A2", span: "wide" },
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
