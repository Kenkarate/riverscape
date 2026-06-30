import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertCircle, ExternalLink } from "lucide-react";
import { formatINR } from "@/lib/pricing";
import { ensureFolioForBooking, folioTotals } from "@/lib/folio";
import {
  bookingStatusBadge,
  folioStatusBadge,
  folioDepartmentBadge,
} from "@/lib/badges";
import BillingNav from "@/components/admin/billing-nav";
import PostChargePanel from "@/components/admin/post-charge-panel";
import RecordFolioPaymentForm from "@/components/admin/record-folio-payment-form";
import VoidFolioChargeButton from "@/components/admin/void-folio-charge-button";

export const dynamic = "force-dynamic";

function formatDate(d: Date) {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(d: Date) {
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function loadFolio(folioId: string) {
  return prisma.folio.findUnique({
    where: { id: folioId },
    include: {
      booking: {
        include: {
          guest: true,
          rooms: { include: { roomType: { select: { name: true } }, room: { select: { number: true } } } },
          addons: { include: { addon: { select: { name: true, unit: true } } } },
        },
      },
      charges: { where: { voided: false }, orderBy: { createdAt: "desc" } },
      payments: { orderBy: { createdAt: "desc" } },
    },
  });
}

export default async function FolioDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // The route param is the bookingId. Folios are 1:1 with a booking and lazily
  // created on first view, so back-fill it here before loading.
  const { id: bookingId } = await params;

  let folio: Awaited<ReturnType<typeof loadFolio>> = null;
  let dbError = false;
  let notFoundError = false;

  try {
    const folioId = await ensureFolioForBooking(bookingId);
    folio = await loadFolio(folioId);
  } catch (err) {
    if (err instanceof Error && err.message === "Booking not found") {
      notFoundError = true;
    } else {
      dbError = true;
    }
  }

  if (notFoundError) notFound();

  if (dbError || !folio) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-gray-900">Folio</h1>
        <BillingNav />
        <div className="flex items-center justify-center h-64">
          <div className="text-center text-gray-500">
            <AlertCircle className="mx-auto mb-2 text-amber-500" size={32} />
            <p className="font-medium">Billing tables not found</p>
            <p className="text-sm mt-1">Run the billing_folios migration, then reload.</p>
          </div>
        </div>
      </div>
    );
  }

  const booking = folio.booking;
  const session = await auth();
  const role = (session?.user as { role?: string })?.role ?? null;
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";

  const totals = folioTotals(booking, folio);
  const statusB = folioStatusBadge[folio.status];
  const bookingStatusB = booking ? bookingStatusBadge[booking.status] : null;
  const canPost = folio.status === "OPEN";

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <Link
          href="/admin/billing/folios"
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mb-3"
        >
          <ArrowLeft size={14} /> Back to folios
        </Link>
        <BillingNav />
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold text-gray-900 font-mono">{folio.folioNumber}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusB.className}`}>
              {statusB.label}
            </span>
            {bookingStatusB && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${bookingStatusB.className}`}>
                {bookingStatusB.label}
              </span>
            )}
          </div>
          {booking && (
            <p className="text-xs text-gray-400 mt-1">
              {booking.guest.name} · {booking.guest.phone}
            </p>
          )}
        </div>
        {canPost && <PostChargePanel bookingId={bookingId} />}
      </div>

      {/* Booking summary (authoritative — read-only here) */}
      {booking && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-medium text-gray-900 text-sm">Stay & Booking Charges</h2>
            <Link
              href={`/admin/bookings/${booking.bookingRef}`}
              className="inline-flex items-center gap-1.5 text-xs text-[#1a3a2a] hover:underline font-medium"
            >
              <span className="font-mono">{booking.bookingRef}</span>
              <ExternalLink size={12} />
            </Link>
          </div>
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">
                {booking.rooms.map((r) => r.room?.number ?? r.roomType.name).join(", ")}
              </span>
              <span className="text-gray-600 text-xs">
                {formatDate(booking.checkIn)} – {formatDate(booking.checkOut)}
              </span>
            </div>
            <div className="text-sm space-y-1.5">
              <div className="flex justify-between">
                <span className="text-gray-500">Room subtotal</span>
                <span className="text-gray-700">{formatINR(booking.roomSubtotal)}</span>
              </div>
              {booking.addonSubtotal > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Add-ons subtotal</span>
                  <span className="text-gray-700">{formatINR(booking.addonSubtotal)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">GST</span>
                <span className="text-gray-700">{formatINR(booking.taxAmount)}</span>
              </div>
              {booking.discountAmount > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>Discount</span>
                  <span>−{formatINR(booking.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between font-medium text-gray-900 border-t border-gray-100 pt-1.5">
                <span>Booking total</span>
                <span>{formatINR(booking.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-green-700">
                <span>Paid (booking)</span>
                <span>{formatINR(booking.paidAmount)}</span>
              </div>
              {booking.balanceDue > 0 && (
                <div className="flex justify-between text-amber-600 font-medium">
                  <span>Booking balance</span>
                  <span>{formatINR(booking.balanceDue)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* POS / outlet charges */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-medium text-gray-900 text-sm">Outlet Charges ({folio.charges.length})</h2>
          {canPost && <PostChargePanel bookingId={bookingId} />}
        </div>
        {folio.charges.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">
            No outlet charges posted yet. Use “Post Charge” to add spa, restaurant, minibar and other charges.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-2.5 text-left font-medium text-gray-500 text-xs">Department</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-500 text-xs">Description</th>
                  <th className="px-4 py-2.5 text-right font-medium text-gray-500 text-xs">Qty</th>
                  <th className="px-4 py-2.5 text-right font-medium text-gray-500 text-xs">Unit</th>
                  <th className="px-4 py-2.5 text-right font-medium text-gray-500 text-xs">GST</th>
                  <th className="px-4 py-2.5 text-right font-medium text-gray-500 text-xs">Total</th>
                  {isAdmin && <th className="px-4 py-2.5 text-right font-medium text-gray-500 text-xs"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {folio.charges.map((c) => {
                  const deptB = folioDepartmentBadge[c.department];
                  return (
                    <tr key={c.id} className="hover:bg-gray-50/40">
                      <td className="px-4 py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${deptB.className}`}>
                          {deptB.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-700 text-xs">
                        {c.description}
                        <div className="text-gray-400">{formatDateTime(c.createdAt)}</div>
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-600 text-xs">{c.quantity}</td>
                      <td className="px-4 py-2.5 text-right text-gray-600 text-xs whitespace-nowrap">
                        {formatINR(c.unitPrice)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-500 text-xs whitespace-nowrap">
                        {c.gstRate}%
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-900 font-medium text-xs whitespace-nowrap">
                        {formatINR(c.total)}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-2.5 text-right">
                          <VoidFolioChargeButton chargeId={c.id} />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Unified folio totals */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-medium text-gray-900 text-sm mb-4">Folio Summary</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Booking charges</span>
            <span className="text-gray-700">{formatINR(totals.bookingCharges)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Outlet (POS) charges</span>
            <span className="text-gray-700">{formatINR(totals.posCharges)}</span>
          </div>
          <div className="flex justify-between font-semibold text-base border-t border-gray-100 pt-2 mt-2">
            <span className="text-gray-900">Total charges</span>
            <span className="text-gray-900">{formatINR(totals.grandCharges)}</span>
          </div>
          <div className="flex justify-between text-green-700">
            <span>Total paid</span>
            <span className="font-medium">{formatINR(totals.grandPaid)}</span>
          </div>
          <div className="flex justify-between text-xs text-gray-400 pl-3">
            <span>· Booking payments</span>
            <span>{formatINR(totals.bookingPaid)}</span>
          </div>
          <div className="flex justify-between text-xs text-gray-400 pl-3">
            <span>· Folio payments</span>
            <span>{formatINR(totals.posPayments)}</span>
          </div>
          <div
            className={`flex justify-between font-semibold border-t border-gray-100 pt-2 mt-2 ${
              totals.grandBalance > 0 ? "text-amber-600" : "text-gray-900"
            }`}
          >
            <span>Balance due</span>
            <span>{formatINR(totals.grandBalance)}</span>
          </div>
        </div>
        {totals.bookingBalance > 0 && booking && (
          <p className="text-[11px] text-gray-400 mt-3">
            The booking balance of {formatINR(totals.bookingBalance)} is collected from the{" "}
            <Link href={`/admin/bookings/${booking.bookingRef}`} className="underline hover:text-gray-600">
              booking page
            </Link>
            . The form below records payments against outlet (POS) charges only.
          </p>
        )}
      </div>

      {/* Record a folio payment */}
      {canPost && <RecordFolioPaymentForm bookingId={bookingId} posBalance={totals.posBalance} />}

      {/* Folio payment history */}
      {folio.payments.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-medium text-gray-900 text-sm">Folio Payments ({folio.payments.length})</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {folio.payments.map((p) => (
              <div key={p.id} className="px-5 py-3 flex items-center justify-between text-sm">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        p.direction === "REFUND"
                          ? "bg-rose-100 text-rose-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {p.direction === "REFUND" ? "Refund" : "Payment"}
                    </span>
                    <span className="text-xs text-gray-500">{p.method}</span>
                    {p.reference && <span className="text-xs font-mono text-gray-400">{p.reference}</span>}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{formatDateTime(p.createdAt)}</div>
                </div>
                <div className={`font-medium ${p.direction === "REFUND" ? "text-rose-600" : "text-gray-900"}`}>
                  {p.direction === "REFUND" ? "−" : ""}
                  {formatINR(p.amount)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
