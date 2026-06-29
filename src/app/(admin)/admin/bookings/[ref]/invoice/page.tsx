import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { formatINR } from "@/lib/pricing";
import { mealPlanLabel } from "@/lib/badges";
import PrintButton from "@/components/admin/print-button";

export const dynamic = "force-dynamic";

async function getInvoiceData(ref: string) {
  return prisma.booking.findUnique({
    where: { bookingRef: ref },
    include: {
      guest: true,
      property: true,
      invoice: true,
      rooms: {
        include: {
          roomType: { select: { name: true } },
          room: { select: { number: true } },
          nights: { orderBy: { date: "asc" } },
        },
      },
      addons: { include: { addon: { select: { name: true } } } },
    },
  });
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function nights(checkIn: Date, checkOut: Date) {
  return Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000);
}

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "");
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  let s = "";
  if (h) s += ONES[h] + " Hundred";
  if (rest) s += (h ? " " : "") + twoDigits(rest);
  return s;
}

function inWords(num: number): string {
  if (num === 0) return "Zero";
  let result = "";
  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  if (crore) result += threeDigits(crore) + " Crore ";
  if (lakh) result += twoDigits(lakh) + " Lakh ";
  if (thousand) result += twoDigits(thousand) + " Thousand ";
  if (num) result += threeDigits(num);
  return result.trim();
}

function amountInWords(paise: number): string {
  const rupees = Math.floor(paise / 100);
  const p = paise % 100;
  let s = `${inWords(rupees)} Rupees`;
  if (p > 0) s += ` and ${inWords(p)} Paise`;
  return s + " Only";
}

function pct(part: number, whole: number): string {
  if (whole <= 0) return "0";
  return (Math.round((part / whole) * 1000) / 10).toString();
}

const printCss = `
  @media print {
    body * { visibility: hidden; }
    #invoice-print, #invoice-print * { visibility: visible; }
    #invoice-print { position: absolute; left: 0; top: 0; width: 100%; padding: 0; }
    .no-print { display: none !important; }
    @page { margin: 16mm; }
  }
`;

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;

  let booking: Awaited<ReturnType<typeof getInvoiceData>> = null;
  let dbError = false;

  try {
    booking = await getInvoiceData(ref);
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

  const { invoice, property, guest } = booking;

  if (!invoice) {
    return (
      <div className="max-w-3xl mx-auto">
        <Link
          href={`/admin/bookings/${booking.bookingRef}`}
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mb-4"
        >
          <ArrowLeft size={14} /> Back to booking
        </Link>
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <AlertCircle className="mx-auto mb-2 text-amber-500" size={28} />
          <p className="text-sm font-medium text-gray-700">No invoice generated yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Generate the invoice from the booking detail page first.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <style dangerouslySetInnerHTML={{ __html: printCss }} />

      {/* Toolbar (hidden on print) */}
      <div className="no-print flex items-center justify-between mb-4">
        <Link
          href={`/admin/bookings/${booking.bookingRef}`}
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600"
        >
          <ArrowLeft size={14} /> Back to booking
        </Link>
        <PrintButton />
      </div>

      {/* Invoice document */}
      <div
        id="invoice-print"
        className="bg-white rounded-xl border border-gray-200 p-8 text-gray-800"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-6 border-b border-gray-200 pb-5">
          <div>
            <h1 className="text-lg font-semibold tracking-wide text-[#1a3a2a]">
              {property.name}
            </h1>
            <p className="text-xs text-gray-500 mt-1 max-w-xs leading-relaxed">
              {property.address}
              {property.city ? `, ${property.city}` : ""}
              {property.state ? `, ${property.state}` : ""}
            </p>
            {property.gstin && (
              <p className="text-xs text-gray-500 mt-1">GSTIN: {property.gstin}</p>
            )}
            {property.phone && (
              <p className="text-xs text-gray-500">Phone: {property.phone}</p>
            )}
            {property.email && (
              <p className="text-xs text-gray-500">{property.email}</p>
            )}
          </div>
          <div className="text-right">
            <div className="text-base font-bold tracking-wider text-gray-900">
              TAX INVOICE
            </div>
            <div className="text-xs text-gray-600 mt-2">
              <div>
                <span className="text-gray-400">Invoice No: </span>
                <span className="font-mono font-medium">{invoice.number}</span>
              </div>
              <div>
                <span className="text-gray-400">Date: </span>
                {formatDate(invoice.issuedAt)}
              </div>
              <div>
                <span className="text-gray-400">Booking Ref: </span>
                <span className="font-mono">{booking.bookingRef}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Billed to / stay */}
        <div className="grid grid-cols-2 gap-6 py-5 border-b border-gray-200">
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
              Billed To
            </div>
            <div className="text-sm font-medium text-gray-900">{guest.name}</div>
            <div className="text-xs text-gray-600 mt-0.5">{guest.phone}</div>
            {guest.email && <div className="text-xs text-gray-600">{guest.email}</div>}
            {guest.address && (
              <div className="text-xs text-gray-600 mt-0.5">{guest.address}</div>
            )}
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
              Stay Details
            </div>
            <div className="text-xs text-gray-600">
              Check-in: <span className="text-gray-900">{formatDate(booking.checkIn)}</span>
            </div>
            <div className="text-xs text-gray-600">
              Check-out: <span className="text-gray-900">{formatDate(booking.checkOut)}</span>
            </div>
            <div className="text-xs text-gray-600">
              {booking.adults} adult{booking.adults !== 1 ? "s" : ""}
              {booking.children > 0 ? `, ${booking.children} child` : ""} ·{" "}
              {mealPlanLabel[booking.mealPlan]}
            </div>
            <div className="text-xs text-gray-600">
              Place of Supply: {invoice.placeOfSupply}
            </div>
          </div>
        </div>

        {/* Items */}
        <table className="w-full text-xs mt-5">
          <thead>
            <tr className="border-b border-gray-300 text-gray-500">
              <th className="text-left py-2 font-medium">Description</th>
              <th className="text-center py-2 font-medium">HSN/SAC</th>
              <th className="text-center py-2 font-medium">Qty</th>
              <th className="text-right py-2 font-medium">Taxable</th>
              <th className="text-right py-2 font-medium">Tax</th>
              <th className="text-right py-2 font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {booking.rooms.map((br) => {
              const n = nights(br.checkIn, br.checkOut);
              return (
                <tr key={br.id}>
                  <td className="py-2 pr-2 text-gray-800">
                    {br.roomType.name}
                    {br.room ? ` — Room ${br.room.number}` : ""}
                    <span className="block text-gray-400">
                      {formatDate(br.checkIn)} – {formatDate(br.checkOut)}
                    </span>
                  </td>
                  <td className="py-2 text-center text-gray-500">{invoice.hsnSac}</td>
                  <td className="py-2 text-center text-gray-600">
                    {n} night{n !== 1 ? "s" : ""}
                  </td>
                  <td className="py-2 text-right text-gray-700">{formatINR(br.subtotal)}</td>
                  <td className="py-2 text-right text-gray-700">{formatINR(br.taxAmount)}</td>
                  <td className="py-2 text-right text-gray-900 font-medium">
                    {formatINR(br.subtotal + br.taxAmount)}
                  </td>
                </tr>
              );
            })}
            {booking.addons.map((ba) => {
              const taxable = ba.total - ba.taxAmount;
              return (
                <tr key={ba.id}>
                  <td className="py-2 pr-2 text-gray-800">
                    {ba.addon.name}
                    <span className="block text-gray-400">Add-on × {ba.quantity}</span>
                  </td>
                  <td className="py-2 text-center text-gray-500">9963</td>
                  <td className="py-2 text-center text-gray-600">{ba.quantity}</td>
                  <td className="py-2 text-right text-gray-700">{formatINR(taxable)}</td>
                  <td className="py-2 text-right text-gray-700">{formatINR(ba.taxAmount)}</td>
                  <td className="py-2 text-right text-gray-900 font-medium">
                    {formatINR(ba.total)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mt-5">
          <div className="w-full max-w-xs space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Taxable Value</span>
              <span className="text-gray-800">{formatINR(invoice.taxableValue)}</span>
            </div>
            {booking.discountAmount > 0 && (
              <div className="flex justify-between text-green-700">
                <span>Discount</span>
                <span>−{formatINR(booking.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">
                CGST ({pct(invoice.cgst, invoice.taxableValue)}%)
              </span>
              <span className="text-gray-800">{formatINR(invoice.cgst)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">
                SGST ({pct(invoice.sgst, invoice.taxableValue)}%)
              </span>
              <span className="text-gray-800">{formatINR(invoice.sgst)}</span>
            </div>
            {invoice.igst > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">IGST</span>
                <span className="text-gray-800">{formatINR(invoice.igst)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-300 pt-2 mt-1 text-sm font-semibold">
              <span className="text-gray-900">Grand Total</span>
              <span className="text-gray-900">{formatINR(invoice.total)}</span>
            </div>
          </div>
        </div>

        {/* Amount in words */}
        <div className="mt-5 pt-4 border-t border-gray-200">
          <span className="text-xs text-gray-400">Amount in words: </span>
          <span className="text-xs text-gray-700 font-medium">
            {amountInWords(invoice.total)}
          </span>
        </div>

        {/* Footer */}
        <div className="mt-8 flex items-end justify-between">
          <p className="text-[11px] text-gray-400 max-w-xs leading-relaxed">
            This is a computer-generated invoice and does not require a physical
            signature. Thank you for staying with {property.name}.
          </p>
          <div className="text-right">
            <div className="h-10" />
            <div className="text-xs text-gray-500 border-t border-gray-300 pt-1.5">
              For {property.name}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
