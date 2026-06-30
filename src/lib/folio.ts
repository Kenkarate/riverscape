import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Folio helpers. A Folio is the running tab for a stay — 1:1 with a Booking by
 * default. Room/add-on charges and their payments stay authoritative on the
 * Booking; the Folio layers in ad-hoc POS/outlet charges and the payments that
 * settle them. All amounts are integer paise.
 *
 * Reconciliation model (Phase 1):
 *   grandCharges = booking.totalAmount + folio.chargesTotal   (POS lines)
 *   grandPaid    = booking.paidAmount  + folio.paymentsTotal  (folio payments)
 *   grandBalance = grandCharges − grandPaid
 *                = booking.balanceDue  + folio.balance
 */

type Tx = Prisma.TransactionClient;

/**
 * Creates a folio for a booking inside an existing transaction. Idempotent —
 * returns the existing folio id if one already exists. Reserves the next
 * sequential folio number atomically (mirrors the invoice-number pattern).
 */
export async function createFolioForBooking(
  tx: Tx,
  args: {
    bookingId: string;
    propertyId: string;
    guestId: string | null;
    createdById?: string | null;
  }
): Promise<string> {
  const existing = await tx.folio.findUnique({
    where: { bookingId: args.bookingId },
    select: { id: true },
  });
  if (existing) return existing.id;

  const property = await tx.property.update({
    where: { id: args.propertyId },
    data: { folioSeq: { increment: 1 } },
    select: { folioSeq: true },
  });

  const year = new Date().getFullYear();
  const folioNumber = `F-${year}-${String(property.folioSeq).padStart(4, "0")}`;

  const folio = await tx.folio.create({
    data: {
      folioNumber,
      bookingId: args.bookingId,
      propertyId: args.propertyId,
      guestId: args.guestId ?? undefined,
      createdById: args.createdById ?? undefined,
    },
    select: { id: true },
  });

  return folio.id;
}

/**
 * Returns the folio id for a booking, creating it lazily if it doesn't exist.
 * Used to back-fill folios for bookings created before this feature shipped, or
 * via flows that don't yet auto-create one. Idempotent.
 */
export async function ensureFolioForBooking(bookingId: string): Promise<string> {
  const existing = await prisma.folio.findUnique({
    where: { bookingId },
    select: { id: true },
  });
  if (existing) return existing.id;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, propertyId: true, guestId: true, createdById: true },
  });
  if (!booking) throw new Error("Booking not found");

  return prisma.$transaction((tx) =>
    createFolioForBooking(tx, {
      bookingId: booking.id,
      propertyId: booking.propertyId,
      guestId: booking.guestId,
      createdById: booking.createdById,
    })
  );
}

export interface FolioTotals {
  bookingCharges: number; // booking.totalAmount (room + add-ons + GST − discount)
  bookingPaid: number; // booking.paidAmount
  bookingBalance: number; // booking.balanceDue
  posCharges: number; // folio.chargesTotal
  posPayments: number; // folio.paymentsTotal
  posBalance: number; // folio.balance
  grandCharges: number;
  grandPaid: number;
  grandBalance: number;
}

/**
 * Combines a booking's authoritative financials with the folio's POS-specific
 * aggregates into the unified totals shown on the folio screen.
 */
export function folioTotals(
  booking: { totalAmount: number; paidAmount: number; balanceDue: number } | null,
  folio: { chargesTotal: number; paymentsTotal: number; balance: number }
): FolioTotals {
  const bookingCharges = booking?.totalAmount ?? 0;
  const bookingPaid = booking?.paidAmount ?? 0;
  const bookingBalance = booking?.balanceDue ?? 0;

  return {
    bookingCharges,
    bookingPaid,
    bookingBalance,
    posCharges: folio.chargesTotal,
    posPayments: folio.paymentsTotal,
    posBalance: folio.balance,
    grandCharges: bookingCharges + folio.chargesTotal,
    grandPaid: bookingPaid + folio.paymentsTotal,
    grandBalance: bookingBalance + folio.balance,
  };
}
