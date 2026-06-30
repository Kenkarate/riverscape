"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/auth-helpers";
import type { Role } from "@prisma/client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SALT_ROUNDS = 12;

export async function createStaffUser(data: {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: "SALES" | "STAFF" | "ADMIN"; // SUPER_ADMIN can't be created via UI
}): Promise<void> {
  const actor = await requireAdmin();

  const name = data.name.trim();
  const email = data.email.trim().toLowerCase();
  const phone = data.phone?.trim() || null;
  const password = data.password;
  const role: Role =
    data.role === "ADMIN" ? "ADMIN" : data.role === "SALES" ? "SALES" : "STAFF";
  // SALES accounts must be approved by an admin before they can access the
  // dashboard. Everyone else is active immediately.
  const status = role === "SALES" ? "PENDING_APPROVAL" : "ACTIVE";

  if (!name) throw new Error("Name is required");
  if (!EMAIL_RE.test(email)) throw new Error("Enter a valid email address");
  if (!password || password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) throw new Error("A user with this email already exists");

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: { name, email, phone, passwordHash, role, status },
    select: { id: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      action: "STAFF_CREATED",
      entityType: "User",
      entityId: user.id,
      after: { name, email, role, status },
    },
  });

  revalidatePath("/admin/staff");
}

export async function updateStaffRole(
  userId: string,
  role: "SALES" | "STAFF" | "ADMIN" | "SUPER_ADMIN"
): Promise<void> {
  const actor = await requireAdmin();

  if (userId === actor.id) {
    throw new Error("You cannot change your own role");
  }

  const allowed: Role[] = ["SALES", "STAFF", "ADMIN", "SUPER_ADMIN"];
  if (!allowed.includes(role)) {
    throw new Error("Invalid role");
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!target) throw new Error("User not found");

  await prisma.user.update({
    where: { id: userId },
    data: { role },
  });

  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      action: "STAFF_ROLE_CHANGED",
      entityType: "User",
      entityId: userId,
      before: { role: target.role },
      after: { role },
    },
  });

  revalidatePath("/admin/staff");
}

export async function deactivateStaffUser(userId: string): Promise<void> {
  const actor = await requireAdmin();

  if (userId === actor.id) {
    throw new Error("You cannot deactivate your own account");
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!target) throw new Error("User not found");

  await prisma.user.update({
    where: { id: userId },
    data: { role: "GUEST" }, // loses all admin access
  });

  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      action: "STAFF_DEACTIVATED",
      entityType: "User",
      entityId: userId,
      before: { role: target.role },
      after: { role: "GUEST" },
    },
  });

  revalidatePath("/admin/staff");
}

// ─── SALES approval flow ──────────────────────────────────────────────────────

/** Approve a pending SALES account — grants dashboard access. */
export async function approveUser(userId: string): Promise<void> {
  const actor = await requireAdmin();

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true, role: true },
  });
  if (!target) throw new Error("User not found");

  await prisma.user.update({
    where: { id: userId },
    data: { status: "ACTIVE" },
  });

  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      action: "USER_APPROVED",
      entityType: "User",
      entityId: userId,
      before: { status: target.status },
      after: { status: "ACTIVE" },
    },
  });

  revalidatePath("/admin/staff");
  revalidatePath("/admin");
}

/** Reject a SALES account — suspends it and blocks login. */
export async function rejectUser(userId: string): Promise<void> {
  const actor = await requireAdmin();

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true, role: true },
  });
  if (!target) throw new Error("User not found");

  await prisma.user.update({
    where: { id: userId },
    data: { status: "SUSPENDED" },
  });

  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      action: "USER_REJECTED",
      entityType: "User",
      entityId: userId,
      before: { status: target.status },
      after: { status: "SUSPENDED" },
    },
  });

  revalidatePath("/admin/staff");
  revalidatePath("/admin");
}

/** Clear a user's locked allocation color so they can pick again (admin only). */
export async function resetUserColor(userId: string): Promise<void> {
  const actor = await requireAdmin();

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, salesColor: true },
  });
  if (!target) throw new Error("User not found");

  await prisma.user.update({
    where: { id: userId },
    data: { salesColor: null, colorLocked: false },
  });

  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      action: "USER_COLOR_RESET",
      entityType: "User",
      entityId: userId,
      before: { salesColor: target.salesColor },
      after: { salesColor: null },
    },
  });

  revalidatePath("/admin/allocation");
  revalidatePath("/admin/staff");
}
