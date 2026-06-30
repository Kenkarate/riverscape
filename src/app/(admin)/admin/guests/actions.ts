"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireStaff, requireAdmin } from "@/lib/auth-helpers";
import type { Prisma } from "@prisma/client";

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface UpdateGuestInput {
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  idType?: string | null;
  idNumber?: string | null;
  country?: string | null;
}

export interface GuestActionResult {
  success: boolean;
  error?: string;
}

const PHONE_RE = /^[6-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Normalises an optional free-text field to a trimmed string or null. */
function cleanOptional(value?: string | null): string | null {
  const v = value?.trim();
  return v ? v : null;
}

// ─── Update guest ─────────────────────────────────────────────────────────────

/**
 * Updates a guest's profile. Staff-level. Validates the name (non-empty) and the
 * phone (10-digit Indian mobile), normalises optional fields, and records an audit
 * row with before/after snapshots. Returns a structured result for inline errors.
 */
export async function updateGuest(
  guestId: string,
  data: UpdateGuestInput
): Promise<GuestActionResult> {
  const user = await requireStaff();

  const name = data.name?.trim();
  if (!name) return { success: false, error: "Guest name is required." };

  const phone = (data.phone ?? "").replace(/\D/g, "");
  if (!PHONE_RE.test(phone)) {
    return { success: false, error: "Enter a valid 10-digit Indian mobile number." };
  }

  const email = cleanOptional(data.email);
  if (email && !EMAIL_RE.test(email)) {
    return { success: false, error: "Enter a valid email address." };
  }

  const address = cleanOptional(data.address);
  const idType = cleanOptional(data.idType);
  const idNumber = cleanOptional(data.idNumber);
  const country = cleanOptional(data.country);

  const existing = await prisma.guest.findUnique({
    where: { id: guestId },
    select: {
      name: true,
      phone: true,
      email: true,
      address: true,
      idType: true,
      idNumber: true,
      country: true,
    },
  });
  if (!existing) return { success: false, error: "Guest not found." };

  try {
    await prisma.$transaction([
      prisma.guest.update({
        where: { id: guestId },
        data: { name, phone, email, address, idType, idNumber, country },
      }),
      prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "GUEST_UPDATED",
          entityType: "Guest",
          entityId: guestId,
          before: existing as Prisma.InputJsonValue,
          after: { name, phone, email, address, idType, idNumber, country },
        },
      }),
    ]);
  } catch {
    return { success: false, error: "Could not update the guest. Please try again." };
  }

  revalidatePath("/admin/guests");
  revalidatePath(`/admin/guests/${guestId}`);
  return { success: true };
}

// ─── Delete guest ─────────────────────────────────────────────────────────────

/**
 * Deletes a guest. Admin-only. Refuses if the guest has any active
 * (CONFIRMED / CHECKED_IN) bookings. Because Booking.guest is a restricted
 * relation, a guest with *any* historical booking also cannot be deleted — that
 * foreign-key error is caught and surfaced as a friendly message.
 */
export async function deleteGuest(guestId: string): Promise<GuestActionResult> {
  const user = await requireAdmin();

  const guest = await prisma.guest.findUnique({
    where: { id: guestId },
    select: { id: true, name: true },
  });
  if (!guest) return { success: false, error: "Guest not found." };

  const activeBookings = await prisma.booking.count({
    where: { guestId, status: { in: ["CONFIRMED", "CHECKED_IN"] } },
  });
  if (activeBookings > 0) {
    return {
      success: false,
      error: "This guest has active bookings and cannot be deleted.",
    };
  }

  try {
    await prisma.$transaction([
      prisma.guest.delete({ where: { id: guestId } }),
      prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "GUEST_DELETED",
          entityType: "Guest",
          entityId: guestId,
          before: { name: guest.name },
        },
      }),
    ]);
  } catch {
    // Restricted FK: the guest still has booking history attached.
    return {
      success: false,
      error: "This guest has booking history and cannot be deleted.",
    };
  }

  revalidatePath("/admin/guests");
  return { success: true };
}
