"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-helpers";
import { channelTypeLabel, CHANNEL_TYPE_OPTIONS } from "@/lib/badges";
import type { ActionState } from "@/types";
import type { ChannelType, DiscountType } from "@prisma/client";

async function getPropertyId(): Promise<string> {
  const property = await prisma.property.findUnique({
    where: { slug: "riverscape" },
    select: { id: true },
  });
  if (!property) throw new Error("Property not found");
  return property.id;
}

export async function createChannel(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireAdmin();

    const type = String(formData.get("type") ?? "") as ChannelType;
    if (!CHANNEL_TYPE_OPTIONS.includes(type)) {
      return { ok: false, message: "Select a valid channel." };
    }

    const name = String(formData.get("name") ?? "").trim() || channelTypeLabel[type];
    const markupType = String(formData.get("markupType") ?? "PERCENT") as DiscountType;

    const rawMarkup = Number(formData.get("markupValue") ?? 0);
    if (Number.isNaN(rawMarkup) || rawMarkup < 0) {
      return { ok: false, message: "Markup must be a positive number." };
    }
    // Schema stores basis points for PERCENT (15% -> 1500) and paise for FLAT
    // (₹500 -> 50000). Both inputs are scaled by 100 on the way in.
    const markupValue = Math.round(rawMarkup * 100);

    const propertyId = await getPropertyId();

    await prisma.channel.upsert({
      where: { propertyId_type: { propertyId, type } },
      create: { propertyId, type, name, markupType, markupValue, isActive: true },
      update: { name, markupType, markupValue },
    });

    revalidatePath("/admin/channels");
    return { ok: true, message: `${channelTypeLabel[type]} saved.` };
  } catch {
    return { ok: false, message: "Could not save channel. Try again." };
  }
}

export async function toggleChannel(channelId: string, isActive: boolean) {
  await requireAdmin();
  await prisma.channel.update({
    where: { id: channelId },
    data: { isActive },
  });
  revalidatePath("/admin/channels");
}
