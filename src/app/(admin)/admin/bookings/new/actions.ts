"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { parseISO, differenceInCalendarDays } from "date-fns";
import { requireStaff } from "@/lib/auth-helpers";
import { calculatePrice } from "@/lib/pricing";
import { createFolioForBooking } from "@/lib/folio";
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
 * Creates a booking on behalf of a guest (walk-in / phone / OTA). Supports
 * **multiple rooms in one booking** — each room line carries its own room type
 * and occupancy. Pricing is recomputed authoritatively per line and summed,
 * one physical room is auto-assigned per line (no two lines share a room), an
 * optional captured payment is recorded, and the new booking's detail page is
 * returned via redirect. Staff-only.
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

  // ── Validate room lines ────────────────────────────────────────────────────
  const lines = (input.rooms ?? []).filter((r) => r && r.roomTypeId);
  if (lines.length === 0) {
    return { ok: false, message: "Add at least one room to the booking." };
  }
  if (lines.length > 10) {
    return { ok: false, message: "A single booking can hold at most 10 rooms." };
  }

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

  // ── Load property ──────────────────────────────────────────────────────────
  const property = await prisma.property.findUnique({ where: { slug: "riverscape" } });
  if (!property) return { ok: false, message: "Property not found." };

  // ── Load add-ons (booking-level, attached once) ────────────────────────────
  const addonIds = Array.from(new Set(input.addonIds ?? []));
  const addons = addonIds.length
    ? await prisma.addon.findMany({
        where: { id: { in: addonIds }, isActive: true, propertyId: property.id },
      })
    : [];

  // ── Build + price each room line; auto-assign one physical room per line ────
  interface BuiltLine {
    roomTypeId: string;
    roomTypeName: string;
    ratePlanId: string;
    assignedRoomId: string | null;
    children: number;
    extraAdults: number;
    roomSubtotal: number;
    roomTax: number;
    extraCharges: number; // extra-guest charges (untaxed), folded into addonSubtotal
    lineTotal: number;
    nights: { date: string; rate: number; gstRate: number; taxAmount: number }[];
  }

  const built: BuiltLine[] = [];
  const assignedRoomIds: string[] = [];
  let bookingAdults = 0;
  let bookingChildren = 0;
  let roomSubtotalSum = 0;
  let roomTaxSum = 0;
  let extraChargesSum = 0;

  for (const line of lines) {
    const adults = Math.max(1, Math.min(10, Math.round(line.adults || 1)));
    const children = Math.max(0, Math.min(10, Math.round(line.children || 0)));

    const roomType = await prisma.roomType.findFirst({
      where: { id: line.roomTypeId, propertyId: property.id, isActive: true },
    });
    if (!roomType) return { ok: false, message: "One of the selected room types is not available." };

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
      return { ok: false, message: `No rate plan available for ${roomType.name} on these dates.` };
    }

    const baseOccupancy = roomType.baseOccupancy ?? 2;
    const extraAdults = Math.max(0, adults - baseOccupancy);

    // Price the room line on its own (add-ons are applied once at booking level).
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
      addons: [],
      couponDiscount: 0,
    });

    // Auto-assign a free physical room, excluding ones already taken by an
    // earlier line in THIS booking.
    const candidate = await prisma.room.findFirst({
      where: {
        roomTypeId: roomType.id,
        isActive: true,
        ...(assignedRoomIds.length ? { id: { notIn: assignedRoomIds } } : {}),
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
    if (candidate) assignedRoomIds.push(candidate.id);

    built.push({
      roomTypeId: roomType.id,
      roomTypeName: roomType.name,
      ratePlanId: ratePlan.id,
      assignedRoomId: candidate?.id ?? null,
      children,
      extraAdults,
      roomSubtotal: price.roomSubtotal,
      roomTax: price.roomTax,
      extraCharges: price.addonSubtotal, // extra-guest charges when addons=[]
      lineTotal: price.totalAmount,
      nights: price.nights,
    });

    bookingAdults += adults;
    bookingChildren += children;
    roomSubtotalSum += price.roomSubtotal;
    roomTaxSum += price.roomTax;
    extraChargesSum += price.addonSubtotal;
  }

  // ── Real add-on totals (booking-level, quantity 1 each) ────────────────────
  const realAddonBase = addons.reduce((s, a) => s + a.price, 0);
  const realAddonTax = addons.reduce(
    (s, a) => s + Math.round((a.price * a.gstRate) / 100),
    0
  );

  // ── Booking aggregates (mirrors calculatePrice's tax/total conventions) ────
  const roomSubtotal = roomSubtotalSum;
  const addonSubtotal = extraChargesSum + realAddonBase;
  const taxAmount = roomTaxSum + realAddonTax;
  const totalAmount = roomSubtotal + addonSubtotal + taxAmount; // discount = 0

  // ── Payment ────────────────────────────────────────────────────────────────
  const noPayment = input.payment.method === "None" || !input.payment.method;
  let paidAmount = 0;
  if (!noPayment) {
    const rupees = Number(input.payment.amountRupees);
    if (Number.isNaN(rupees) || rupees < 0) {
      return { ok: false, message: "Enter a valid payment amount." };
    }
    paidAmount = Math.min(totalAmount, Math.round(rupees * 100));
  }
  const balanceDue = Math.max(0, totalAmount - paidAmount);
  const finalStatus = paidAmount >= totalAmount && totalAmount > 0 ? "CONFIRMED" : "PENDING";
  const paymentType: PaymentType = paidAmount >= totalAmount ? "FULL" : "ADVANCE";

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

      // 2. Create booking (occupancy summed across all room lines)
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
          adults: bookingAdults,
          children: bookingChildren,
          mealPlan,
          roomSubtotal,
          addonSubtotal,
          discountAmount: 0,
          taxAmount,
          totalAmount,
          paidAmount,
          balanceDue,
          currency: "INR",
        },
      });

      // 3. Create one BookingRoom (+ nights) per room line
      for (const b of built) {
        const bookingRoom = await tx.bookingRoom.create({
          data: {
            bookingId: booking.id,
            roomTypeId: b.roomTypeId,
            ratePlanId: b.ratePlanId,
            roomId: b.assignedRoomId,
            checkIn,
            checkOut,
            extraAdults: b.extraAdults,
            extraChildren: b.children,
            subtotal: b.roomSubtotal,
            taxAmount: b.roomTax,
            status: finalStatus,
          },
        });

        await tx.bookingRoomNight.createMany({
          data: b.nights.map((n) => ({
            bookingRoomId: bookingRoom.id,
            date: new Date(n.date),
            rate: n.rate,
            gstRate: n.gstRate,
            taxAmount: n.taxAmount,
          })),
        });
      }

      // 4. Create BookingAddon records (booking-level)
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
          after: { rooms: built.length, totalAmount },
        },
      });

      // 7. Open the guest folio (running tab) for this stay
      await createFolioForBooking(tx, {
        bookingId: booking.id,
        propertyId: property.id,
        guestId: guest.id,
        createdById: user.id,
      });
    });
  } catch {
    return { ok: false, message: "Could not create booking. Please try again." };
  }

  revalidatePath("/admin/bookings");
  revalidatePath("/admin/room-rack");
  redirect(`/admin/bookings/${bookingRef}`);
}
