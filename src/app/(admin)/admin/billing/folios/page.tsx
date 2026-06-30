import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { formatINR } from "@/lib/pricing";
import { bookingStatusBadge, folioStatusBadge } from "@/lib/badges";
import BillingNav from "@/components/admin/billing-nav";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const ACTIVE_BALANCE_STATUSES = ["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] as const;

const VIEW_TABS = [
  { key: "", label: "All" },
  { key: "inhouse", label: "In-House" },
  { key: "due", label: "Outstanding" },
] as const;

function formatDate(d: Date) {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

interface SearchParams {
  q?: string;
  view?: string;
  balance?: string;
  page?: string;
}

async function getFolios(params: { q?: string; view?: string; balance?: string; page: number }) {
  const PAGE_SIZE = 25;
  const skip = (params.page - 1) * PAGE_SIZE;

  const and: Prisma.BookingWhereInput[] = [];

  // The dashboard links here with ?balance=due; the Outstanding tab uses view=due.
  const wantsDue = params.view === "due" || params.balance === "due";
  if (wantsDue) {
    and.push({
      status: { in: [...ACTIVE_BALANCE_STATUSES] },
      OR: [{ balanceDue: { gt: 0 } }, { folio: { balance: { gt: 0 } } }],
    });
  } else if (params.view === "inhouse") {
    and.push({ status: "CHECKED_IN" });
  }

  if (params.q) {
    and.push({
      OR: [
        { bookingRef: { contains: params.q, mode: "insensitive" } },
        { guest: { name: { contains: params.q, mode: "insensitive" } } },
        { guest: { phone: { contains: params.q, mode: "insensitive" } } },
        { folio: { folioNumber: { contains: params.q, mode: "insensitive" } } },
      ],
    });
  }

  const where: Prisma.BookingWhereInput = and.length ? { AND: and } : {};

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      select: {
        id: true,
        bookingRef: true,
        status: true,
        checkIn: true,
        checkOut: true,
        totalAmount: true,
        balanceDue: true,
        guest: { select: { name: true, phone: true } },
        folio: { select: { folioNumber: true, status: true, chargesTotal: true, balance: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.booking.count({ where }),
  ]);

  return { bookings, total, pages: Math.ceil(total / PAGE_SIZE) };
}

export default async function FoliosListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10));

  let data: Awaited<ReturnType<typeof getFolios>> | null = null;
  let dbError = false;

  try {
    data = await getFolios({ q: sp.q, view: sp.view, balance: sp.balance, page });
  } catch {
    dbError = true;
  }

  if (dbError || !data) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-gray-900">Folios</h1>
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

  const { bookings, total, pages } = data;
  const activeView = sp.view ?? (sp.balance === "due" ? "due" : "");

  function tabUrl(view: string) {
    const next: Record<string, string> = {};
    if (sp.q) next.q = sp.q;
    if (view) next.view = view;
    const qs = new URLSearchParams(next).toString();
    return qs ? `/admin/billing/folios?${qs}` : "/admin/billing/folios";
  }

  function pageUrl(p: number) {
    const next: Record<string, string> = {};
    if (sp.q) next.q = sp.q;
    if (activeView) next.view = activeView;
    next.page = String(p);
    return `/admin/billing/folios?${new URLSearchParams(next).toString()}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-gray-900">Folios</h1>
        <span className="text-sm text-gray-400">{total} total</span>
      </div>

      <BillingNav />

      {/* View tabs */}
      <div className="flex flex-wrap items-center gap-1.5">
        {VIEW_TABS.map((tab) => {
          const active = activeView === tab.key;
          return (
            <Link
              key={tab.key || "all"}
              href={tabUrl(tab.key)}
              className={
                active
                  ? "px-3 py-1.5 text-sm rounded-lg bg-[#1a3a2a] text-white font-medium transition-colors"
                  : "px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              }
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Search */}
      <form method="GET" action="/admin/billing/folios" className="bg-white rounded-xl border border-gray-200 p-4">
        {activeView && <input type="hidden" name="view" value={activeView} />}
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Search</label>
            <input
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="Folio #, ref, guest, phone…"
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-60 focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]/30"
            />
          </div>
          <button
            type="submit"
            className="bg-[#1a3a2a] text-white px-4 py-1.5 rounded-lg text-sm hover:bg-[#14301f] transition-colors"
          >
            Search
          </button>
          {(sp.q || activeView) && (
            <Link href="/admin/billing/folios" className="text-sm text-gray-400 hover:text-gray-600 underline">
              Clear
            </Link>
          )}
        </div>
      </form>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {bookings.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-gray-400">No folios found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs">Folio</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs">Guest</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs">Stay</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 text-xs">Charges</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 text-xs">POS</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 text-xs">Balance Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {bookings.map((b) => {
                  const statusB = bookingStatusBadge[b.status];
                  const posBalance = b.folio?.balance ?? 0;
                  const totalBalance = b.balanceDue + posBalance;
                  const folioStatusB = b.folio ? folioStatusBadge[b.folio.status] : null;
                  return (
                    <tr key={b.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/billing/folios/${b.id}`}
                          className="text-[#1a3a2a] hover:underline font-medium font-mono text-xs"
                        >
                          {b.folio?.folioNumber ?? "Open folio"}
                        </Link>
                        <div className="text-gray-400 text-xs font-mono">{b.bookingRef}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 text-xs">{b.guest.name}</div>
                        <div className="text-gray-400 text-xs">{b.guest.phone}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                        {formatDate(b.checkIn)} – {formatDate(b.checkOut)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium w-fit ${statusB.className}`}>
                            {statusB.label}
                          </span>
                          {folioStatusB && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium w-fit ${folioStatusB.className}`}>
                              {folioStatusB.label}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900 font-medium text-xs whitespace-nowrap">
                        {formatINR(b.totalAmount)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs whitespace-nowrap">
                        <span className={posBalance > 0 ? "text-purple-600 font-medium" : "text-gray-300"}>
                          {posBalance > 0 ? formatINR(posBalance) : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs whitespace-nowrap">
                        <span className={totalBalance > 0 ? "text-amber-600 font-semibold" : "text-gray-400"}>
                          {formatINR(totalBalance)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400">
              Page {page} of {pages}
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={pageUrl(page - 1)} className="text-xs px-3 py-1 border border-gray-200 rounded-lg hover:bg-gray-50">
                  Previous
                </Link>
              )}
              {page < pages && (
                <Link href={pageUrl(page + 1)} className="text-xs px-3 py-1 border border-gray-200 rounded-lg hover:bg-gray-50">
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
