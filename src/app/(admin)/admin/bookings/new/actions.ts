"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { parseISO, differenceInCalendarDays } from "date-fns";
import { requireStaff } from "@/lib/auth-helpers";
import { calculatePrice } from "@/lib/pricing";
import { getAvailableRoomTypes, type AvailableRoomType } from "@/lib/availability";
import { BOOKING_SOURCE_OPTIONS } from "@/lib/badges";
import type { AdminBookingInput, GuestLookupResult, ActiveAddon } from "@/types";
import type { BookingSource, MealPlan, PaymentType } from "@prisma/client";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MEAL_PLANS: MealPlan[] = ["ROOM_ONLY", "BREAKFAST", "HALF_BOARD", "FULL_BOARD"];

/**
 * Returns available room types for the given stay. Staff-only.
 */
export async function getAvailability(
  checkIn: string,
  checkOut: string,
  adults: number
): Promise<AvailableRoomType[]> {
  await requireStaff();

  if (!DATE_RE.test(checkIn) || !DATE_RE.test(checkOut)) {
    throw new Error("Invalid date format");
  }

  const ci = parseISO(checkIn);
  const co = parseISO(checkOut);
  if (differenceInCalendarDays(co, ci) < 1) {
    throw new Error("Check-out must be after check-in");
  }

  return getAvailableRoomTypes({ checkIn: ci, checkOut: co, adults });
}

/**
 * Looks up an existing guest by exact phone match. Staff-only.
 */
export async function lookupGuest(phone: string): Promise<GuestLookupResult | null> {
  await requireStaff();
  const trimmed = phone.trim();
  if (!trimmed) return null;

  const guest = await prisma.guest.findFirst({
    where: { phone: trimmed },
    orderBy: { createdAt: "desc" },
  });
  if (!guest) return null;

  return {
    id: guest.id,
    name: guest.name,
    email: guest.email,
    phone: guest.phone,
    address: guest.address,
    idType: guest.idType,
    idNumber: guest.idNumber,
  };
}

/**
 * Returns the property's active add-ons for the booking form. Staff-only.
 */
export async function getActiveAddons(): Promise<ActiveAddon[]> {
  await requireStaff();

  const property = await prisma.property.findUnique({
    where: { slug: "riverscape" },
    select: { id: true },
  });
  if (!property) return [];

  const addons = await prisma.addon.findMany({
    where: { propertyId: property.id, isActive: true },
    select: { id: true, name: true, price: true, unit: true, gstRate: true },
    orderBy: { name: "asc" },
  });
  return addons;
}

/**
 * Creates a booking on behalf of a guest (walk-in / phone / OTA), records an
 * optional captured payment, auto-assigns a physical room, and redirects to the
 * new booking's detail page. Staff-only.
 */
export async function createAdminBooking(
  input: AdminBookingInput
): Promise<{ ok: false; message: string } | void> {
  const user = await requireStaff();

  // ── Validate stay ──────────────────────────────────────────────────────────
  if (!DATE_RE.test(input.checkIn) || !DATE_RE.test(input.checkOut)) {
    return { ok: false, message: "Select valid check-in and check-out dates." };
  }
  const checkIn = parseISO(input.checkIn);
  const checkOut = parseISO(input.checkOut);
  const nights = differenceInCalendarDays(checkOut, checkIn);
  if (nights < 1) {
    return { ok: false, message: "Check-out must be after check-in." };
  }

  const adults = Math.max(1, Math.min(10, Math.round(input.adults)));
  const children = Math.max(0, Math.min(10, Math.round(input.children)));

  const source = (BOOKING_SOURCE_OPTIONS as string[]).includes(input.source)
    ? (input.source as BookingSource)
    : "WALK_IN";
  const mealPlan = MEAL_PLANS.includes(input.mealPlan as MealPlan)
    ? (input.mealPlan as MealPlan)
    : "ROOM_ONLY";

  // ── Validate guest ─────────────────────────────────────────────────────────
  const guestName = input.guest.name?.trim();
  const guestPhone = input.guest.phone?.trim();
  if (!guestName) return { ok: false, message: "Guest name is required." };
  if (!guestPhone) return { ok: false, message: "Guest phone is required." };
  const guestEmail = input.guest.email?.trim() || null;
  const guestAddress = input.guest.address?.trim() || null;
  const guestIdType = input.guest.idType?.trim() || null;
  const guestIdNumber = input.guest.idNumber?.trim() || null;

  // ── Load property + room type + rate plan ──────────────────────────────────
  const property = await prisma.property.findUnique({ where: { slug: "riverscape" } });
  if (!property) return { ok: false, message: "Property not found." };

  const roomType = await prisma.roomType.findFirst({
    where: { id: input.roomTypeId, propertyId: property.id, isActive: true },
  });
  if (!roomType) return { ok: false, message: "Select a valid room type." };

  const ratePlan = await prisma.ratePlan.findFirst({
    where: {
      roomTypeId: roomType.id,
      isActive: true,
      isPackage: false,
      minStay: { lte: nights },
    },
    orderBy: { basePrice: "asc" },
  });
  if (!ratePlan) return { ok: false, message: "No rate plan available for these dates." };

  // ── Load add-ons ───────────────────────────────────────────────────────────
  const addonIds = Array.from(new Set(input.addonIds ?? []));
  const addons = addonIds.length
    ? await prisma.addon.findMany({
        where: { id: { in: addonIds }, isActive: true, propertyId: property.id },
      })
    : [];

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
    extraChildrenNoBed: children,
    extraChildNoBedPrice: ratePlan.extraChildNoBed,
    addons: addons.map((a) => ({ price: a.price, quantity: 1, gstRate: a.gstRate })),
    couponDiscount: 0,
  });

  // ── Payment ────────────────────────────────────────────────────────────────
  const noPayment = input.payment.method === "None" || !input.payment.method;
  let paidAmount = 0;
  if (!noPayment) {
    const rupees = Number(input.payment.amountRupees);
    if (Number.isNaN(rupees) || rupees < 0) {
      return { ok: false, message: "Enter a valid payment amount." };
    }
    paidAmount = Math.min(price.totalAmount, Math.round(rupees * 100));
  }
  const balanceDue = Math.max(0, price.totalAmount - paidAmount);
  const finalStatus = paidAmount >= price.totalAmount && price.totalAmount > 0 ? "CONFIRMED" : "PENDING";
  const paymentType: PaymentType = paidAmount >= price.totalAmount ? "FULL" : "ADVANCE";

  // ── Auto-assign a physical room (same query pattern as razorpay verify) ─────
  const candidate = await prisma.room.findFirst({
    where: {
      roomTypeId: roomType.id,
      isActive: true,
      housekeeping: { not: "OUT_OF_ORDER" },
      bookingRooms: {
        none: {
          booking: { status: { in: ["CONFIRMED", "CHECKED_IN"] } },
          checkIn: { lt: checkOut },
          checkOut: { gt: checkIn },
        },
      },
      maintenanceBlocks: {
        none: {
          startDate: { lt: checkOut },
          endDate: { gt: checkIn },
          status: "ACTIVE",
        },
      },
    },
    orderBy: { number: "asc" },
  });
  const assignedRoomId = candidate?.id ?? null;

  const bookingRef = "RS" + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  const now = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Upsert guest by phone
      let guest = await tx.guest.findFirst({ where: { phone: guestPhone } });
      if (!guest) {
        guest = await tx.guest.create({
          data: {
            name: guestName,
            email: guestEmail,
            phone: guestPhone,
            address: guestAddress,
            idType: guestIdType,
            idNumber: guestIdNumber,
          },
        });
      } else {
        guest = await tx.guest.update({
          where: { id: guest.id },
          data: {
            name: guestName,
            email: guestEmail,
            ...(guestAddress ? { address: guestAddress } : {}),
            ...(guestIdType ? { idType: guestIdType } : {}),
            ...(guestIdNumber ? { idNumber: guestIdNumber } : {}),
          },
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
          children,
          mealPlan,
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

      // 3. Create BookingRoom + nights
      const bookingRoom = await tx.bookingRoom.create({
        data: {
          bookingId: booking.id,
          roomTypeId: roomType.id,
          ratePlanId: ratePlan.id,
          roomId: assignedRoomId,
          checkIn,
          checkOut,
          extraAdults,
          extraChildren: children,
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

      // 4. Create BookingAddon records
      if (addons.length > 0) {
        await tx.bookingAddon.createMany({
          data: addons.map((a) => {
            const tax = Math.round((a.price * a.gstRate) / 100);
            return {
              bookingId: booking.id,
              addonId: a.id,
              quantity: 1,
              unitPrice: a.price,
              gstRate: a.gstRate,
              taxAmount: tax,
              total: a.price + tax,
            };
          }),
        });
      }

      // 5. Record captured payment
      if (paidAmount > 0) {
        await tx.payment.create({
          data: {
            bookingId: booking.id,
            type: paymentType,
            status: "CAPTURED",
            amount: paidAmount,
            currency: "INR",
            method: input.payment.method,
            capturedAt: now,
          },
        });
      }

      // 6. Audit log
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
    return { ok: false, message: "Could not create booking. Please try again." };
  }

  revalidatePath("/admin/bookings");
  redirect(`/admin/bookings/${bookingRef}`);
}
