import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHmac } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendBookingConfirmation, bookingConfirmationWaLink } from "@/lib/notifications";
import { differenceInCalendarDays } from "date-fns";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  bookingRef: z.string().min(1),
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { bookingRef, razorpayOrderId, razorpayPaymentId, razorpaySignature } = parsed.data;

  // Verify HMAC signature
  if (process.env.RAZORPAY_KEY_SECRET) {
    const expectedSig = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");
    if (expectedSig !== razorpaySignature) {
      return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
    }
  }

  const booking = await prisma.booking.findUnique({
    where: { bookingRef },
    include: {
      guest: true,
      rooms: { include: { roomType: true } },
      payments: true,
    },
  });

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const payment = booking.payments.find((p) => p.razorpayOrderId === razorpayOrderId);
  if (!payment) {
    return NextResponse.json({ error: "Payment record not found" }, { status: 404 });
  }

  if (payment.status === "CAPTURED") {
    // Idempotent — already processed
    return NextResponse.json({ success: true, bookingRef });
  }

  const now = new Date();

  // Auto-assign a physical room
  const bookingRoom = booking.rooms[0];
  let assignedRoomId: string | null = null;
  if (bookingRoom && !bookingRoom.roomId) {
    const candidate = await prisma.room.findFirst({
      where: {
        roomTypeId: bookingRoom.roomTypeId,
        isActive: true,
        housekeeping: { not: "OUT_OF_ORDER" },
        bookingRooms: {
          none: {
            booking: { status: { in: ["CONFIRMED", "CHECKED_IN"] } },
            checkIn: { lt: booking.checkOut },
            checkOut: { gt: booking.checkIn },
          },
        },
        maintenanceBlocks: {
          none: {
            startDate: { lt: booking.checkOut },
            endDate: { gt: booking.checkIn },
            status: "ACTIVE",
          },
        },
      },
      orderBy: { number: "asc" },
    });
    if (candidate) assignedRoomId = candidate.id;
  }

  await prisma.$transaction(async (tx) => {
    // Capture payment
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "CAPTURED",
        razorpayPaymentId,
        razorpaySignature,
        capturedAt: now,
      },
    });

    // Confirm booking
    await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: "CONFIRMED",
        paidAmount: booking.totalAmount,
        balanceDue: 0,
      },
    });

    // Confirm all booking rooms + assign physical room
    for (const br of booking.rooms) {
      await tx.bookingRoom.update({
        where: { id: br.id },
        data: {
          status: "CONFIRMED",
          ...(assignedRoomId && br.id === bookingRoom?.id ? { roomId: assignedRoomId } : {}),
        },
      });
    }

    // Release inventory hold
    await tx.inventoryHold.updateMany({
      where: { bookingId: booking.id, status: "HELD" },
      data: { status: "CONVERTED" },
    });
  });

  // Send confirmation email non-blocking
  if (booking.guest.email) {
    const roomName = bookingRoom?.roomType.name ?? "Room";
    const nights = differenceInCalendarDays(booking.checkOut, booking.checkIn);
    sendBookingConfirmation({
      guestEmail: booking.guest.email,
      guestName: booking.guest.name,
      bookingRef,
      roomName,
      checkIn: booking.checkIn.toISOString().slice(0, 10),
      checkOut: booking.checkOut.toISOString().slice(0, 10),
      nights,
      adults: booking.adults,
      children: booking.children,
      totalAmount: booking.totalAmount,
    });
  }

  return NextResponse.json({ success: true, bookingRef });
}
