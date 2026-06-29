"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { parseISO } from "date-fns";
import { requireStaff } from "@/lib/auth-helpers";
import { sendCancellationEmail } from "@/lib/notifications";
import type { BookingStatus, PaymentType } from "@prisma/client";
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
}

export async function checkInBooking(bookingId: string) {
  await transitionStatus(bookingId, "CHECKED_IN");
}

export async function checkOutBooking(bookingId: string) {
  await transitionStatus(bookingId, "CHECKED_OUT");
}

export async function cancelBooking(bookingId: string, reason: string) {
  await transitionStatus(bookingId, "CANCELLED", {
    cancelledAt: new Date(),
    cancelReason: reason || "Cancelled by staff",
  });

  // Notify the guest by email — non-blocking, but failures are logged.
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      bookingRef: true,
      checkIn: true,
      checkOut: true,
      guest: { select: { name: true, email: true } },
      rooms: {
        take: 1,
        select: { roomType: { select: { name: true } } },
      },
    },
  });

  if (booking?.guest.email) {
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
}
