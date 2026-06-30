"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { parseISO, differenceInCalendarDays } from "date-fns";
import { requireStaff } from "@/lib/auth-helpers";
import { calculatePrice } from "@/lib/pricing";
import { BOOKING_SOURCE_OPTIONS } from "@/lib/badges";
import type { BookingSource, PaymentType } from "@prisma/client";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// 10-digit Indian mobile (starts 6–9).
const PHONE_RE = /^[6-9]\d{9}$/;

export interface RackBookingInput {
  roomId: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  guestName: string;
  guestPhone: string;
  adults: number;
  source: string; // BookingSource — DIRECT | WALK_IN | PHONE
  paymentMethod: string; // "Cash" | "Card" | "UPI" | "Online" | "None"
  amountRupees: number; // rupees; converted to paise inside the action
}

export interface RackBookingResult {
  success: boolean;
  bookingRef?: string;
  error?: string;
}

/**
 * Creates a booking for a specific physical room straight from the Room Rack.
 * Mirrors `createAdminBooking` but returns a result object instead of redirecting
 * so the client slide-in panel can show inline success/error. Staff-only.
 */
export async function createRackBooking(
  input: RackBookingInput
): Promise<RackBookingResult> {
  const user = await requireStaff();

  // ── Validate stay ──────────────────────────────────────────────────────────
  if (!DATE_RE.test(input.checkIn) || !DATE_RE.test(input.checkOut)) {
    return { success: false, error: "Select valid check-in and check-out dates." };
  }
  const checkIn = parseISO(input.checkIn);
  const checkOut = parseISO(input.checkOut);
  const nights = differenceInCalendarDays(checkOut, checkIn);
  if (nights < 1) {
    return { success: false, error: "Check-out must be after check-in." };
  }

  const adults = Math.max(1, Math.min(10, Math.round(input.adults || 0)));

  // ── Validate guest ─────────────────────────────────────────────────────────
  const guestName = input.guestName?.trim();
  const guestPhone = input.guestPhone?.replace(/\D/g, "");
  if (!guestName) return { success: false, error: "Guest name is required." };
  if (!guestPhone || !PHONE_RE.test(guestPhone)) {
    return { success: false, error: "Enter a valid 10-digit Indian mobile number." };
  }

  const source = (BOOKING_SOURCE_OPTIONS as string[]).includes(input.source)
    ? (input.source as BookingSource)
    : "WALK_IN";

  // ── Load property + the pre-selected physical room + its room type ──────────
  const property = await prisma.property.findUnique({ where: { slug: "riverscape" } });
  if (!property) return { success: false, error: "Property not found." };

  const room = await prisma.room.findFirst({
    where: { id: input.roomId, propertyId: property.id, isActive: true },
    include: { roomType: true },
  });
  if (!room) return { success: false, error: "Selected room not found." };
  const roomType = room.roomType;
  if (!roomType.isActive) {
    return { success: false, error: "This room type is no longer active." };
  }

  // ── Cheapest active rate plan for the room type ────────────────────────────
  const ratePlan = await prisma.ratePlan.findFirst({
    where: {
      roomTypeId: roomType.id,
      isActive: true,
      isPackage: false,
      minStay: { lte: nights },
    },
    orderBy: { basePrice: "asc" },
  });
  if (!ratePlan) {
    return { success: false, error: "No rate plan available for these dates." };
  }

  // ── Guard against double-booking the chosen room ───────────────────────────
  const conflict = await prisma.bookingRoom.findFirst({
    where: {
      roomId: room.id,
      booking: { status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] } },
      checkIn: { lt: checkOut },
      checkOut: { gt: checkIn },
    },
    select: { id: true },
  });
  if (conflict) {
    return { success: false, error: `Room ${room.number} is already booked for these dates.` };
  }
  const maintenance = await prisma.maintenanceBlock.findFirst({
    where: {
      roomId: room.id,
      status: "ACTIVE",
      startDate: { lt: checkOut },
      endDate: { gt: checkIn },
    },
    select: { id: true },
  });
  if (maintenance) {
    return { success: false, error: `Room ${room.number} is blocked for maintenance.` };
  }

  // ── Price (authoritative, recomputed server-side) ──────────────────────────
  const baseOccupancy = roomType.baseOccupancy ?? 2;
  const extraAdults = Math.max(0, adults - baseOccupancy);

  const price = calculatePrice({
    checkIn,
    checkOut,
    ratePerNight: ratePlan.basePrice,
    extraAdults,
    extraAdultPrice: ratePlan.extraAdultPrice,
    extraChildrenWithBed: 0,
    extraChildWithBedPrice: ratePlan.extraChildWithBed,
    extraChildrenNoBed: 0,
    extraChildNoBedPrice: ratePlan.extraChildNoBed,
    addons: [],
    couponDiscount: 0,
  });

  // ── Payment ────────────────────────────────────────────────────────────────
  const noPayment = !input.paymentMethod || input.paymentMethod === "None";
  let paidAmount = 0;
  if (!noPayment) {
    const rupees = Number(input.amountRupees);
    if (Number.isNaN(rupees) || rupees < 0) {
      return { success: false, error: "Enter a valid payment amount." };
    }
    paidAmount = Math.min(price.totalAmount, Math.round(rupees * 100));
  }
  const balanceDue = Math.max(0, price.totalAmount - paidAmount);
  const finalStatus =
    paidAmount >= price.totalAmount && price.totalAmount > 0 ? "CONFIRMED" : "PENDING";
  const paymentType: PaymentType = paidAmount >= price.totalAmount ? "FULL" : "ADVANCE";

  const bookingRef = "RS" + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  const now = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Upsert guest by phone
      let guest = await tx.guest.findFirst({ where: { phone: guestPhone } });
      if (!guest) {
        guest = await tx.guest.create({ data: { name: guestName, phone: guestPhone } });
      } else {
        guest = await tx.guest.update({
          where: { id: guest.id },
          data: { name: guestName },
        });
      }

      // 2. Create booking
      const booking = await tx.booking.create({
        data: {
          bookingRef,
          propertyId: property.id,
          guestId: guest.id,
          createdById: user.id,
          source,
          status: finalStatus,
          checkIn,
          checkOut,
          adults,
          children: 0,
          mealPlan: "ROOM_ONLY",
          roomSubtotal: price.roomSubtotal,
          addonSubtotal: price.addonSubtotal,
          discountAmount: price.discountAmount,
          taxAmount: price.roomTax + price.addonTax,
          totalAmount: price.totalAmount,
          paidAmount,
          balanceDue,
          currency: "INR",
        },
      });

      // 3. Create BookingRoom (pinned to the chosen physical room) + nights
      const bookingRoom = await tx.bookingRoom.create({
        data: {
          bookingId: booking.id,
          roomTypeId: roomType.id,
          ratePlanId: ratePlan.id,
          roomId: room.id,
          checkIn,
          checkOut,
          extraAdults,
          extraChildren: 0,
          subtotal: price.roomSubtotal,
          taxAmount: price.roomTax,
          status: finalStatus,
        },
      });

      await tx.bookingRoomNight.createMany({
        data: price.nights.map((n) => ({
          bookingRoomId: bookingRoom.id,
          date: new Date(n.date),
          rate: n.rate,
          gstRate: n.gstRate,
          taxAmount: n.taxAmount,
        })),
      });

      // 4. Record captured payment
      if (paidAmount > 0) {
        await tx.payment.create({
          data: {
            bookingId: booking.id,
            type: paymentType,
            status: "CAPTURED",
            amount: paidAmount,
            currency: "INR",
            method: input.paymentMethod,
            capturedAt: now,
          },
        });
      }

      // 5. Audit log
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "BOOKING_CREATED",
          entityType: "Booking",
          entityId: booking.id,
        },
      });
    });
  } catch {
    return { success: false, error: "Could not create booking. Please try again." };
  }

  revalidatePath("/admin/room-rack");
  revalidatePath("/admin/bookings");
  return { success: true, bookingRef };
}
