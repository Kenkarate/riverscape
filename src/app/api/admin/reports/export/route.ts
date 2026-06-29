import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function parseDate(str: string | null, fallback: Date): Date {
  if (!str) return fallback;
  const d = new Date(str);
  return isNaN(d.getTime()) ? fallback : d;
}

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

function rupees(paise: number): string {
  return (paise / 100).toFixed(2);
}

function nightsBetween(checkIn: Date, checkOut: Date): number {
  const ms = checkOut.getTime() - checkIn.getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

// RFC-4180 style escaping: wrap in quotes, double any embedded quotes.
function csvCell(value: string | number): string {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(cells: (string | number)[]): string {
  return cells.map(csvCell).join(",");
}

export async function GET(req: NextRequest) {
  // Staff-or-above only.
  try {
    await requireStaff();
  } catch {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const today = new Date();
  const url = new URL(req.url);
  const from = parseDate(url.searchParams.get("from"), startOfMonth(today));
  const to = parseDate(url.searchParams.get("to"), endOfMonth(today));

  const toEnd = new Date(to);
  toEnd.setHours(23, 59, 59, 999);

  const bookings = await prisma.booking.findMany({
    where: { checkIn: { gte: from, lte: toEnd } },
    include: {
      guest: { select: { name: true, phone: true, email: true } },
      rooms: { include: { roomType: { select: { name: true } } } },
    },
    orderBy: { checkIn: "asc" },
  });

  const header = [
    "Booking Ref",
    "Guest Name",
    "Phone",
    "Email",
    "Room Type",
    "Check-in",
    "Check-out",
    "Nights",
    "Source",
    "Status",
    "Total",
    "Paid",
    "Balance",
    "Created At",
  ];

  const lines = [csvRow(header)];

  for (const b of bookings) {
    const roomTypes = [...new Set(b.rooms.map((r) => r.roomType.name))].join("; ");
    lines.push(
      csvRow([
        b.bookingRef,
        b.guest.name,
        b.guest.phone ?? "",
        b.guest.email ?? "",
        roomTypes,
        toISO(b.checkIn),
        toISO(b.checkOut),
        nightsBetween(b.checkIn, b.checkOut),
        b.source,
        b.status,
        rupees(b.totalAmount),
        rupees(b.paidAmount),
        rupees(b.balanceDue),
        b.createdAt.toISOString(),
      ])
    );
  }

  // Prepend a BOM so Excel reads UTF-8 correctly.
  const csv = "﻿" + lines.join("\r\n") + "\r\n";

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="riverscape-report-${toISO(from)}-${toISO(to)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
