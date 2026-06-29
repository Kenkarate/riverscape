"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { HousekeepingStatus } from "@prisma/client";
import { requireStaff, requireAdmin } from "@/lib/auth-helpers";

// Prisma throws PrismaClientKnownRequestError with code "P2002" on a unique
// constraint violation. Detect it structurally so we can surface a friendly
// message without importing the Prisma error class.
function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function getPropertyId(): Promise<string> {
  const property = await prisma.property.findUnique({
    where: { slug: "riverscape" },
    select: { id: true },
  });
  if (!property) throw new Error("Property not found");
  return property.id;
}

export async function updateHousekeepingStatus(
  roomId: string,
  status: HousekeepingStatus
) {
  await requireStaff();

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { housekeeping: true },
  });
  if (!room) throw new Error("Room not found");

  await prisma.$transaction([
    prisma.room.update({
      where: { id: roomId },
      data: { housekeeping: status },
    }),
    prisma.housekeepingLog.create({
      data: {
        roomId,
        status,
        previousStatus: room.housekeeping,
      },
    }),
  ]);

  revalidatePath("/admin/rooms");
  revalidatePath("/admin/housekeeping");
}

// ─── Maintenance blocks ───────────────────────────────────────────────────────

export async function createMaintenanceBlock(
  roomId: string,
  reason: string,
  startDate: string, // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
): Promise<void> {
  const user = await requireStaff();

  const trimmedReason = reason.trim();
  if (!trimmedReason) throw new Error("A reason is required");
  if (!startDate || !endDate) throw new Error("Start and end dates are required");

  // @db.Date columns — anchor to local midnight so the calendar date is preserved.
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("Invalid dates");
  }
  if (end < start) throw new Error("End date must be on or after the start date");

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { id: true },
  });
  if (!room) throw new Error("Room not found");

  await prisma.$transaction([
    prisma.maintenanceBlock.create({
      data: {
        roomId,
        reason: trimmedReason,
        startDate: start,
        endDate: end,
        status: "ACTIVE",
        createdById: user.id,
      },
    }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "MAINTENANCE_BLOCK_CREATED",
        entityType: "Room",
        entityId: roomId,
      },
    }),
  ]);

  revalidatePath("/admin/rooms");
}

export async function resolveMaintenanceBlock(blockId: string): Promise<void> {
  const user = await requireStaff();

  const block = await prisma.maintenanceBlock.findUnique({
    where: { id: blockId },
    select: { id: true },
  });
  if (!block) throw new Error("Maintenance block not found");

  await prisma.$transaction([
    prisma.maintenanceBlock.update({
      where: { id: blockId },
      data: { status: "CANCELLED" },
    }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "MAINTENANCE_BLOCK_RESOLVED",
        entityType: "MaintenanceBlock",
        entityId: blockId,
      },
    }),
  ]);

  revalidatePath("/admin/rooms");
}

// ─── Rooms (physical) ─────────────────────────────────────────────────────────

export async function createRoom(data: {
  number: string;
  floor?: string;
  notes?: string;
  roomTypeId: string;
}): Promise<void> {
  const user = await requireAdmin();

  const number = data.number.trim();
  if (!number) throw new Error("Room number is required");
  if (!data.roomTypeId) throw new Error("Select a room type");

  const propertyId = await getPropertyId();

  try {
    const room = await prisma.room.create({
      data: {
        propertyId,
        roomTypeId: data.roomTypeId,
        number,
        floor: data.floor?.trim() || null,
        notes: data.notes?.trim() || null,
        housekeeping: "CLEAN",
        isActive: true,
      },
      select: { id: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "ROOM_CREATED",
        entityType: "Room",
        entityId: room.id,
        after: { number, floor: data.floor ?? null, roomTypeId: data.roomTypeId },
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new Error("Room number already exists");
    }
    throw error;
  }

  revalidatePath("/admin/rooms");
}

export async function updateRoom(
  id: string,
  data: { number: string; floor?: string; notes?: string; roomTypeId: string }
): Promise<void> {
  const user = await requireAdmin();

  const number = data.number.trim();
  if (!number) throw new Error("Room number is required");
  if (!data.roomTypeId) throw new Error("Select a room type");

  const existing = await prisma.room.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) throw new Error("Room not found");

  try {
    await prisma.room.update({
      where: { id },
      data: {
        number,
        floor: data.floor?.trim() || null,
        notes: data.notes?.trim() || null,
        roomTypeId: data.roomTypeId,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "ROOM_UPDATED",
        entityType: "Room",
        entityId: id,
        after: { number, floor: data.floor ?? null, roomTypeId: data.roomTypeId },
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new Error("Room number already exists");
    }
    throw error;
  }

  revalidatePath("/admin/rooms");
}

export async function deactivateRoom(id: string): Promise<void> {
  const user = await requireAdmin();

  await prisma.$transaction([
    prisma.room.update({ where: { id }, data: { isActive: false } }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "ROOM_DEACTIVATED",
        entityType: "Room",
        entityId: id,
      },
    }),
  ]);

  revalidatePath("/admin/rooms");
}

export async function reactivateRoom(id: string): Promise<void> {
  const user = await requireAdmin();

  await prisma.$transaction([
    prisma.room.update({ where: { id }, data: { isActive: true } }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "ROOM_REACTIVATED",
        entityType: "Room",
        entityId: id,
      },
    }),
  ]);

  revalidatePath("/admin/rooms");
}

// ─── Room Types (logical) ─────────────────────────────────────────────────────

interface RoomTypeInput {
  name: string;
  slug: string;
  description: string;
  basePrice: number; // rupees
  baseOccupancy: number;
  maxAdults: number;
  maxChildren: number;
  extraBedAllowed: boolean;
  maxExtraBeds: number;
}

function validateRoomTypeInput(data: RoomTypeInput) {
  const name = data.name.trim();
  if (!name) throw new Error("Room type name is required");

  const slug = data.slug.trim() ? slugify(data.slug) : slugify(name);
  if (!slug) throw new Error("A valid slug is required");

  const description = data.description.trim();
  if (!description) throw new Error("Description is required");

  if (!Number.isFinite(data.basePrice) || data.basePrice < 0) {
    throw new Error("Base price must be a positive number");
  }
  const basePrice = Math.round(data.basePrice * 100);

  const baseOccupancy = Math.round(data.baseOccupancy);
  const maxAdults = Math.round(data.maxAdults);
  const maxChildren = Math.round(data.maxChildren);
  const maxExtraBeds = Math.round(data.maxExtraBeds);
  if (baseOccupancy < 1) throw new Error("Base occupancy must be at least 1");
  if (maxAdults < 1) throw new Error("Max adults must be at least 1");
  if (maxChildren < 0) throw new Error("Max children cannot be negative");
  if (maxExtraBeds < 0) throw new Error("Max extra beds cannot be negative");

  return {
    name,
    slug,
    description,
    basePrice,
    baseOccupancy,
    maxAdults,
    maxChildren,
    extraBedAllowed: data.extraBedAllowed,
    maxExtraBeds: data.extraBedAllowed ? maxExtraBeds : 0,
  };
}

export async function createRoomType(data: RoomTypeInput): Promise<void> {
  const user = await requireAdmin();
  const values = validateRoomTypeInput(data);
  const propertyId = await getPropertyId();

  try {
    const roomType = await prisma.roomType.create({
      data: { propertyId, ...values, isActive: true },
      select: { id: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "ROOM_TYPE_CREATED",
        entityType: "RoomType",
        entityId: roomType.id,
        after: { name: values.name, slug: values.slug, basePrice: values.basePrice },
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new Error("Slug already taken");
    }
    throw error;
  }

  revalidatePath("/admin/rooms");
}

export async function updateRoomType(
  id: string,
  data: RoomTypeInput
): Promise<void> {
  const user = await requireAdmin();
  const values = validateRoomTypeInput(data);

  const existing = await prisma.roomType.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) throw new Error("Room type not found");

  try {
    await prisma.roomType.update({
      where: { id },
      data: {
        name: values.name,
        slug: values.slug,
        description: values.description,
        basePrice: values.basePrice,
        baseOccupancy: values.baseOccupancy,
        maxAdults: values.maxAdults,
        maxChildren: values.maxChildren,
        extraBedAllowed: values.extraBedAllowed,
        maxExtraBeds: values.maxExtraBeds,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "ROOM_TYPE_UPDATED",
        entityType: "RoomType",
        entityId: id,
        after: { name: values.name, slug: values.slug, basePrice: values.basePrice },
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new Error("Slug already taken");
    }
    throw error;
  }

  revalidatePath("/admin/rooms");
}

export async function deactivateRoomType(id: string): Promise<void> {
  const user = await requireAdmin();

  await prisma.$transaction([
    prisma.roomType.update({ where: { id }, data: { isActive: false } }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "ROOM_TYPE_DEACTIVATED",
        entityType: "RoomType",
        entityId: id,
      },
    }),
  ]);

  revalidatePath("/admin/rooms");
}

export async function reactivateRoomType(id: string): Promise<void> {
  const user = await requireAdmin();

  await prisma.$transaction([
    prisma.roomType.update({ where: { id }, data: { isActive: true } }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "ROOM_TYPE_REACTIVATED",
        entityType: "RoomType",
        entityId: id,
      },
    }),
  ]);

  revalidatePath("/admin/rooms");
}
