import { prisma } from "@/lib/prisma";
import { differenceInCalendarDays } from "date-fns";

export interface AvailableRoomType {
  id: string;
  slug: string;
  name: string;
  description: string;
  longDescription: string | null;
  basePrice: number;
  baseOccupancy: number;
  maxAdults: number;
  maxChildren: number;
  extraBedAllowed: boolean;
  images: string[];
  amenities: string[];
  availableCount: number;
  nights: number;
  ratePlan: {
    id: string;
    name: string;
    mealPlan: string;
    basePrice: number;
    extraAdultPrice: number;
    extraChildWithBed: number;
    extraChildNoBed: number;
  };
}

export async function getAvailableRoomTypes(params: {
  checkIn: Date;
  checkOut: Date;
  adults: number;
  children?: number;
}): Promise<AvailableRoomType[]> {
  const { checkIn, checkOut, adults } = params;
  const nights = differenceInCalendarDays(checkOut, checkIn);

  if (nights < 1) throw new Error("Check-out must be after check-in");

  const property = await prisma.property.findUnique({
    where: { slug: "riverscape" },
    include: {
      roomTypes: {
        where: { isActive: true },
        include: {
          rooms: { where: { isActive: true } },
        },
      },
    },
  });

  if (!property) throw new Error("Property not found");

  const now = new Date();
  const results: AvailableRoomType[] = [];

  for (const roomType of property.roomTypes) {
    if (roomType.maxAdults < adults) continue;

    const totalRooms = roomType.rooms.length;
    if (totalRooms === 0) continue;

    // Confirmed bookings overlapping the date range
    const bookedCount = await prisma.bookingRoom.count({
      where: {
        roomTypeId: roomType.id,
        booking: { status: { in: ["CONFIRMED", "CHECKED_IN"] } },
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
      },
    });

    // Rooms blocked for maintenance during any overlapping night
    const maintenanceRows = await prisma.maintenanceBlock.findMany({
      where: {
        room: { roomTypeId: roomType.id },
        startDate: { lt: checkOut },
        endDate: { gt: checkIn },
        status: "ACTIVE",
      },
      select: { roomId: true },
    });
    const maintenancedCount = new Set(maintenanceRows.map((m) => m.roomId)).size;

    // Active inventory holds overlapping the date range
    const holdCount = await prisma.inventoryHold.count({
      where: {
        roomTypeId: roomType.id,
        status: "HELD",
        expiresAt: { gt: now },
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
      },
    });

    const available = totalRooms - bookedCount - maintenancedCount - holdCount;
    if (available <= 0) continue;

    // Best (cheapest) active non-package rate plan satisfying minStay
    const ratePlan = await prisma.ratePlan.findFirst({
      where: {
        roomTypeId: roomType.id,
        isActive: true,
        isPackage: false,
        minStay: { lte: nights },
      },
      orderBy: { basePrice: "asc" },
    });

    if (!ratePlan) continue;

    results.push({
      id: roomType.id,
      slug: roomType.slug,
      name: roomType.name,
      description: roomType.description,
      longDescription: roomType.longDescription ?? null,
      basePrice: ratePlan.basePrice,
      baseOccupancy: roomType.baseOccupancy,
      maxAdults: roomType.maxAdults,
      maxChildren: roomType.maxChildren,
      extraBedAllowed: roomType.extraBedAllowed,
      images: roomType.images,
      amenities: roomType.amenities,
      availableCount: available,
      nights,
      ratePlan: {
        id: ratePlan.id,
        name: ratePlan.name,
        mealPlan: ratePlan.mealPlan,
        basePrice: ratePlan.basePrice,
        extraAdultPrice: ratePlan.extraAdultPrice,
        extraChildWithBed: ratePlan.extraChildWithBed,
        extraChildNoBed: ratePlan.extraChildNoBed,
      },
    });
  }

  return results.sort((a, b) => a.basePrice - b.basePrice);
}
