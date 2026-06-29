import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { AlertCircle, Plus } from "lucide-react";
import { formatINR } from "@/lib/pricing";
import { bookingStatusBadge, sourceBadge, BOOKING_STATUS_OPTIONS } from "@/lib/badges";
import type { BookingStatus, BookingSource } from "@prisma/client";

export const dynamic = "force-dynamic";

function toDate(str: string | undefined): Date | undefined {
  if (!str) return undefined;
  const d = new Date(str);
  return isNaN(d.getTime()) ? undefined : d;
}

async function getBookings(params: {
  status?: BookingStatus;
  source?: BookingSource;
  from?: string;
  to?: string;
  q?: string;
  page: number;
}) {
  const PAGE_SIZE = 25;
  const skip = (params.page - 1) * PAGE_SIZE;

  const where = {
    ...(params.status ? { status: params.status } : {}),
    ...(params.source ? { source: params.source } : {}),
    ...(params.from || params.to
      ? {
          checkIn: {
            ...(params.from ? { gte: toDate(params.from) } : {}),
            ...(params.to ? { lte: toDate(params.to) } : {}),
          },
        }
      : {}),
    ...(params.q
      ? {
          OR: [
            { bookingRef: { contains: params.q, mode: "insensitive" as const } },
            { guest: { name: { contains: params.q, mode: "insensitive" as const } } },
            { guest: { phone: { contains: params.q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: {
        guest: true,
        rooms: { include: { roomType: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.booking.count({ where }),
  ]);

  return { bookings, total, pages: Math.ceil(total / PAGE_SIZE) };
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

interface SearchParams {
  status?: string;
  source?: string;
  from?: string;
  to?: string;
  q?: string;
  page?: string;
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10));
  const status = sp.status as BookingStatus | undefined;
  const source = sp.source as BookingSource | undefined;

  let data = null;
  let dbError = false;

  try {
    data = await getBookings({
      status,
      source,
      from: sp.from,
      to: sp.to,
      q: sp.q,
      page,
    });
  } catch {
    dbError = true;
  }

  if (dbError || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-gray-500">
          <AlertCircle className="mx-auto mb-2 text-amber-500" size={32} />
          <p className="font-medium">Database not connected</p>
          <p className="text-sm mt-1">Add your DATABASE_URL to .env.local and run migrations.</p>
        </div>
      </div>
    );
  }

  const { bookings, total, pages } = data;

  function buildUrl(overrides: Partial<SearchParams>) {
    const next: Record<string, string> = {};
    if (sp.status) next.status = sp.status;
    if (sp.source) next.source = sp.source;
    if (sp.from) next.from = sp.from;
    if (sp.to) next.to = sp.to;
    if (sp.q) next.q = sp.q;
    next.page = "1";
    Object.assign(next, overrides);
    return "/admin/bookings?" + new URLSearchParams(next).toString();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-gray-900">Bookings</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">{total} total</span>
          <Link
            href="/admin/bookings/new"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#1a3a2a] text-white rounded-lg hover:bg-[#14301f] transition-colors"
          >
            <Plus size={16} />
            New Booking
          </Link>
        </div>
      </div>

      {/* Filters */}
      <form method="GET" action="/admin/bookings" className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Search</label>
            <input
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="Ref, guest name, phone…"
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]/30"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Status</label>
            <select
              name="status"
              defaultValue={sp.status ?? ""}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]/30"
            >
              <option value="">All statuses</option>
              {BOOKING_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {bookingStatusBadge[s].label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Check-in from</label>
            <input
              type="date"
              name="from"
              defaultValue={sp.from ?? ""}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]/30"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Check-in to</label>
            <input
              type="date"
              name="to"
              defaultValue={sp.to ?? ""}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]/30"
            />
          </div>
          <button
            type="submit"
            className="bg-[#1a3a2a] text-white px-4 py-1.5 rounded-lg text-sm hover:bg-[#14301f] transition-colors"
          >
            Filter
          </button>
          {(sp.status || sp.source || sp.from || sp.to || sp.q) && (
            <Link
              href="/admin/bookings"
              className="text-sm text-gray-400 hover:text-gray-600 underline"
            >
              Clear
            </Link>
          )}
        </div>
      </form>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {bookings.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-gray-400">
            No bookings found matching the filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs">Ref</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs">Guest</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs">Rooms</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs">Check-in</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs">Check-out</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs">Source</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 text-xs">Total</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 text-xs">Balance</th>
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
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 text-xs">{b.guest.name}</div>
                        <div className="text-gray-400 text-xs">{b.guest.phone}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {b.rooms.map((r) => r.roomType.name).join(", ")}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                        {formatDate(b.checkIn)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                        {formatDate(b.checkOut)}
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
                      <td className="px-4 py-3 text-right text-xs whitespace-nowrap">
                        <span className={b.balanceDue > 0 ? "text-amber-600 font-medium" : "text-gray-400"}>
                          {formatINR(b.balanceDue)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400">
              Page {page} of {pages}
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={buildUrl({ page: String(page - 1) })}
                  className="text-xs px-3 py-1 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Previous
                </Link>
              )}
              {page < pages && (
                <Link
                  href={buildUrl({ page: String(page + 1) })}
                  className="text-xs px-3 py-1 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
