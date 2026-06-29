import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendBookingConfirmation } from "@/lib/notifications";
import { differenceInCalendarDays } from "date-fns";

export const dynamic = "force-dynamic";

// Razorpay sends raw body — disable body parsing
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";

  // Validate webhook signature
  if (process.env.RAZORPAY_WEBHOOK_SECRET) {
    const expected = createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");
    if (expected !== signature) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
  }

  let event: {
    event: string;
    payload: { payment: { entity: { id: string; order_id: string; status: string } } };
  };

  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const entity = event?.payload?.payment?.entity;
  if (!entity) {
    return NextResponse.json({ ok: true }); // Unknown event shape, ack and ignore
  }

  const now = new Date();

  if (event.event === "payment.captured") {
    const payment = await prisma.payment.findFirst({
      where: { razorpayOrderId: entity.order_id },
      include: {
        booking: {
          include: {
            guest: true,
            rooms: { include: { roomType: true } },
          },
        },
      },
    });

    if (!payment) return NextResponse.json({ ok: true });
    if (payment.status === "CAPTURED") return NextResponse.json({ ok: true }); // Idempotent

    const booking = payment.booking;
    const bookingRoom = booking.rooms[0];

    // Auto-assign physical room
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
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: "CAPTURED",
          razorpayPaymentId: entity.id,
          capturedAt: now,
        },
      });
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: "CONFIRMED",
          paidAmount: booking.totalAmount,
          balanceDue: 0,
        },
      });
      for (const br of booking.rooms) {
        await tx.bookingRoom.update({
          where: { id: br.id },
          data: {
            status: "CONFIRMED",
            ...(assignedRoomId && br.id === bookingRoom?.id ? { roomId: assignedRoomId } : {}),
          },
        });
      }
      await tx.inventoryHold.updateMany({
        where: { bookingId: booking.id, status: "HELD" },
        data: { status: "CONVERTED" },
      });
    });

    if (booking.guest.email) {
      const roomName = bookingRoom?.roomType.name ?? "Room";
      const nights = differenceInCalendarDays(booking.checkOut, booking.checkIn);
      sendBookingConfirmation({
        guestEmail: booking.guest.email,
        guestName: booking.guest.name,
        bookingRef: booking.bookingRef,
        roomName,
        checkIn: booking.checkIn.toISOString().slice(0, 10),
        checkOut: booking.checkOut.toISOString().slice(0, 10),
        nights,
        adults: booking.adults,
        children: booking.children,
        totalAmount: booking.totalAmount,
      });
    }
  } else if (event.event === "payment.failed") {
    const payment = await prisma.payment.findFirst({
      where: { razorpayOrderId: entity.order_id },
    });
    if (payment && payment.status !== "CAPTURED") {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED" },
      });
      await prisma.inventoryHold.updateMany({
        where: { bookingId: payment.bookingId, status: "HELD" },
        data: { status: "RELEASED" },
      });
    }
  }

  // Always return 200 — Razorpay retries on non-200
  return NextResponse.json({ ok: true });
}
