"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { parseISO, differenceInCalendarDays } from "date-fns";
import { requireStaff, requireAdmin } from "@/lib/auth-helpers";
import { sendCancellationEmail } from "@/lib/notifications";
import { calculatePrice } from "@/lib/pricing";
import { BOOKING_SOURCE_OPTIONS } from "@/lib/badges";
import type { BookingStatus, PaymentType, MealPlan, BookingSource } from "@prisma/client";
import type { AvailableRoomOption } from "@/types";

function formatStayDate(d: Date): string {
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function revalidateBooking(bookingRef: string) {
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${bookingRef}`);
}

async function transitionStatus(
  bookingId: string,
  newStatus: BookingStatus,
  extra: Record<string, unknown> = {}
) {
  const user = await requireStaff();

  await prisma.$transaction([
    prisma.booking.update({
      where: { id: bookingId },
      data: { status: newStatus, ...extra },
    }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: `STATUS_${newStatus}`,
        entityType: "Booking",
        entityId: bookingId,
      },
    }),
  ]);

  revalidatePath("/admin/bookings");
  revalidatePath("/admin/room-rack");
}

export async function checkInBooking(bookingId: string) {
  await transitionStatus(bookingId, "CHECKED_IN");
}

export async function checkOutBooking(bookingId: string) {
  await transitionStatus(bookingId, "CHECKED_OUT");
}

/**
 * Cancels a booking. Admin-only (ADMIN / SUPER_ADMIN). Marks the booking
 * CANCELLED, records the reason, releases held daily inventory back to the pool,
 * writes an audit row, and emails the guest. Idempotent if already cancelled.
 */
export async function cancelBooking(bookingId: string, reason: string) {
  const user = await requireAdmin();

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      bookingRef: true,
      status: true,
      checkIn: true,
      checkOut: true,
      guest: { select: { name: true, email: true } },
      rooms: {
        select: {
          roomTypeId: true,
          checkIn: true,
          checkOut: true,
          roomType: { select: { name: true } },
        },
      },
    },
  });
  if (!booking) throw new Error("Booking not found");
  if (booking.status === "CANCELLED") return; // idempotent

  // Inventory was only reserved for live bookings.
  const releaseInventory = ["PENDING", "CONFIRMED", "CHECKED_IN"].includes(booking.status);

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelReason: reason || "Cancelled by staff",
      },
    });
    await tx.bookingRoom.updateMany({
      where: { bookingId },
      data: { status: "CANCELLED" },
    });

    if (releaseInventory) {
      // Count units this booking held per (room type, night).
      const counts = new Map<string, number>();
      for (const br of booking.rooms) {
        const cur = new Date(br.checkIn);
        const end = new Date(br.checkOut);
        while (cur < end) {
          const key = `${br.roomTypeId}|${cur.toISOString().slice(0, 10)}`;
          counts.set(key, (counts.get(key) ?? 0) + 1);
          cur.setDate(cur.getDate() + 1);
        }
      }
      const typeIds = Array.from(new Set(booking.rooms.map((r) => r.roomTypeId)));
      if (typeIds.length) {
        const rows = await tx.dailyInventory.findMany({
          where: {
            roomTypeId: { in: typeIds },
            date: { gte: booking.checkIn, lt: booking.checkOut },
          },
        });
        for (const row of rows) {
          const dec = counts.get(`${row.roomTypeId}|${row.date.toISOString().slice(0, 10)}`);
          if (dec) {
            const next = Math.max(0, row.bookedUnits - dec);
            if (next !== row.bookedUnits) {
              await tx.dailyInventory.update({
                where: { id: row.id },
                data: { bookedUnits: next },
              });
            }
          }
        }
      }
    }

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "STATUS_CANCELLED",
        entityType: "Booking",
        entityId: bookingId,
        before: { status: booking.status },
        after: { status: "CANCELLED", reason: reason || null },
      },
    });
  });

  revalidateBooking(booking.bookingRef);
  revalidatePath("/admin/room-rack");

  // Notify the guest by email — non-blocking, but failures are logged.
  if (booking.guest.email) {
    try {
      await sendCancellationEmail({
        guestEmail: booking.guest.email,
        guestName: booking.guest.name,
        bookingRef: booking.bookingRef,
        roomName: booking.rooms[0]?.roomType.name ?? "Room",
        checkIn: formatStayDate(booking.checkIn),
        checkOut: formatStayDate(booking.checkOut),
        reason: reason || undefined,
      });
    } catch (err) {
      console.error("Failed to send cancellation email:", err);
    }
  }
}

export async function confirmBooking(bookingId: string) {
  await transitionStatus(bookingId, "CONFIRMED");
}

export async function markNoShow(bookingId: string): Promise<void> {
  const user = await requireStaff();

  const bookingRef = await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUniqueOrThrow({
      where: { id: bookingId },
      select: { status: true, bookingRef: true },
    });
    if (booking.status !== "CONFIRMED") {
      throw new Error("Only confirmed bookings can be marked no-show");
    }
    await tx.booking.update({
      where: { id: bookingId },
      data: { status: "NO_SHOW" },
    });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "STATUS_NO_SHOW",
        entityType: "Booking",
        entityId: bookingId,
      },
    });
    return booking.bookingRef;
  });

  revalidateBooking(bookingRef);
}

// ─── Record payment ─────────────────────────────────────────────────────────

export async function recordPayment(
  bookingId: string,
  amountRupees: number,
  method: string,
  type: PaymentType
) {
  const user = await requireStaff();

  const amount = Math.round(Number(amountRupees) * 100);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Enter a valid payment amount");
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      bookingRef: true,
      status: true,
      paidAmount: true,
      balanceDue: true,
    },
  });
  if (!booking) throw new Error("Booking not found");

  const newPaid = booking.paidAmount + amount;
  const newBalance = Math.max(0, booking.balanceDue - amount);
  const newStatus: BookingStatus =
    newBalance === 0 && booking.status === "PENDING" ? "CONFIRMED" : booking.status;

  await prisma.$transaction([
    prisma.payment.create({
      data: {
        bookingId,
        type,
        status: "CAPTURED",
        amount,
        currency: "INR",
        method,
        capturedAt: new Date(),
      },
    }),
    prisma.booking.update({
      where: { id: bookingId },
      data: { paidAmount: newPaid, balanceDue: newBalance, status: newStatus },
    }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "PAYMENT_RECORDED",
        entityType: "Booking",
        entityId: bookingId,
      },
    }),
  ]);

  revalidateBooking(booking.bookingRef);
}

// ─── GST invoice ────────────────────────────────────────────────────────────

export async function generateInvoice(
  bookingId: string
): Promise<{ invoiceNumber: string }> {
  const user = await requireStaff();

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      bookingRef: true,
      status: true,
      propertyId: true,
      roomSubtotal: true,
      addonSubtotal: true,
      discountAmount: true,
      taxAmount: true,
      totalAmount: true,
      invoice: { select: { number: true } },
    },
  });
  if (!booking) throw new Error("Booking not found");

  // Idempotent — return the existing invoice number if already generated.
  if (booking.invoice) {
    return { invoiceNumber: booking.invoice.number };
  }

  if (!["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"].includes(booking.status)) {
    throw new Error("Invoice can only be generated for confirmed bookings");
  }

  const taxableValue =
    booking.roomSubtotal + booking.addonSubtotal - booking.discountAmount;
  const cgst = Math.floor(booking.taxAmount / 2);
  const sgst = booking.taxAmount - cgst; // keeps cgst + sgst === taxAmount exactly
  const year = new Date().getFullYear();

  const invoice = await prisma.$transaction(async (tx) => {
    // Atomically reserve the next sequential invoice number for the property.
    const property = await tx.property.update({
      where: { id: booking.propertyId },
      data: { invoiceSeq: { increment: 1 } },
      select: { invoiceSeq: true, gstin: true },
    });

    const number = `RSI-${year}-${String(property.invoiceSeq).padStart(4, "0")}`;

    const created = await tx.invoice.create({
      data: {
        bookingId: booking.id,
        number,
        gstin: property.gstin,
        placeOfSupply: "Kerala",
        taxableValue,
        cgst,
        sgst,
        igst: 0,
        total: booking.totalAmount,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "INVOICE_GENERATED",
        entityType: "Invoice",
        entityId: created.id,
      },
    });

    return created;
  });

  revalidateBooking(booking.bookingRef);
  return { invoiceNumber: invoice.number };
}

// ─── Room assignment ────────────────────────────────────────────────────────

export async function getAvailableRooms(
  roomTypeId: string,
  checkIn: string,
  checkOut: string,
  excludeBookingRoomId?: string
): Promise<AvailableRoomOption[]> {
  await requireStaff();

  const ci = parseISO(checkIn);
  const co = parseISO(checkOut);

  const rooms = await prisma.room.findMany({
    where: {
      roomTypeId,
      isActive: true,
      housekeeping: { not: "OUT_OF_ORDER" },
      bookingRooms: {
        none: {
          ...(excludeBookingRoomId ? { id: { not: excludeBookingRoomId } } : {}),
          booking: { status: { in: ["CONFIRMED", "CHECKED_IN"] } },
          checkIn: { lt: co },
          checkOut: { gt: ci },
        },
      },
      maintenanceBlocks: {
        none: {
          startDate: { lt: co },
          endDate: { gt: ci },
          status: "ACTIVE",
        },
      },
    },
    select: { id: true, number: true, floor: true },
    orderBy: { number: "asc" },
  });

  return rooms;
}

export async function assignRoom(bookingRoomId: string, roomId: string) {
  const user = await requireStaff();

  const bookingRoom = await prisma.bookingRoom.findUnique({
    where: { id: bookingRoomId },
    select: {
      id: true,
      roomTypeId: true,
      checkIn: true,
      checkOut: true,
      booking: { select: { bookingRef: true } },
    },
  });
  if (!bookingRoom) throw new Error("Booking room not found");

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { id: true, roomTypeId: true, isActive: true, housekeeping: true },
  });
  if (!room) throw new Error("Room not found");
  if (room.roomTypeId !== bookingRoom.roomTypeId) {
    throw new Error("Room is not of the correct room type");
  }
  if (!room.isActive || room.housekeeping === "OUT_OF_ORDER") {
    throw new Error("Room is not available");
  }

  // Conflicting confirmed/checked-in stays on the same physical room.
  const conflict = await prisma.bookingRoom.count({
    where: {
      roomId,
      id: { not: bookingRoomId },
      booking: { status: { in: ["CONFIRMED", "CHECKED_IN"] } },
      checkIn: { lt: bookingRoom.checkOut },
      checkOut: { gt: bookingRoom.checkIn },
    },
  });
  if (conflict > 0) {
    throw new Error("Room is already booked for these dates");
  }

  await prisma.$transaction([
    prisma.bookingRoom.update({
      where: { id: bookingRoomId },
      data: { roomId },
    }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "ROOM_ASSIGNED",
        entityType: "BookingRoom",
        entityId: bookingRoomId,
      },
    }),
  ]);

  revalidateBooking(bookingRoom.booking.bookingRef);
  revalidatePath("/admin/room-rack");
}

// ─── Edit booking ─────────────────────────────────────────────────────────────

const UPDATE_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MEAL_PLANS: MealPlan[] = ["ROOM_ONLY", "BREAKFAST", "HALF_BOARD", "FULL_BOARD"];

export interface UpdateBookingInput {
  bookingRef: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  adults: number;
  children: number;
  mealPlan?: string; // MealPlan — keeps existing value when omitted
  source?: string; // BookingSource — keeps existing value when omitted
  specialRequests?: string | null;
  roomTypeId?: string; // optional move to a different room type (single-room only)
}

export interface UpdateBookingResult {
  success: boolean;
  error?: string;
}

/**
 * Finds a free physical room of the given type for the date window, excluding the
 * booking room being edited from the conflict check. Returns its id or null.
 */
async function findFreeRoomOfType(
  roomTypeId: string,
  checkIn: Date,
  checkOut: Date,
  excludeBookingRoomId: string
): Promise<string | null> {
  const room = await prisma.room.findFirst({
    where: {
      roomTypeId,
      isActive: true,
      housekeeping: { not: "OUT_OF_ORDER" },
      bookingRooms: {
        none: {
          id: { not: excludeBookingRoomId },
          booking: { status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] } },
          checkIn: { lt: checkOut },
          checkOut: { gt: checkIn },
        },
      },
      maintenanceBlocks: {
        none: { startDate: { lt: checkOut }, endDate: { gt: checkIn }, status: "ACTIVE" },
      },
    },
    orderBy: { number: "asc" },
    select: { id: true },
  });
  return room?.id ?? null;
}

/**
 * Edits an existing booking's stay window, occupancy, meal plan, source, notes and
 * (optionally) room type. Pricing is recomputed server-side from the authoritative
 * rate plan — client amounts are never trusted. BookingRoomNight rows are rebuilt
 * and room availability is re-checked (excluding this booking). Staff-only.
 */
export async function updateBooking(
  input: UpdateBookingInput
): Promise<UpdateBookingResult> {
  const user = await requireStaff();

  if (!UPDATE_DATE_RE.test(input.checkIn) || !UPDATE_DATE_RE.test(input.checkOut)) {
    return { success: false, error: "Select valid check-in and check-out dates." };
  }
  const checkIn = parseISO(input.checkIn);
  const checkOut = parseISO(input.checkOut);
  const nights = differenceInCalendarDays(checkOut, checkIn);
  if (nights < 1) return { success: false, error: "Check-out must be after check-in." };

  const booking = await prisma.booking.findUnique({
    where: { bookingRef: input.bookingRef },
    include: {
      rooms: { include: { roomType: true, ratePlan: true } },
      addons: true,
    },
  });
  if (!booking) return { success: false, error: "Booking not found." };
  if (["CANCELLED", "CHECKED_OUT", "NO_SHOW"].includes(booking.status)) {
    return { success: false, error: "This booking can no longer be edited." };
  }
  const primary = booking.rooms[0];
  if (!primary) return { success: false, error: "Booking has no room to edit." };

  const adults = Math.max(1, Math.min(10, Math.round(input.adults || 1)));
  const children = Math.max(0, Math.min(10, Math.round(input.children || 0)));

  const mealPlan = MEAL_PLANS.includes(input.mealPlan as MealPlan)
    ? (input.mealPlan as MealPlan)
    : booking.mealPlan;
  const source = (BOOKING_SOURCE_OPTIONS as string[]).includes(input.source ?? "")
    ? (input.source as BookingSource)
    : booking.source;
  const specialRequests =
    input.specialRequests !== undefined
      ? input.specialRequests?.trim() || null
      : booking.specialRequests;

  // A room-type move is only supported on single-room bookings.
  const moveType =
    !!input.roomTypeId &&
    booking.rooms.length === 1 &&
    input.roomTypeId !== primary.roomTypeId;
  const targetTypeId = moveType ? input.roomTypeId! : primary.roomTypeId;

  const roomType = await prisma.roomType.findFirst({
    where: { id: targetTypeId, propertyId: booking.propertyId, isActive: true },
  });
  if (!roomType) return { success: false, error: "Selected room type is not available." };

  // Reuse the current rate plan while it still fits; otherwise pick the cheapest.
  let ratePlan =
    !moveType &&
    primary.ratePlan.isActive &&
    primary.ratePlan.roomTypeId === targetTypeId &&
    primary.ratePlan.minStay <= nights
      ? primary.ratePlan
      : null;
  if (!ratePlan) {
    ratePlan = await prisma.ratePlan.findFirst({
      where: {
        roomTypeId: targetTypeId,
        isActive: true,
        isPackage: false,
        minStay: { lte: nights },
      },
      orderBy: { basePrice: "asc" },
    });
  }
  if (!ratePlan) return { success: false, error: "No rate plan available for these dates." };

  const baseOccupancy = roomType.baseOccupancy ?? 2;
  const extraAdults = Math.max(0, adults - baseOccupancy);

  // Authoritative re-price. Existing real add-ons are preserved; extra-guest
  // charges are recomputed from the new dates and occupancy.
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
    addons: booking.addons.map((a) => ({
      price: a.unitPrice,
      quantity: a.quantity,
      gstRate: a.gstRate,
    })),
    couponDiscount: booking.discountAmount,
  });

  // ── Re-check physical room availability (exclude this booking) ──────────────
  let newRoomId = primary.roomId;
  if (moveType) {
    // Old physical room belongs to the old type — relocate to a free one.
    newRoomId = await findFreeRoomOfType(targetTypeId, checkIn, checkOut, primary.id);
  } else if (primary.roomId) {
    const conflict = await prisma.bookingRoom.findFirst({
      where: {
        roomId: primary.roomId,
        id: { not: primary.id },
        booking: { status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] } },
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
      },
      select: { id: true },
    });
    const maintenance = await prisma.maintenanceBlock.findFirst({
      where: {
        roomId: primary.roomId,
        status: "ACTIVE",
        startDate: { lt: checkOut },
        endDate: { gt: checkIn },
      },
      select: { id: true },
    });
    if (conflict || maintenance) {
      // The pinned room no longer works for the new dates — try to relocate.
      const alt = await findFreeRoomOfType(targetTypeId, checkIn, checkOut, primary.id);
      if (!alt) {
        return {
          success: false,
          error: "No room of this type is free for the selected dates.",
        };
      }
      newRoomId = alt;
    }
  }

  const newTaxAmount = price.roomTax + price.addonTax;
  const newTotal = price.totalAmount;
  const newBalance = Math.max(0, newTotal - booking.paidAmount);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          checkIn,
          checkOut,
          adults,
          children,
          mealPlan,
          source,
          specialRequests,
          roomSubtotal: price.roomSubtotal,
          addonSubtotal: price.addonSubtotal,
          taxAmount: newTaxAmount,
          totalAmount: newTotal,
          balanceDue: newBalance,
        },
      });

      await tx.bookingRoom.update({
        where: { id: primary.id },
        data: {
          roomTypeId: targetTypeId,
          ratePlanId: ratePlan!.id,
          roomId: newRoomId,
          checkIn,
          checkOut,
          extraAdults,
          extraChildren: children,
          subtotal: price.roomSubtotal,
          taxAmount: price.roomTax,
        },
      });

      // Keep any additional rooms' date window in sync with the booking.
      if (booking.rooms.length > 1) {
        await tx.bookingRoom.updateMany({
          where: { bookingId: booking.id, id: { not: primary.id } },
          data: { checkIn, checkOut },
        });
      }

      // Rebuild the primary room's nightly breakdown for the new window.
      await tx.bookingRoomNight.deleteMany({ where: { bookingRoomId: primary.id } });
      await tx.bookingRoomNight.createMany({
        data: price.nights.map((n) => ({
          bookingRoomId: primary.id,
          date: new Date(n.date),
          rate: n.rate,
          gstRate: n.gstRate,
          taxAmount: n.taxAmount,
        })),
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "BOOKING_UPDATED",
          entityType: "Booking",
          entityId: booking.id,
          before: {
            checkIn: booking.checkIn.toISOString().slice(0, 10),
            checkOut: booking.checkOut.toISOString().slice(0, 10),
            adults: booking.adults,
            children: booking.children,
            mealPlan: booking.mealPlan,
            source: booking.source,
            roomTypeId: primary.roomTypeId,
            totalAmount: booking.totalAmount,
            balanceDue: booking.balanceDue,
          },
          after: {
            checkIn: input.checkIn,
            checkOut: input.checkOut,
            adults,
            children,
            mealPlan,
            source,
            roomTypeId: targetTypeId,
            totalAmount: newTotal,
            balanceDue: newBalance,
          },
        },
      });
    });
  } catch {
    return { success: false, error: "Could not update the booking. Please try again." };
  }

  revalidateBooking(booking.bookingRef);
  revalidatePath("/admin/room-rack");
  return { success: true };
}
