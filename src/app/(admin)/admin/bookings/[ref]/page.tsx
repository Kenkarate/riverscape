import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertCircle, FileText } from "lucide-react";
import { formatINR } from "@/lib/pricing";
import { bookingStatusBadge, sourceBadge, mealPlanLabel, paymentStatusBadge } from "@/lib/badges";
import BookingActions from "@/components/admin/booking-actions";
import RecordPaymentForm from "@/components/admin/record-payment-form";
import GenerateInvoiceButton from "@/components/admin/generate-invoice-button";
import RoomAssignSelect from "@/components/admin/room-assign-select";

export const dynamic = "force-dynamic";

async function getBooking(ref: string) {
  return prisma.booking.findUnique({
    where: { bookingRef: ref },
    include: {
      guest: true,
      rooms: {
        include: {
          roomType: true,
          room: true,
          nights: { orderBy: { date: "asc" } },
        },
      },
      addons: { include: { addon: true } },
      payments: { orderBy: { createdAt: "desc" } },
      coupon: { select: { code: true, type: true, value: true } },
      invoice: true,
    },
  });
}

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

function nights(checkIn: Date, checkOut: Date) {
  return Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000);
}

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;

  let booking: Awaited<ReturnType<typeof getBooking>> = null;
  let dbError = false;

  try {
    booking = await getBooking(ref);
  } catch {
    dbError = true;
  }

  if (dbError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-gray-500">
          <AlertCircle className="mx-auto mb-2 text-amber-500" size={32} />
          <p className="font-medium">Database not connected</p>
        </div>
      </div>
    );
  }

  if (!booking) notFound();

  const statusB = bookingStatusBadge[booking.status];
  const sourceB = sourceBadge[booking.source];
  const stayNights = nights(booking.checkIn, booking.checkOut);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back + header */}
      <div>
        <Link
          href="/admin/bookings"
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mb-3"
        >
          <ArrowLeft size={14} /> Back to bookings
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-semibold text-gray-900 font-mono">
                {booking.bookingRef}
              </h1>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusB.className}`}>
                {statusB.label}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${sourceB.className}`}>
                {sourceB.label}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Created {formatDateTime(booking.createdAt)}
            </p>
          </div>
          <BookingActions bookingId={booking.id} status={booking.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Guest details */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-medium text-gray-900 text-sm mb-3">Guest</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Name</dt>
              <dd className="font-medium text-gray-900">{booking.guest.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Phone</dt>
              <dd className="text-gray-700">{booking.guest.phone}</dd>
            </div>
            {booking.guest.email && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Email</dt>
                <dd className="text-gray-700 text-xs">{booking.guest.email}</dd>
              </div>
            )}
            {booking.guest.address && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Address</dt>
                <dd className="text-gray-700 text-xs text-right max-w-[60%]">
                  {booking.guest.address}
                </dd>
              </div>
            )}
            {booking.guest.idType && (
              <div className="flex justify-between">
                <dt className="text-gray-500">{booking.guest.idType}</dt>
                <dd className="font-mono text-gray-700 text-xs">{booking.guest.idNumber}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Stay details */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-medium text-gray-900 text-sm mb-3">Stay</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Check-in</dt>
              <dd className="font-medium text-gray-900">{formatDate(booking.checkIn)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Check-out</dt>
              <dd className="font-medium text-gray-900">{formatDate(booking.checkOut)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Duration</dt>
              <dd className="text-gray-700">
                {stayNights} night{stayNights !== 1 ? "s" : ""}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Guests</dt>
              <dd className="text-gray-700">
                {booking.adults} adult{booking.adults !== 1 ? "s" : ""}
                {booking.children > 0 &&
                  `, ${booking.children} child${booking.children !== 1 ? "ren" : ""}`}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Meal Plan</dt>
              <dd className="text-gray-700">{mealPlanLabel[booking.mealPlan]}</dd>
            </div>
            {booking.specialRequests && (
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500 shrink-0">Requests</dt>
                <dd className="text-gray-700 text-xs text-right">{booking.specialRequests}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Rooms */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-medium text-gray-900 text-sm">
            Rooms ({booking.rooms.length})
          </h2>
        </div>
        <div className="divide-y divide-gray-50">
          {booking.rooms.map((br) => (
            <div key={br.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium text-gray-900 text-sm">{br.roomType.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {br.room ? `Room ${br.room.number}` : "Room not yet assigned"}
                    {" · "}
                    {nights(br.checkIn, br.checkOut)} nights
                  </div>
                  {!br.room && booking.status !== "CANCELLED" && (
                    <RoomAssignSelect
                      bookingRoomId={br.id}
                      roomTypeId={br.roomTypeId}
                      checkIn={br.checkIn.toISOString().slice(0, 10)}
                      checkOut={br.checkOut.toISOString().slice(0, 10)}
                    />
                  )}
                </div>
                <div className="text-right">
                  <div className="font-medium text-gray-900">{formatINR(br.subtotal + br.taxAmount)}</div>
                  <div className="text-xs text-gray-400">incl. GST</div>
                </div>
              </div>
              {br.nights.length > 0 && (
                <div className="mt-3 overflow-x-auto">
                  <table className="text-xs w-full">
                    <thead>
                      <tr className="text-gray-400">
                        <th className="text-left pb-1 pr-4 font-medium">Date</th>
                        <th className="text-right pb-1 pr-4 font-medium">Rate</th>
                        <th className="text-right pb-1 pr-4 font-medium">GST</th>
                        <th className="text-right pb-1 font-medium">Tax</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {br.nights.map((n) => (
                        <tr key={n.id}>
                          <td className="py-0.5 pr-4 text-gray-600">
                            {new Date(n.date).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                            })}
                          </td>
                          <td className="py-0.5 pr-4 text-right text-gray-700">
                            {formatINR(n.rate)}
                          </td>
                          <td className="py-0.5 pr-4 text-right text-gray-500">
                            {n.gstRate}%
                          </td>
                          <td className="py-0.5 text-right text-gray-700">
                            {formatINR(n.taxAmount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Add-ons */}
      {booking.addons.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-medium text-gray-900 text-sm">Add-ons</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {booking.addons.map((ba) => (
              <div key={ba.id} className="px-5 py-3 flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium text-gray-900">{ba.addon.name}</span>
                  <span className="text-gray-400 text-xs ml-2">
                    × {ba.quantity} {ba.addon.unit}
                  </span>
                </div>
                <div className="text-right">
                  <div className="font-medium text-gray-900">{formatINR(ba.total)}</div>
                  <div className="text-xs text-gray-400">
                    {formatINR(ba.unitPrice)} + {ba.gstRate}% GST
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Financial summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-medium text-gray-900 text-sm mb-4">Financial Summary</h2>
        <div className="space-y-2 text-sm">
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
              <span>
                Discount
                {booking.coupon && (
                  <span className="text-xs ml-1">({booking.coupon.code})</span>
                )}
              </span>
              <span>−{formatINR(booking.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-base border-t border-gray-100 pt-2 mt-2">
            <span className="text-gray-900">Total</span>
            <span className="text-gray-900">{formatINR(booking.totalAmount)}</span>
          </div>
          <div className="flex justify-between text-green-700">
            <span>Paid</span>
            <span className="font-medium">{formatINR(booking.paidAmount)}</span>
          </div>
          {booking.balanceDue > 0 && (
            <div className="flex justify-between text-amber-600">
              <span>Balance due</span>
              <span className="font-semibold">{formatINR(booking.balanceDue)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Record payment */}
      {booking.balanceDue > 0 &&
        booking.status !== "CANCELLED" &&
        booking.status !== "CHECKED_OUT" && (
          <RecordPaymentForm bookingId={booking.id} balanceDue={booking.balanceDue} />
        )}

      {/* Invoice */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-medium text-gray-900 text-sm mb-4">GST Invoice</h2>
        {booking.invoice ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-gray-900 font-mono">
                {booking.invoice.number}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                Issued {formatDateTime(booking.invoice.issuedAt)}
              </div>
            </div>
            <Link
              href={`/admin/bookings/${booking.bookingRef}/invoice`}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <FileText size={15} /> View Invoice
            </Link>
          </div>
        ) : ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"].includes(booking.status) ? (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">
              No invoice generated yet for this booking.
            </p>
            <GenerateInvoiceButton bookingId={booking.id} />
          </div>
        ) : (
          <p className="text-xs text-gray-400">
            An invoice can be generated once the booking is confirmed.
          </p>
        )}
      </div>

      {/* Payments */}
      {booking.payments.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-medium text-gray-900 text-sm">
              Payments ({booking.payments.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-50">
            {booking.payments.map((p) => {
              const pb = paymentStatusBadge[p.status];
              return (
                <div key={p.id} className="px-5 py-3 flex items-center justify-between text-sm">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pb.className}`}>
                        {pb.label}
                      </span>
                      <span className="text-xs text-gray-500 capitalize">{p.type.toLowerCase()}</span>
                    </div>
                    {p.razorpayPaymentId && (
                      <div className="text-xs font-mono text-gray-400 mt-0.5">
                        {p.razorpayPaymentId}
                      </div>
                    )}
                    <div className="text-xs text-gray-400 mt-0.5">
                      {formatDateTime(p.createdAt)}
                    </div>
                  </div>
                  <div className="font-medium text-gray-900">{formatINR(p.amount)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cancellation info */}
      {booking.cancelledAt && (
        <div className="bg-red-50 rounded-xl border border-red-100 p-5">
          <h2 className="font-medium text-red-700 text-sm mb-2">Cancellation</h2>
          <p className="text-xs text-red-600">
            Cancelled on {formatDateTime(booking.cancelledAt)}
            {booking.cancelReason && `: ${booking.cancelReason}`}
          </p>
        </div>
      )}
    </div>
  );
}
