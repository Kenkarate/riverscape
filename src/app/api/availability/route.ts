import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAvailableRoomTypes } from "@/lib/availability";
import { differenceInCalendarDays, parseISO } from "date-fns";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "checkIn must be YYYY-MM-DD"),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "checkOut must be YYYY-MM-DD"),
  adults: z.coerce.number().int().min(1).max(20).default(2),
  children: z.coerce.number().int().min(0).max(20).default(0),
});

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const raw = {
    checkIn: searchParams.get("checkIn") ?? "",
    checkOut: searchParams.get("checkOut") ?? "",
    adults: searchParams.get("adults") ?? "2",
    children: searchParams.get("children") ?? "0",
  };

  const parsed = querySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { checkIn: ciStr, checkOut: coStr, adults, children } = parsed.data;
  const checkIn = parseISO(ciStr);
  const checkOut = parseISO(coStr);

  if (checkOut <= checkIn) {
    return NextResponse.json(
      { error: "checkOut must be after checkIn" },
      { status: 400 }
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (checkIn < today) {
    return NextResponse.json(
      { error: "checkIn cannot be in the past" },
      { status: 400 }
    );
  }

  try {
    const rooms = await getAvailableRoomTypes({ checkIn, checkOut, adults, children });
    const nights = differenceInCalendarDays(checkOut, checkIn);

    return NextResponse.json({ rooms, checkIn: ciStr, checkOut: coStr, nights });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
