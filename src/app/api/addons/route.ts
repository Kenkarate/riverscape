import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const property = await prisma.property.findUnique({
      where: { slug: "riverscape" },
    });

    if (!property) {
      return NextResponse.json({ addons: [] });
    }

    const addons = await prisma.addon.findMany({
      where: { propertyId: property.id, isActive: true },
      select: { id: true, name: true, category: true, price: true, unit: true, gstRate: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ addons });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
