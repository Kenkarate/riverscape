import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { AlertCircle, ShieldAlert } from "lucide-react";
import Link from "next/link";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

// Known entity types written by the app's mutations.
const ENTITY_TYPES = [
  "Booking",
  "BookingRoom",
  "Invoice",
  "MaintenanceBlock",
  "Room",
  "RoomType",
  "RatePlan",
  "User",
];

interface SearchParams {
  entity?: string;
  from?: string;
  to?: string;
  page?: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function getData(params: {
  entity?: string;
  from?: string;
  to?: string;
  page: number;
}) {
  const where: Prisma.AuditLogWhereInput = {};

  if (params.entity && ENTITY_TYPES.includes(params.entity)) {
    where.entityType = params.entity;
  }

  if ((params.from && DATE_RE.test(params.from)) || (params.to && DATE_RE.test(params.to))) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (params.from && DATE_RE.test(params.from)) {
      createdAt.gte = new Date(`${params.from}T00:00:00`);
    }
    if (params.to && DATE_RE.test(params.to)) {
      createdAt.lte = new Date(`${params.to}T23:59:59.999`);
    }
    where.createdAt = createdAt;
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (params.page - 1) * PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
  ]);

  // Resolve booking refs so Booking rows can link to the booking detail page.
  const bookingIds = logs
    .filter((l) => l.entityType === "Booking")
    .map((l) => l.entityId);
  const bookings = bookingIds.length
    ? await prisma.booking.findMany({
        where: { id: { in: bookingIds } },
        select: { id: true, bookingRef: true },
      })
    : [];
  const refById = new Map(bookings.map((b) => [b.id, b.bookingRef]));

  return { logs, total, refById };
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

function buildQuery(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  const role = session?.user?.role ?? "STAFF";
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-gray-500">
          <ShieldAlert className="mx-auto mb-2 text-amber-500" size={32} />
          <p className="font-medium text-gray-900">Access denied</p>
          <p className="text-sm mt-1">Only Admins can view the audit log.</p>
        </div>
      </div>
    );
  }

  const sp = await searchParams;
  const entity = sp.entity && ENTITY_TYPES.includes(sp.entity) ? sp.entity : "";
  const from = sp.from && DATE_RE.test(sp.from) ? sp.from : "";
  const to = sp.to && DATE_RE.test(sp.to) ? sp.to : "";
  const page = Math.max(1, Number(sp.page) || 1);

  let data: Awaited<ReturnType<typeof getData>> | null = null;
  let dbError = false;

  try {
    data = await getData({ entity, from, to, page });
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

  const { logs, total, refById } = data;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const baseFilters = { entity: entity || undefined, from: from || undefined, to: to || undefined };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Audit Log</h1>
          <span className="text-sm text-gray-400">{total} entries</span>
        </div>

        {/* Filters */}
        <form method="GET" action="/admin/audit" className="flex items-end gap-2 flex-wrap">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Entity</label>
            <select
              name="entity"
              defaultValue={entity}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]/30 bg-white"
            >
              <option value="">All entities</option>
              {ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">From</label>
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]/30"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">To</label>
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]/30"
            />
          </div>
          <button
            type="submit"
            className="bg-[#1a3a2a] text-white px-4 py-1.5 rounded-lg text-sm hover:bg-[#14301f] transition-colors"
          >
            Filter
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-3 text-left font-medium text-gray-400 text-xs">Timestamp</th>
                <th className="px-5 py-3 text-left font-medium text-gray-400 text-xs">User</th>
                <th className="px-5 py-3 text-left font-medium text-gray-400 text-xs">Action</th>
                <th className="px-5 py-3 text-left font-medium text-gray-400 text-xs">Entity</th>
                <th className="px-5 py-3 text-left font-medium text-gray-400 text-xs">Entity ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {logs.map((log) => {
                const userLabel = log.user?.name ?? log.user?.email ?? "System";
                let href: string | null = null;
                if (log.entityType === "Booking") {
                  const ref = refById.get(log.entityId);
                  if (ref) href = `/admin/bookings/${ref}`;
                } else if (log.entityType === "Room") {
                  href = "/admin/rooms";
                }
                return (
                  <tr key={log.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3 text-gray-600 text-xs whitespace-nowrap">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="px-5 py-3 text-gray-700">{userLabel}</td>
                    <td className="px-5 py-3">
                      <span className="text-xs font-mono px-2 py-0.5 bg-gray-100 text-gray-700 rounded">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{log.entityType}</td>
                    <td className="px-5 py-3 text-xs font-mono text-gray-500">
                      {href ? (
                        <Link href={href} className="text-[#1a3a2a] hover:underline">
                          {log.entityType === "Booking"
                            ? refById.get(log.entityId)
                            : log.entityId.slice(0, 12)}
                        </Link>
                      ) : (
                        <span title={log.entityId}>{log.entityId.slice(0, 12)}…</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {logs.length === 0 && (
          <div className="px-5 py-12 text-center text-sm text-gray-400">
            No audit entries match these filters.
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link
                href={`/admin/audit${buildQuery({ ...baseFilters, page: String(page - 1) })}`}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Previous
              </Link>
            ) : (
              <span className="px-3 py-1.5 text-sm border border-gray-100 rounded-lg text-gray-300">
                Previous
              </span>
            )}
            {page < totalPages ? (
              <Link
                href={`/admin/audit${buildQuery({ ...baseFilters, page: String(page + 1) })}`}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Next
              </Link>
            ) : (
              <span className="px-3 py-1.5 text-sm border border-gray-100 rounded-lg text-gray-300">
                Next
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
