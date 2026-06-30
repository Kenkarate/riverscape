import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { AlertCircle, Search } from "lucide-react";
import { formatINR } from "@/lib/pricing";
import DeleteGuestButton from "@/components/admin/delete-guest-button";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

async function getGuests(q: string | undefined, page: number) {
  const skip = (page - 1) * PAGE_SIZE;

  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { phone: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : undefined;

  const [guests, total] = await Promise.all([
    prisma.guest.findMany({
      where,
      include: {
        _count: { select: { bookings: true } },
        bookings: { select: { totalAmount: true, checkIn: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.guest.count({ where }),
  ]);

  return { guests, total, pages: Math.ceil(total / PAGE_SIZE) };
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

interface SearchParams {
  q?: string;
  page?: string;
}

export default async function GuestsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10));

  const session = await auth();
  const role = (session?.user as { role?: string })?.role ?? null;
  const isAdmin = !!role && ADMIN_ROLES.includes(role);

  let data = null;
  let dbError = false;

  try {
    data = await getGuests(q, page);
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

  const { guests, total, pages } = data;

  function buildUrl(nextPage: number) {
    const params: Record<string, string> = { page: String(nextPage) };
    if (q) params.q = q;
    return "/admin/guests?" + new URLSearchParams(params).toString();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-gray-900">Guests</h1>
        <span className="text-sm text-gray-400">{total} total</span>
      </div>

      {/* Search */}
      <form method="GET" action="/admin/guests" className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Search</label>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                name="q"
                defaultValue={q ?? ""}
                placeholder="Name or phone…"
                className="border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-sm w-60 focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]/30"
              />
            </div>
          </div>
          <button
            type="submit"
            className="bg-[#1a3a2a] text-white px-4 py-1.5 rounded-lg text-sm hover:bg-[#14301f] transition-colors"
          >
            Search
          </button>
          {q && (
            <Link href="/admin/guests" className="text-sm text-gray-400 hover:text-gray-600 underline">
              Clear
            </Link>
          )}
        </div>
      </form>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {guests.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-gray-400">
            {q ? "No guests match your search." : "No guests yet."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs">Phone</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs">Email</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 text-xs">Bookings</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 text-xs">Total Spent</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs">Last Check-in</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs">Country</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 text-xs">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {guests.map((g) => {
                  const totalSpent = g.bookings.reduce((s, b) => s + b.totalAmount, 0);
                  const lastCheckIn = g.bookings.reduce<Date | null>((latest, b) => {
                    return !latest || b.checkIn > latest ? b.checkIn : latest;
                  }, null);
                  return (
                    <tr key={g.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/guests/${g.id}`}
                          className="text-[#1a3a2a] hover:underline font-medium"
                        >
                          {g.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{g.phone}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{g.email || "—"}</td>
                      <td className="px-4 py-3 text-right text-gray-900 text-xs">{g._count.bookings}</td>
                      <td className="px-4 py-3 text-right text-gray-900 font-medium text-xs whitespace-nowrap">
                        {formatINR(totalSpent)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                        {lastCheckIn ? formatDate(lastCheckIn) : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{g.country || "—"}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/guests/${g.id}`}
                            className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            View
                          </Link>
                          {isAdmin && (
                            <DeleteGuestButton guestId={g.id} guestName={g.name} />
                          )}
                        </div>
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
                  href={buildUrl(page - 1)}
                  className="text-xs px-3 py-1 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Previous
                </Link>
              )}
              {page < pages && (
                <Link
                  href={buildUrl(page + 1)}
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
