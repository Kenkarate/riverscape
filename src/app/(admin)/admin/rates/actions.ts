"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-helpers";
import type { ActionState } from "@/types";
import type { RateOverrideType, MealPlan } from "@prisma/client";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const OVERRIDE_TYPES: RateOverrideType[] = ["DATE_RANGE", "WEEKEND", "SEASONAL"];

export async function upsertRateOverride(
  ratePlanId: string,
  date: string,
  priceRupees: number,
  type: string,
  stopSell: boolean,
  closedToArrival: boolean,
  closedToDeparture: boolean
): Promise<ActionState> {
  try {
    await requireAdmin();

    if (!ratePlanId) return { ok: false, message: "Missing rate plan." };
    if (!DATE_RE.test(date)) return { ok: false, message: "Select a valid date." };

    const price = Math.round(Number(priceRupees) * 100);
    if (Number.isNaN(price) || price < 0) {
      return { ok: false, message: "Enter a valid price." };
    }

    const overrideType: RateOverrideType = OVERRIDE_TYPES.includes(type as RateOverrideType)
      ? (type as RateOverrideType)
      : "DATE_RANGE";

    const ratePlan = await prisma.ratePlan.findUnique({
      where: { id: ratePlanId },
      select: { id: true },
    });
    if (!ratePlan) return { ok: false, message: "Rate plan not found." };

    const dateValue = new Date(date);

    await prisma.ratePlanDate.upsert({
      where: { ratePlanId_date: { ratePlanId, date: dateValue } },
      create: {
        ratePlanId,
        date: dateValue,
        price,
        type: overrideType,
        stopSell,
        closedToArrival,
        closedToDeparture,
      },
      update: {
        price,
        type: overrideType,
        stopSell,
        closedToArrival,
        closedToDeparture,
      },
    });

    revalidatePath("/admin/rates");
    return { ok: true, message: "Override saved." };
  } catch {
    return { ok: false, message: "Could not save override. Try again." };
  }
}

export async function deleteRateOverride(ratePlanId: string, date: string) {
  await requireAdmin();
  if (!ratePlanId || !DATE_RE.test(date)) return;

  await prisma.ratePlanDate.delete({
    where: { ratePlanId_date: { ratePlanId, date: new Date(date) } },
  });

  revalidatePath("/admin/rates");
}

// ─── Rate Plan CRUD ───────────────────────────────────────────────────────────

const MEAL_PLANS: MealPlan[] = ["ROOM_ONLY", "BREAKFAST", "HALF_BOARD", "FULL_BOARD"];

interface RatePlanInput {
  name: string;
  roomTypeId?: string; // empty string = null (applies to all room types)
  mealPlan: MealPlan;
  basePriceRupees: number;
  extraAdultRupees: number;
  extraChildWithBedRupees: number;
  extraChildNoBedRupees: number;
  minStay: number;
  maxStay?: number;
}

async function getPropertyId(): Promise<string> {
  const property = await prisma.property.findUnique({
    where: { slug: "riverscape" },
    select: { id: true },
  });
  if (!property) throw new Error("Property not found");
  return property.id;
}

function toPaise(rupees: number, label: string): number {
  const paise = Math.round(Number(rupees) * 100);
  if (!Number.isFinite(paise) || paise < 0) {
    throw new Error(`Enter a valid ${label}`);
  }
  return paise;
}

function buildRatePlanData(data: RatePlanInput) {
  const name = data.name.trim();
  if (!name) throw new Error("Rate plan name is required");

  const mealPlan: MealPlan = MEAL_PLANS.includes(data.mealPlan)
    ? data.mealPlan
    : "ROOM_ONLY";

  const basePrice = toPaise(data.basePriceRupees, "base price");
  const extraAdultPrice = toPaise(data.extraAdultRupees, "extra adult price");
  const extraChildWithBed = toPaise(data.extraChildWithBedRupees, "extra child (with bed) price");
  const extraChildNoBed = toPaise(data.extraChildNoBedRupees, "extra child (no bed) price");

  const minStay = Math.max(1, Math.round(Number(data.minStay) || 1));

  let maxStay: number | null = null;
  if (data.maxStay !== undefined && data.maxStay !== null && `${data.maxStay}`.trim() !== "") {
    const m = Math.round(Number(data.maxStay));
    if (Number.isFinite(m) && m > 0) {
      if (m < minStay) throw new Error("Max stay must be greater than or equal to min stay");
      maxStay = m;
    }
  }

  const roomTypeId =
    data.roomTypeId && data.roomTypeId.trim() ? data.roomTypeId.trim() : null;

  return {
    name,
    roomTypeId,
    mealPlan,
    basePrice,
    extraAdultPrice,
    extraChildWithBed,
    extraChildNoBed,
    minStay,
    maxStay,
  };
}

export async function createRatePlan(data: RatePlanInput): Promise<void> {
  const user = await requireAdmin();
  const values = buildRatePlanData(data);
  const propertyId = await getPropertyId();

  const plan = await prisma.ratePlan.create({
    data: { propertyId, ...values, isActive: true },
    select: { id: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "RATE_PLAN_CREATED",
      entityType: "RatePlan",
      entityId: plan.id,
      after: {
        name: values.name,
        roomTypeId: values.roomTypeId,
        mealPlan: values.mealPlan,
        basePrice: values.basePrice,
      },
    },
  });

  revalidatePath("/admin/rates");
}

export async function updateRatePlan(id: string, data: RatePlanInput): Promise<void> {
  const user = await requireAdmin();
  const values = buildRatePlanData(data);

  const existing = await prisma.ratePlan.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) throw new Error("Rate plan not found");

  await prisma.ratePlan.update({
    where: { id },
    data: { ...values },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "RATE_PLAN_UPDATED",
      entityType: "RatePlan",
      entityId: id,
      after: {
        name: values.name,
        roomTypeId: values.roomTypeId,
        mealPlan: values.mealPlan,
        basePrice: values.basePrice,
      },
    },
  });

  revalidatePath("/admin/rates");
}

export async function deactivateRatePlan(id: string): Promise<void> {
  const user = await requireAdmin();

  await prisma.$transaction([
    prisma.ratePlan.update({ where: { id }, data: { isActive: false } }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "RATE_PLAN_DEACTIVATED",
        entityType: "RatePlan",
        entityId: id,
      },
    }),
  ]);

  revalidatePath("/admin/rates");
}

export async function reactivateRatePlan(id: string): Promise<void> {
  const user = await requireAdmin();

  await prisma.$transaction([
    prisma.ratePlan.update({ where: { id }, data: { isActive: true } }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "RATE_PLAN_REACTIVATED",
        entityType: "RatePlan",
        entityId: id,
      },
    }),
  ]);

  revalidatePath("/admin/rates");
}
