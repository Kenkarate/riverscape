import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseISO, differenceInCalendarDays } from "date-fns";
import Razorpay from "razorpay";
import { prisma } from "@/lib/prisma";
import { calculatePrice } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  adults: z.number().int().min(1),
  children: z.number().int().min(0).default(0),
  roomTypeSlug: z.string().min(1),
  mealPlan: z.enum(["ROOM_ONLY", "BREAKFAST", "HALF_BOARD", "FULL_BOARD"]).default("ROOM_ONLY"),
  addonIds: z.array(z.string()).default([]),
  couponCode: z.string().optional(),
  guestName: z.string().min(1),
  guestEmail: z.string().email(),
  guestPhone: z.string().min(7),
  specialRequests: z.string().optional(),
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

  const {
    checkIn: ciStr,
    checkOut: coStr,
    adults,
    children,
    roomTypeSlug,
    mealPlan,
    addonIds,
    couponCode,
    guestName,
    guestEmail,
    guestPhone,
    specialRequests,
  } = parsed.data;

  const checkIn = parseISO(ciStr);
  const checkOut = parseISO(coStr);
  const nights = differenceInCalendarDays(checkOut, checkIn);

  if (nights < 1) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  // Load property + room type
  const property = await prisma.property.findUnique({ where: { slug: "riverscape" } });
  if (!property) return NextResponse.json({ error: "Property not found" }, { status: 404 });

  const roomType = await prisma.roomType.findFirst({
    where: { slug: roomTypeSlug, propertyId: property.id, isActive: true },
  });
  if (!roomType) return NextResponse.json({ error: "Room type not found" }, { status: 404 });

  // Re-verify availability
  const now = new Date();
  const totalRooms = await prisma.room.count({ where: { roomTypeId: roomType.id, isActive: true } });
  const booked = await prisma.bookingRoom.count({
    where: {
      roomTypeId: roomType.id,
      booking: { status: { in: ["CONFIRMED", "CHECKED_IN"] } },
      checkIn: { lt: checkOut },
      checkOut: { gt: checkIn },
    },
  });
  const maintenanceRows = await prisma.maintenanceBlock.findMany({
    where: {
      room: { roomTypeId: roomType.id },
      startDate: { lt: checkOut },
      endDate: { gt: checkIn },
      status: "ACTIVE",
    },
    select: { roomId: true },
  });
  const maint = new Set(maintenanceRows.map((m) => m.roomId)).size;
  const held = await prisma.inventoryHold.count({
    where: {
      roomTypeId: roomType.id,
      status: "HELD",
      expiresAt: { gt: now },
      checkIn: { lt: checkOut },
      checkOut: { gt: checkIn },
    },
  });
  if (totalRooms - booked - maint - held < 1) {
    return NextResponse.json({ error: "Room no longer available for selected dates" }, { status: 409 });
  }

  // Get rate plan
  const ratePlan = await prisma.ratePlan.findFirst({
    where: { roomTypeId: roomType.id, isActive: true, isPackage: false, minStay: { lte: nights } },
    orderBy: { basePrice: "asc" },
  });
  if (!ratePlan) return NextResponse.json({ error: "No rate plan available" }, { status: 400 });

  // Load addons
  const addons = addonIds.length
    ? await prisma.addon.findMany({ where: { id: { in: addonIds }, isActive: true } })
    : [];

  const baseOccupancy = roomType.baseOccupancy ?? 2;
  const extraAdults = Math.max(0, adults - baseOccupancy);
  const extraChildrenWithBed = 0; // simplified: no per-child bed selection in this flow
  const extraChildrenNoBed = children;

  const priceInput = {
    checkIn,
    checkOut,
    ratePerNight: ratePlan.basePrice,
    extraAdults,
    extraAdultPrice: ratePlan.extraAdultPrice,
    extraChildrenWithBed,
    extraChildWithBedPrice: ratePlan.extraChildWithBed,
    extraChildrenNoBed,
    extraChildNoBedPrice: ratePlan.extraChildNoBed,
    addons: addons.map((a) => ({ price: a.price, quantity: 1, gstRate: a.gstRate })),
    couponDiscount: 0,
  };

  // Validate + apply coupon
  let couponId: string | undefined;
  if (couponCode) {
    const coupon = await prisma.coupon.findFirst({
      where: { code: couponCode.toUpperCase(), isActive: true },
    });
    if (coupon && coupon.validFrom <= now && coupon.validTo >= now) {
      const subtotal =
        priceInput.ratePerNight * nights +
        priceInput.extraAdults * priceInput.extraAdultPrice * nights;
      let disc =
        coupon.type === "PERCENT"
          ? Math.round((subtotal * coupon.value) / 100)
          : coupon.value;
      if (coupon.maxDiscount !== null) disc = Math.min(disc, coupon.maxDiscount);
      priceInput.couponDiscount = disc;
      couponId = coupon.id;
    }
  }

  const price = calculatePrice(priceInput);

  // Generate booking ref
  const bookingRef =
    "RS" + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Upsert guest
      let guest = await tx.guest.findFirst({
        where: { phone: guestPhone },
      });
      if (!guest) {
        guest = await tx.guest.create({
          data: { name: guestName, email: guestEmail, phone: guestPhone },
        });
      } else {
        guest = await tx.guest.update({
          where: { id: guest.id },
          data: { name: guestName, email: guestEmail },
        });
      }

      // Create booking
      const booking = await tx.booking.create({
        data: {
          bookingRef,
          propertyId: property.id,
          guestId: guest.id,
          source: "DIRECT",
          status: "PENDING",
          checkIn,
          checkOut,
          adults,
          children,
          mealPlan,
          specialRequests,
          couponId: couponId ?? null,
          roomSubtotal: price.roomSubtotal,
          addonSubtotal: price.addonSubtotal,
          discountAmount: price.discountAmount,
          taxAmount: price.roomTax + price.addonTax,
          totalAmount: price.totalAmount,
          paidAmount: 0,
          balanceDue: price.totalAmount,
          currency: "INR",
        },
      });

      // Create BookingRoom
      const bookingRoom = await tx.bookingRoom.create({
        data: {
          bookingId: booking.id,
          roomTypeId: roomType.id,
          ratePlanId: ratePlan.id,
          checkIn,
          checkOut,
          extraAdults,
          extraChildren: children,
          subtotal: price.roomSubtotal,
          taxAmount: price.roomTax,
          status: "PENDING",
        },
      });

      // Create BookingRoomNight records
      await tx.bookingRoomNight.createMany({
        data: price.nights.map((n) => ({
          bookingRoomId: bookingRoom.id,
          date: new Date(n.date),
          rate: n.rate,
          gstRate: n.gstRate,
          taxAmount: n.taxAmount,
        })),
      });

      // Create BookingAddon records
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

      // Create InventoryHold
      const holdToken = crypto.randomUUID();
      const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);
      await tx.inventoryHold.create({
        data: {
          roomTypeId: roomType.id,
          checkIn,
          checkOut,
          units: 1,
          holdToken,
          status: "HELD",
          expiresAt,
          bookingId: booking.id,
        },
      });

      // Create Payment record
      const payment = await tx.payment.create({
        data: {
          bookingId: booking.id,
          type: "FULL",
          status: "CREATED",
          amount: price.totalAmount,
          currency: "INR",
        },
      });

      return { booking, payment };
    });

    // Create Razorpay order (outside transaction — external call)
    let razorpayOrderId: string | null = null;
    if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
      const rzp = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      });
      const order = await rzp.orders.create({
        amount: price.totalAmount,
        currency: "INR",
        receipt: bookingRef,
      });
      razorpayOrderId = order.id;

      await prisma.payment.update({
        where: { id: result.payment.id },
        data: { razorpayOrderId },
      });
    }

    return NextResponse.json({
      bookingRef,
      razorpayOrderId,
      amount: price.totalAmount,
      currency: "INR",
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? null,
      guestName,
      guestEmail,
      guestPhone,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Booking creation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
