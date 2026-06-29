import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  code: z.string().min(1),
  amount: z.number().int().min(0), // paise
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ valid: false, message: "Invalid request body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ valid: false, message: "Invalid request" }, { status: 400 });
  }

  const { code, amount } = parsed.data;
  const now = new Date();

  const coupon = await prisma.coupon.findFirst({
    where: { code: { equals: code.toUpperCase() }, isActive: true },
  });

  if (!coupon) {
    return NextResponse.json({ valid: false, message: "Coupon not found" });
  }
  if (coupon.validFrom > now) {
    return NextResponse.json({ valid: false, message: "Coupon not yet valid" });
  }
  if (coupon.validTo < now) {
    return NextResponse.json({ valid: false, message: "Coupon has expired" });
  }
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    return NextResponse.json({ valid: false, message: "Coupon usage limit reached" });
  }
  if (coupon.minBookingAmount > 0 && amount < coupon.minBookingAmount) {
    return NextResponse.json({
      valid: false,
      message: `Minimum booking amount of ₹${coupon.minBookingAmount / 100} required`,
    });
  }

  let discount = 0;
  if (coupon.type === "PERCENT") {
    discount = Math.round((amount * coupon.value) / 100);
    if (coupon.maxDiscount !== null) {
      discount = Math.min(discount, coupon.maxDiscount);
    }
  } else {
    discount = coupon.value;
  }

  // Discount can't exceed the amount
  discount = Math.min(discount, amount);

  return NextResponse.json({
    valid: true,
    discount,
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
  });
}
