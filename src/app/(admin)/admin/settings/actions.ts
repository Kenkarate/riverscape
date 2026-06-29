"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-helpers";
import { ADDON_CATEGORY_OPTIONS } from "@/lib/badges";
import type { ActionState } from "@/types";
import type { AddonCategory, DiscountType } from "@prisma/client";

async function getPropertyId(): Promise<string> {
  const property = await prisma.property.findUnique({
    where: { slug: "riverscape" },
    select: { id: true },
  });
  if (!property) throw new Error("Property not found");
  return property.id;
}

function optionalString(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  return s === "" ? null : s;
}

// ─── Addons ───────────────────────────────────────────────────────────────────

export async function createAddon(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireAdmin();

    const name = String(formData.get("name") ?? "").trim();
    if (!name) return { ok: false, message: "Addon name is required." };

    const category = String(formData.get("category") ?? "OTHER") as AddonCategory;
    if (!ADDON_CATEGORY_OPTIONS.includes(category)) {
      return { ok: false, message: "Select a valid category." };
    }

    const priceRupees = Number(formData.get("price") ?? 0);
    if (Number.isNaN(priceRupees) || priceRupees < 0) {
      return { ok: false, message: "Price must be a positive number." };
    }

    const unit = String(formData.get("unit") ?? "").trim() || "per unit";
    const gstRate = Number(formData.get("gstRate") ?? 18);

    const propertyId = await getPropertyId();
    await prisma.addon.create({
      data: {
        propertyId,
        name,
        category,
        price: Math.round(priceRupees * 100),
        unit,
        gstRate,
      },
    });

    revalidatePath("/admin/settings");
    return { ok: true, message: "Addon added." };
  } catch {
    return { ok: false, message: "Could not add addon. Try again." };
  }
}

export async function toggleAddon(id: string, isActive: boolean) {
  await requireAdmin();
  await prisma.addon.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin/settings");
}

// ─── Coupons ──────────────────────────────────────────────────────────────────

export async function createCoupon(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireAdmin();

    const code = String(formData.get("code") ?? "").trim().toUpperCase();
    if (!code) return { ok: false, message: "Coupon code is required." };

    const type = String(formData.get("type") ?? "PERCENT") as DiscountType;

    const rawValue = Number(formData.get("value") ?? 0);
    if (Number.isNaN(rawValue) || rawValue <= 0) {
      return { ok: false, message: "Discount value must be greater than zero." };
    }
    if (type === "PERCENT" && rawValue > 100) {
      return { ok: false, message: "Percentage cannot exceed 100." };
    }
    // PERCENT stores the raw percent integer (15 = 15%); FLAT stores paise.
    const value = type === "PERCENT" ? Math.round(rawValue) : Math.round(rawValue * 100);

    const validFromStr = String(formData.get("validFrom") ?? "");
    const validToStr = String(formData.get("validTo") ?? "");
    if (!validFromStr || !validToStr) {
      return { ok: false, message: "Validity dates are required." };
    }
    const validFrom = new Date(validFromStr);
    const validTo = new Date(validToStr);
    if (Number.isNaN(validFrom.getTime()) || Number.isNaN(validTo.getTime())) {
      return { ok: false, message: "Validity dates are invalid." };
    }
    if (validTo < validFrom) {
      return { ok: false, message: "Valid-to must be on or after valid-from." };
    }

    const usageLimitStr = optionalString(formData.get("usageLimit"));
    const usageLimit = usageLimitStr !== null ? Math.round(Number(usageLimitStr)) : null;

    const minBookingRupees = Number(formData.get("minBookingAmount") ?? 0) || 0;

    const maxDiscountStr = optionalString(formData.get("maxDiscount"));
    const maxDiscount =
      type === "PERCENT" && maxDiscountStr !== null
        ? Math.round(Number(maxDiscountStr) * 100)
        : null;

    const perUserLimit = Math.round(Number(formData.get("perUserLimit") ?? 1)) || 1;

    const existing = await prisma.coupon.findUnique({ where: { code } });
    if (existing) return { ok: false, message: "A coupon with that code already exists." };

    await prisma.coupon.create({
      data: {
        code,
        type,
        value,
        minBookingAmount: Math.round(minBookingRupees * 100),
        maxDiscount,
        validFrom,
        validTo,
        usageLimit,
        perUserLimit,
      },
    });

    revalidatePath("/admin/settings");
    return { ok: true, message: `Coupon ${code} created.` };
  } catch {
    return { ok: false, message: "Could not create coupon. Try again." };
  }
}

export async function toggleCoupon(id: string, isActive: boolean) {
  await requireAdmin();
  await prisma.coupon.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin/settings");
}

// ─── Property ─────────────────────────────────────────────────────────────────

export async function updateProperty(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireAdmin();

    const name = String(formData.get("name") ?? "").trim();
    if (!name) return { ok: false, message: "Property name is required." };

    const address = String(formData.get("address") ?? "").trim();
    if (!address) return { ok: false, message: "Address is required." };

    const checkInTime = String(formData.get("checkInTime") ?? "14:00") || "14:00";
    const checkOutTime = String(formData.get("checkOutTime") ?? "11:00") || "11:00";

    const weekendDays = formData
      .getAll("weekendDays")
      .map((d) => Number(d))
      .filter((n) => !Number.isNaN(n));

    const propertyId = await getPropertyId();
    await prisma.property.update({
      where: { id: propertyId },
      data: {
        name,
        address,
        checkInTime,
        checkOutTime,
        gstin: optionalString(formData.get("gstin")),
        phone: optionalString(formData.get("phone")),
        email: optionalString(formData.get("email")),
        website: optionalString(formData.get("website")),
        weekendDays,
      },
    });

    revalidatePath("/admin/settings");
    return { ok: true, message: "Settings saved." };
  } catch {
    return { ok: false, message: "Could not save settings. Try again." };
  }
}
