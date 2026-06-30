"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireStaff, requireAdmin } from "@/lib/auth-helpers";
import { ensureFolioForBooking } from "@/lib/folio";
import { FOLIO_POS_DEPARTMENT_OPTIONS } from "@/lib/badges";
import type { FolioDepartment, FolioPaymentDirection } from "@prisma/client";

export interface FolioActionResult {
  success: boolean;
  error?: string;
}

function revalidateFolio(bookingId: string) {
  revalidatePath("/admin/billing");
  revalidatePath("/admin/billing/folios");
  revalidatePath(`/admin/billing/folios/${bookingId}`);
}

// ─── Post an ad-hoc POS / outlet charge ───────────────────────────────────────

export interface PostFolioChargeInput {
  bookingId: string;
  department: string; // FolioDepartment (POS subset)
  description: string;
  quantity: number;
  unitPriceRupees: number;
  gstRate: number; // percent (0, 5, 12, 18)
}

/**
 * Posts an ad-hoc charge (spa, restaurant, minibar, …) to a booking's folio.
 * Pricing is computed server-side in integer paise; the folio's cached
 * aggregates are updated in the same transaction. Staff-only.
 */
export async function postFolioCharge(
  input: PostFolioChargeInput
): Promise<FolioActionResult> {
  const user = await requireStaff();

  const department = (FOLIO_POS_DEPARTMENT_OPTIONS as string[]).includes(input.department)
    ? (input.department as FolioDepartment)
    : null;
  if (!department) return { success: false, error: "Select a valid department." };

  const description = input.description?.trim();
  if (!description) return { success: false, error: "Enter a description for the charge." };

  const quantity = Math.round(Number(input.quantity));
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 9999) {
    return { success: false, error: "Enter a valid quantity." };
  }

  const unitPrice = Math.round(Number(input.unitPriceRupees) * 100);
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    return { success: false, error: "Enter a valid amount." };
  }

  const gstRate = [0, 5, 12, 18].includes(Math.round(Number(input.gstRate)))
    ? Math.round(Number(input.gstRate))
    : 0;

  const subtotal = unitPrice * quantity;
  const taxAmount = Math.round((subtotal * gstRate) / 100);
  const total = subtotal + taxAmount;

  let folioId: string;
  try {
    folioId = await ensureFolioForBooking(input.bookingId);
  } catch {
    return { success: false, error: "Could not open the folio for this booking." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const charge = await tx.folioCharge.create({
        data: {
          folioId,
          department,
          source: "POS",
          description,
          quantity,
          unitPrice,
          subtotal,
          gstRate,
          taxAmount,
          total,
          postedById: user.id,
        },
      });

      await tx.folio.update({
        where: { id: folioId },
        data: {
          chargesTotal: { increment: total },
          balance: { increment: total },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "FOLIO_CHARGE_POSTED",
          entityType: "FolioCharge",
          entityId: charge.id,
          after: { folioId, department, description, total },
        },
      });
    });
  } catch {
    return { success: false, error: "Could not post the charge. Please try again." };
  }

  revalidateFolio(input.bookingId);
  return { success: true };
}

// ─── Record a payment / refund against the folio ──────────────────────────────

export interface RecordFolioPaymentInput {
  bookingId: string;
  amountRupees: number;
  method: string;
  reference?: string | null;
  direction?: string; // FolioPaymentDirection — defaults to PAYMENT
}

/**
 * Records a payment (or refund) against a booking's folio — settles ad-hoc POS
 * charges. Distinct from the booking's own payment stream, so it never disturbs
 * Booking.paidAmount / balanceDue. Staff-only.
 */
export async function recordFolioPayment(
  input: RecordFolioPaymentInput
): Promise<FolioActionResult> {
  const user = await requireStaff();

  const direction: FolioPaymentDirection =
    input.direction === "REFUND" ? "REFUND" : "PAYMENT";

  const method = input.method?.trim();
  if (!method) return { success: false, error: "Select a payment method." };

  const amount = Math.round(Number(input.amountRupees) * 100);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: "Enter a valid amount." };
  }

  const reference = input.reference?.trim() || null;

  let folioId: string;
  try {
    folioId = await ensureFolioForBooking(input.bookingId);
  } catch {
    return { success: false, error: "Could not open the folio for this booking." };
  }

  // PAYMENT reduces the balance; REFUND increases it.
  const signed = direction === "REFUND" ? -amount : amount;

  try {
    await prisma.$transaction(async (tx) => {
      const payment = await tx.folioPayment.create({
        data: {
          folioId,
          direction,
          amount,
          method,
          reference,
          recordedById: user.id,
        },
      });

      await tx.folio.update({
        where: { id: folioId },
        data: {
          paymentsTotal: { increment: signed },
          balance: { decrement: signed },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: direction === "REFUND" ? "FOLIO_REFUND_RECORDED" : "FOLIO_PAYMENT_RECORDED",
          entityType: "FolioPayment",
          entityId: payment.id,
          after: { folioId, direction, amount, method },
        },
      });
    });
  } catch {
    return { success: false, error: "Could not record the payment. Please try again." };
  }

  revalidateFolio(input.bookingId);
  return { success: true };
}

// ─── Void a posted charge (corrections) ───────────────────────────────────────

/**
 * Voids a posted POS charge and reverses it out of the folio aggregates.
 * Admin-only — POS corrections are a sensitive operation. Idempotent.
 */
export async function voidFolioCharge(chargeId: string): Promise<FolioActionResult> {
  const user = await requireAdmin();

  const charge = await prisma.folioCharge.findUnique({
    where: { id: chargeId },
    select: {
      id: true,
      total: true,
      voided: true,
      source: true,
      folio: { select: { id: true, bookingId: true } },
    },
  });
  if (!charge) return { success: false, error: "Charge not found." };
  if (charge.voided) return { success: true }; // idempotent
  if (charge.source !== "POS") {
    return { success: false, error: "Only ad-hoc POS charges can be voided here." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.folioCharge.update({
        where: { id: chargeId },
        data: { voided: true },
      });
      await tx.folio.update({
        where: { id: charge.folio.id },
        data: {
          chargesTotal: { decrement: charge.total },
          balance: { decrement: charge.total },
        },
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "FOLIO_CHARGE_VOIDED",
          entityType: "FolioCharge",
          entityId: chargeId,
          before: { total: charge.total },
        },
      });
    });
  } catch {
    return { success: false, error: "Could not void the charge. Please try again." };
  }

  if (charge.folio.bookingId) revalidateFolio(charge.folio.bookingId);
  return { success: true };
}
