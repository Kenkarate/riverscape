import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ref: string }> }
) {
  const { ref } = await params;
  const email = req.nextUrl.searchParams.get("email");

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { bookingRef: ref },
    include: {
      guest: true,
      rooms: {
        include: {
          roomType: { select: { id: true, slug: true, name: true, images: true } },
          room: { select: { id: true, number: true } },
        },
      },
      addons: {
        include: { addon: { select: { id: true, name: true, category: true, unit: true } } },
      },
      payments: {
        select: {
          id: true,
          type: true,
          status: true,
          amount: true,
          razorpayOrderId: true,
          razorpayPaymentId: true,
          capturedAt: true,
          createdAt: true,
        },
      },
    },
  });

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  if (!booking.guest.email || booking.guest.email.toLowerCase() !== email.toLowerCase()) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  return NextResponse.json({
    bookingRef: booking.bookingRef,
    status: booking.status,
    checkIn: booking.checkIn.toISOString().slice(0, 10),
    checkOut: booking.checkOut.toISOString().slice(0, 10),
    adults: booking.adults,
    children: booking.children,
    mealPlan: booking.mealPlan,
    specialRequests: booking.specialRequests,
    roomSubtotal: booking.roomSubtotal,
    addonSubtotal: booking.addonSubtotal,
    discountAmount: booking.discountAmount,
    taxAmount: booking.taxAmount,
    totalAmount: booking.totalAmount,
    paidAmount: booking.paidAmount,
    balanceDue: booking.balanceDue,
    cancelledAt: booking.cancelledAt?.toISOString() ?? null,
    cancelReason: booking.cancelReason,
    createdAt: booking.createdAt.toISOString(),
    guest: {
      name: booking.guest.name,
      email: booking.guest.email,
      phone: booking.guest.phone,
    },
    rooms: booking.rooms.map((br) => ({
      roomType: br.roomType,
      room: br.room,
      checkIn: br.checkIn.toISOString().slice(0, 10),
      checkOut: br.checkOut.toISOString().slice(0, 10),
      subtotal: br.subtotal,
    })),
    addons: booking.addons.map((ba) => ({
      addon: ba.addon,
      quantity: ba.quantity,
      unitPrice: ba.unitPrice,
      total: ba.total,
    })),
    payments: booking.payments,
  });
}
