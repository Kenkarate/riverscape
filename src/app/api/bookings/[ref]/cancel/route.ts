import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendCancellationEmail } from "@/lib/notifications";

export const dynamic = "force-dynamic";

function formatStayDate(d: Date): string {
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const bodySchema = z.object({
  email: z.string().email(),
  reason: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ ref: string }> }
) {
  const { ref } = await params;

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

  const { email, reason } = parsed.data;

  const booking = await prisma.booking.findUnique({
    where: { bookingRef: ref },
    include: {
      guest: true,
      rooms: { include: { roomType: { select: { name: true } } } },
    },
  });

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  if (!booking.guest.email || booking.guest.email.toLowerCase() !== email.toLowerCase()) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const cancellableStatuses = ["PENDING", "CONFIRMED"] as const;
  if (!cancellableStatuses.includes(booking.status as "PENDING" | "CONFIRMED")) {
    return NextResponse.json(
      { error: `Cannot cancel a booking with status ${booking.status}` },
      { status: 400 }
    );
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: "CANCELLED",
        cancelledAt: now,
        cancelReason: reason ?? "Cancelled by guest",
      },
    });

    await tx.bookingRoom.updateMany({
      where: { bookingId: booking.id },
      data: { status: "CANCELLED" },
    });

    await tx.inventoryHold.updateMany({
      where: { bookingId: booking.id, status: "HELD" },
      data: { status: "RELEASED" },
    });
  });

  // Send cancellation email — non-blocking, but failures are logged.
  if (booking.guest.email) {
    try {
      await sendCancellationEmail({
        guestEmail: booking.guest.email,
        guestName: booking.guest.name,
        bookingRef: ref,
        roomName: booking.rooms[0]?.roomType.name ?? "Room",
        checkIn: formatStayDate(booking.checkIn),
        checkOut: formatStayDate(booking.checkOut),
        reason: reason || undefined,
      });
    } catch (err) {
      console.error("Failed to send cancellation email:", err);
    }
  }

  return NextResponse.json({ success: true });
}
