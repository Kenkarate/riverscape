import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Globe,
  CalendarDays,
} from "lucide-react";
import { formatINR } from "@/lib/pricing";
import { bookingStatusBadge, sourceBadge } from "@/lib/badges";

export const dynamic = "force-dynamic";

async function getGuest(id: string) {
  return prisma.guest.findUnique({
    where: { id },
    include: {
      bookings: {
        include: {
          rooms: { include: { room: true, roomType: true } },
        },
        orderBy: { checkIn: "desc" },
      },
    },
  });
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function GuestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const guest = await getGuest(id);
  if (!guest) notFound();

  const bookings = guest.bookings;
  const totalBookings = bookings.length;
  const completedStays = bookings.filter((b) => b.status === "CHECKED_OUT").length;
  const totalSpent = bookings.reduce((s, b) => s + b.totalAmount, 0);

  const checkInDates = bookings.map((b) => b.checkIn);
  const firstStay = checkInDates.length
    ? new Date(Math.min(...checkInDates.map((d) => d.getTime())))
    : null;
  const lastStay = checkInDates.length
    ? new Date(Math.max(...checkInDates.map((d) => d.getTime())))
    : null;

  const profileRows = [
    { icon: Phone, label: "Phone", value: guest.phone },
    { icon: Mail, label: "Email", value: guest.email },
    { icon: MapPin, label: "Address", value: guest.address },
    {
      icon: CreditCard,
      label: "ID",
      value:
        guest.idType || guest.idNumber
          ? [guest.idType, guest.idNumber].filter(Boolean).join(" · ")
          : null,
    },
    { icon: Globe, label: "Country", value: guest.country },
    { icon: CalendarDays, label: "Member since", value: formatDate(guest.createdAt) },
  ];

  const stats = [
    { label: "Total Bookings", value: totalBookings },
    { label: "Completed Stays", value: completedStays },
    { label: "Total Spent", value: formatINR(totalSpent) },
    {
      label: "Stay Range",
      value:
        firstStay && lastStay
          ? `${formatDate(firstStay)} – ${formatDate(lastStay)}`
          : "—",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/guests"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft size={15} />
          Back to guests
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{guest.name}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{guest.phone}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-lg font-semibold text-gray-900">{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile card */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 lg:col-span-1 h-fit">
          <h2 className="font-medium text-gray-900 mb-4">Profile</h2>
          <dl className="space-y-3">
            {profileRows.map((row) => (
              <div key={row.label} className="flex items-start gap-3">
                <row.icon size={15} className="text-gray-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <dt className="text-xs text-gray-400">{row.label}</dt>
                  <dd className="text-sm text-gray-900 break-words">{row.value || "—"}</dd>
                </div>
              </div>
            ))}
          </dl>
        </div>

        {/* Booking history */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden lg:col-span-2">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-medium text-gray-900">Booking History</h2>
          </div>
          {bookings.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-gray-400">
              This guest has no bookings yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs">Ref</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs">Check-in</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs">Check-out</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs">Rooms</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs">Source</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500 text-xs">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {bookings.map((b) => {
                    const statusB = bookingStatusBadge[b.status];
                    const sourceB = sourceBadge[b.source];
                    return (
                      <tr key={b.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs">
                          <Link
                            href={`/admin/bookings/${b.bookingRef}`}
                            className="text-[#1a3a2a] hover:underline font-medium"
                          >
                            {b.bookingRef}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                          {formatDate(b.checkIn)}
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                          {formatDate(b.checkOut)}
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">
                          {b.rooms.map((r) => r.room?.number ?? r.roomType.name).join(", ")}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusB.className}`}>
                            {statusB.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${sourceB.className}`}>
                            {sourceB.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900 font-medium text-xs whitespace-nowrap">
                          {formatINR(b.totalAmount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
