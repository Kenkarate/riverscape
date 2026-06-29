import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.PRISMA_DATABASE_URL;
if (!connectionString) throw new Error("No database URL configured");
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// Prices in paise (1 INR = 100 paise)
const INR = (amount: number) => amount * 100;

async function main() {
  console.log("🌱 Seeding database...");

  // ─── Property ───────────────────────────────────────────────────────────
  const property = await prisma.property.upsert({
    where: { slug: "riverscape" },
    update: {},
    create: {
      name: "Riverscape Resort",
      slug: "riverscape",
      address: "Kalady Neeleswaram, Ernakulam District",
      city: "Kalady Neeleswaram",
      state: "Kerala",
      gstin: null, // update with real GSTIN
      checkInTime: "14:00",
      checkOutTime: "11:00",
      weekendDays: [5, 6],
      phone: "+91 76191 24660",
      email: "stay@riverscape.in",
      website: "https://riverscape.in",
    },
  });
  console.log("✅ Property created:", property.slug);

  // ─── Room Types ─────────────────────────────────────────────────────────
  const roomTypesData = [
    {
      slug: "pool-villa",
      name: "Pool Villa",
      description: "Our signature pool villa with a private pool, king bed and single bed — the ultimate riverside retreat.",
      longDescription: "Room 7010 — The crown jewel of Riverscape. Private pool, king-size bed, additional single bed, set against the tranquil backdrop of Kalady Neeleswaram.",
      basePrice: INR(20000),
      maxAdults: 3,
      maxChildren: 1,
      extraBedAllowed: false,
      maxExtraBeds: 0,
      images: ["/images/rooms/premium-pool-villa/1.jpg", "/images/rooms/premium-pool-villa/2.jpg"],
      amenities: ["Private pool", "King bed", "Single bed", "River view", "Indoor-outdoor living"],
    },
    {
      slug: "villa-a3",
      name: "Villa A3",
      description: "Our most exclusive near-pool villa — a secluded king-bed haven steps from the pool.",
      basePrice: INR(70000),
      maxAdults: 2,
      maxChildren: 1,
      extraBedAllowed: true,
      maxExtraBeds: 1,
      images: ["/images/rooms/aqua-vista/1.jpg"],
      amenities: ["Pool access", "King bed", "Premium finishes", "Garden setting"],
    },
    {
      slug: "villa-a2",
      name: "Villa A2",
      description: "Spacious near-pool villa with three king-size beds — perfect for families and groups.",
      basePrice: INR(30000),
      maxAdults: 6,
      maxChildren: 2,
      extraBedAllowed: false,
      maxExtraBeds: 0,
      images: ["/images/rooms/aqua-vista-interconnected/1.jpg"],
      amenities: ["3 King beds", "Pool access", "Sleeps 6", "Spacious layout"],
    },
    {
      slug: "villa-a1",
      name: "Villa A1",
      description: "Elegant near-pool villa with a king bed and direct pool access.",
      basePrice: INR(10000),
      maxAdults: 2,
      maxChildren: 1,
      extraBedAllowed: true,
      maxExtraBeds: 1,
      images: ["/images/rooms/aqua-vista-jacuzzi/1.jpg"],
      amenities: ["Pool access", "King bed", "Garden setting"],
    },
    {
      slug: "villa-a4",
      name: "Villa A4",
      description: "Tranquil near-pool villa with a king bed — a serene escape by the water.",
      basePrice: INR(10000),
      maxAdults: 2,
      maxChildren: 1,
      extraBedAllowed: true,
      maxExtraBeds: 1,
      images: ["/images/rooms/heritage-pool-villa/1.jpg"],
      amenities: ["Pool access", "King bed", "Garden setting"],
    },
    {
      slug: "room-101",
      name: "Room 101",
      description: "Premium king room with a private pool — a riverside haven for two.",
      basePrice: INR(7000),
      maxAdults: 2,
      maxChildren: 1,
      extraBedAllowed: true,
      maxExtraBeds: 1,
      images: ["/images/rooms/heritage-suite/1.jpg"],
      amenities: ["Private pool", "King bed", "Premium finishes"],
    },
    {
      slug: "room-102",
      name: "Room 102",
      description: "Spacious twin-king room with a private pool — ideal for families.",
      basePrice: INR(5000),
      maxAdults: 4,
      maxChildren: 2,
      extraBedAllowed: false,
      maxExtraBeds: 0,
      images: ["/images/rooms/classic-suite/1.jpg"],
      amenities: ["Private pool", "2 King beds", "Spacious layout"],
    },
    {
      slug: "room-7011",
      name: "Room 7011",
      description: "Premium king room with full resort access and refined amenities.",
      basePrice: INR(4000),
      maxAdults: 2,
      maxChildren: 1,
      extraBedAllowed: true,
      maxExtraBeds: 1,
      images: ["/images/landscape/8.jpg"],
      amenities: ["King bed", "Premium amenities", "Resort access"],
    },
    {
      slug: "room-7012",
      name: "Room 7012",
      description: "Premium king room with full resort access and refined amenities.",
      basePrice: INR(5000),
      maxAdults: 2,
      maxChildren: 1,
      extraBedAllowed: true,
      maxExtraBeds: 1,
      images: ["/images/landscape/2.jpg"],
      amenities: ["King bed", "Premium amenities", "Resort access"],
    },
    {
      slug: "room-7013",
      name: "Room 7013",
      description: "Premium king room with full resort access and refined amenities.",
      basePrice: INR(5000),
      maxAdults: 2,
      maxChildren: 1,
      extraBedAllowed: true,
      maxExtraBeds: 1,
      images: ["/images/landscape/3.jpg"],
      amenities: ["King bed", "Premium amenities", "Resort access"],
    },
    {
      slug: "room-7014",
      name: "Room 7014",
      description: "Premium king room with full resort access and refined amenities.",
      basePrice: INR(5000),
      maxAdults: 2,
      maxChildren: 1,
      extraBedAllowed: true,
      maxExtraBeds: 1,
      images: ["/images/landscape/4.jpg"],
      amenities: ["King bed", "Premium amenities", "Resort access"],
    },
    {
      slug: "room-7015",
      name: "Room 7015",
      description: "Premium king room with full resort access and refined amenities.",
      basePrice: INR(5000),
      maxAdults: 2,
      maxChildren: 1,
      extraBedAllowed: true,
      maxExtraBeds: 1,
      images: ["/images/landscape/10.jpg"],
      amenities: ["King bed", "Premium amenities", "Resort access"],
    },
    {
      slug: "room-7016",
      name: "Room 7016",
      description: "Premium king room with full resort access and refined amenities.",
      basePrice: INR(4000),
      maxAdults: 2,
      maxChildren: 1,
      extraBedAllowed: true,
      maxExtraBeds: 1,
      images: ["/images/landscape/1.jpg"],
      amenities: ["King bed", "Premium amenities", "Resort access"],
    },
    {
      slug: "room-7017",
      name: "Room 7017",
      description: "Comfortable king room with full resort access.",
      basePrice: INR(3500),
      maxAdults: 2,
      maxChildren: 1,
      extraBedAllowed: true,
      maxExtraBeds: 1,
      images: ["/images/landscape/5.jpg"],
      amenities: ["King bed", "Premium amenities", "Resort access"],
    },
    {
      slug: "room-7018",
      name: "Room 7018",
      description: "Comfortable king room with full resort access.",
      basePrice: INR(3500),
      maxAdults: 2,
      maxChildren: 1,
      extraBedAllowed: true,
      maxExtraBeds: 1,
      images: ["/images/landscape/6.jpg"],
      amenities: ["King bed", "Premium amenities", "Resort access"],
    },
  ];

  const roomTypes: Record<string, { id: string }> = {};
  for (const rt of roomTypesData) {
    const created = await prisma.roomType.upsert({
      where: { slug: rt.slug },
      update: {},
      create: { ...rt, propertyId: property.id },
    });
    roomTypes[rt.slug] = created;
    console.log(`  ✅ RoomType: ${rt.name}`);
  }

  // ─── Physical Rooms ──────────────────────────────────────────────────────
  const physicalRooms = [
    { number: "7010", roomTypeSlug: "pool-villa" },
    { number: "A3", roomTypeSlug: "villa-a3" },
    { number: "A2", roomTypeSlug: "villa-a2" },
    { number: "A1", roomTypeSlug: "villa-a1" },
    { number: "A4", roomTypeSlug: "villa-a4" },
    { number: "101", roomTypeSlug: "room-101" },
    { number: "102", roomTypeSlug: "room-102" },
    { number: "7011", roomTypeSlug: "room-7011" },
    { number: "7012", roomTypeSlug: "room-7012" },
    { number: "7013", roomTypeSlug: "room-7013" },
    { number: "7014", roomTypeSlug: "room-7014" },
    { number: "7015", roomTypeSlug: "room-7015" },
    { number: "7016", roomTypeSlug: "room-7016" },
    { number: "7017", roomTypeSlug: "room-7017" },
    { number: "7018", roomTypeSlug: "room-7018" },
  ];

  for (const r of physicalRooms) {
    await prisma.room.upsert({
      where: { propertyId_number: { propertyId: property.id, number: r.number } },
      update: {},
      create: {
        number: r.number,
        propertyId: property.id,
        roomTypeId: roomTypes[r.roomTypeSlug].id,
      },
    });
  }
  console.log(`✅ ${physicalRooms.length} physical rooms seeded`);

  // ─── Default Rate Plans ──────────────────────────────────────────────────
  for (const rt of roomTypesData) {
    await prisma.ratePlan.upsert({
      where: {
        id: `default-${rt.slug}`,
      },
      update: {},
      create: {
        id: `default-${rt.slug}`,
        propertyId: property.id,
        roomTypeId: roomTypes[rt.slug].id,
        name: "Standard Rate",
        mealPlan: "ROOM_ONLY",
        basePrice: rt.basePrice,
        extraAdultPrice: INR(1000),
        extraChildWithBed: INR(1000),
        extraChildNoBed: INR(500),
        minStay: 1,
      },
    });
  }
  console.log("✅ Default rate plans seeded");

  // A-block combo package (₹30,000 for all 4 villas)
  await prisma.ratePlan.upsert({
    where: { id: "ablock-combo" },
    update: {},
    create: {
      id: "ablock-combo",
      propertyId: property.id,
      roomTypeId: null,
      name: "A-Block Package (All 4 Villas)",
      mealPlan: "ROOM_ONLY",
      basePrice: INR(30000),
      isPackage: true,
      packageRoomTypeSlugs: ["villa-a1", "villa-a2", "villa-a3", "villa-a4"],
      extraAdultPrice: INR(1000),
      extraChildWithBed: INR(1000),
      extraChildNoBed: INR(500),
    },
  });

  // Rooms 101+102 combo (₹10,000)
  await prisma.ratePlan.upsert({
    where: { id: "rooms-101-102-combo" },
    update: {},
    create: {
      id: "rooms-101-102-combo",
      propertyId: property.id,
      roomTypeId: null,
      name: "Rooms 101 & 102 Package",
      mealPlan: "ROOM_ONLY",
      basePrice: INR(10000),
      isPackage: true,
      packageRoomTypeSlugs: ["room-101", "room-102"],
      extraAdultPrice: INR(1000),
      extraChildWithBed: INR(1000),
      extraChildNoBed: INR(500),
    },
  });
  console.log("✅ Combo rate plans seeded");

  // ─── Default Addons ──────────────────────────────────────────────────────
  const addons = [
    { name: "Extra Bed", category: "EXTRA_BED" as const, price: INR(1000), unit: "per night", gstRate: 12 },
    { name: "Airport Pickup", category: "TRANSPORT" as const, price: INR(1500), unit: "per transfer", gstRate: 5 },
    { name: "Dinner Package", category: "MEAL" as const, price: INR(800), unit: "per person", gstRate: 5 },
    { name: "Sightseeing Tour", category: "ACTIVITY" as const, price: INR(2000), unit: "per person", gstRate: 5 },
  ];

  for (const addon of addons) {
    await prisma.addon.upsert({
      where: { id: `default-${addon.name.toLowerCase().replace(/ /g, "-")}` },
      update: {},
      create: {
        id: `default-${addon.name.toLowerCase().replace(/ /g, "-")}`,
        propertyId: property.id,
        ...addon,
      },
    });
  }
  console.log("✅ Default addons seeded");

  // ─── Default Channels ────────────────────────────────────────────────────
  const channels = [
    { name: "Direct Website", type: "DIRECT" as const, markupValue: 0 },
    { name: "Booking.com", type: "BOOKING_COM" as const, markupValue: 15 },
    { name: "MakeMyTrip", type: "MAKEMYTRIP" as const, markupValue: 12 },
    { name: "Goibibo", type: "GOIBIBO" as const, markupValue: 12 },
    { name: "Agoda", type: "AGODA" as const, markupValue: 15 },
    { name: "Airbnb", type: "AIRBNB" as const, markupValue: 14 },
    { name: "Expedia", type: "EXPEDIA" as const, markupValue: 15 },
  ];

  for (const ch of channels) {
    await prisma.channel.upsert({
      where: { propertyId_type: { propertyId: property.id, type: ch.type } },
      update: {},
      create: { ...ch, propertyId: property.id },
    });
  }
  console.log("✅ Channels seeded");

  // ─── Super Admin User ────────────────────────────────────────────────────
  const adminEmail = "admin@riverscape.in";
  const adminPassword = "Riverscape@2026"; // change after first login
  const hash = await bcrypt.hash(adminPassword, 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: "Riverscape Admin",
      passwordHash: hash,
      role: "SUPER_ADMIN",
    },
  });
  console.log(`✅ Admin user created: ${adminEmail} / ${adminPassword}`);

  console.log("\n🎉 Seed complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
