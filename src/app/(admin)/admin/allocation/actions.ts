"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requireAllocationStaff } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";

export async function createSalesAllocation(data: {
  roomTypeId: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  units: number;
  label?: string;
}): Promise<void> {
  await requireAllocationStaff();
  const session = await auth();
  const userId = session?.user?.id;

  const property = await prisma.property.findUniqueOrThrow({ where: { slug: "riverscape" } });

  // Validate checkOut > checkIn
  const ci = new Date(data.checkIn + "T00:00:00");
  const co = new Date(data.checkOut + "T00:00:00");
  if (Number.isNaN(ci.getTime()) || Number.isNaN(co.getTime())) {
    throw new Error("Invalid dates");
  }
  if (co <= ci) throw new Error("Check-out must be after check-in");
  if (data.units < 1) throw new Error("Units must be at least 1");

  await prisma.salesAllocation.create({
    data: {
      propertyId: property.id,
      roomTypeId: data.roomTypeId,
      checkIn: ci,
      checkOut: co,
      units: data.units,
      label: data.label?.trim() || null,
      status: "ACTIVE",
      createdById: userId ?? null,
    },
  });

  revalidatePath("/admin/room-rack");
  revalidatePath("/admin/allocation");
}

export async function releaseSalesAllocation(id: string): Promise<void> {
  await requireAllocationStaff();
  const session = await auth();
  const userId = session?.user?.id;

  const alloc = await prisma.salesAllocation.findUniqueOrThrow({ where: { id } });

  // Only creator or ADMIN can release
  const userRole = (session?.user as { role?: string })?.role;
  if (alloc.createdById !== userId && !["ADMIN", "SUPER_ADMIN"].includes(userRole ?? "")) {
    throw new Error("You can only release your own allocations");
  }

  await prisma.salesAllocation.update({ where: { id }, data: { status: "RELEASED" } });
  revalidatePath("/admin/room-rack");
  revalidatePath("/admin/allocation");
}

export async function updateUserColor(color: string): Promise<void> {
  await requireAllocationStaff();
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not authenticated");

  // Validate hex color format
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new Error("Invalid color");

  // One-time pick: once a color is locked, only an admin reset can change it.
  // (PendingColorSync and the topbar picker also call this, so the guard must
  // live here on the server — hiding the UI alone is not enough.)
  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: { colorLocked: true },
  });
  if (current?.colorLocked) return;

  await prisma.user.update({
    where: { id: userId },
    data: { salesColor: color, colorLocked: true },
  });
  revalidatePath("/admin/room-rack");
  revalidatePath("/admin/allocation");
}
