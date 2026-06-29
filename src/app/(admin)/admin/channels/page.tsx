import { prisma } from "@/lib/prisma";
import { AlertCircle, Globe } from "lucide-react";
import { formatINR } from "@/lib/pricing";
import {
  channelTypeBadge,
  channelTypeLabel,
  syncStatusBadge,
} from "@/lib/badges";
import ChannelAddForm from "@/components/admin/channel-add-form";
import ActiveToggle from "@/components/admin/active-toggle";
import { toggleChannel } from "./actions";
import type { DiscountType, SyncType, SyncDirection } from "@prisma/client";

export const dynamic = "force-dynamic";

async function getData() {
  const property = await prisma.property.findUnique({
    where: { slug: "riverscape" },
    include: {
      channels: {
        orderBy: { name: "asc" },
        include: {
          _count: { select: { bookings: true } },
          syncLogs: { orderBy: { startedAt: "desc" }, take: 1 },
        },
      },
    },
  });

  const recentSyncLogs = await prisma.syncLog.findMany({
    orderBy: { startedAt: "desc" },
    take: 20,
    include: { channel: { select: { name: true, type: true } } },
  });

  return { property, recentSyncLogs };
}

function formatMarkup(markupType: DiscountType, markupValue: number): string {
  if (markupValue === 0) return "No markup";
  return markupType === "PERCENT"
    ? `+${markupValue / 100}% markup`
    : `Flat ${formatINR(markupValue)} markup`;
}

function titleCase(value: SyncType | SyncDirection): string {
  return value
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function fmtDateTime(d: Date) {
  return new Date(d).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ChannelsPage() {
  let property: Awaited<ReturnType<typeof getData>>["property"] = null;
  let recentSyncLogs: Awaited<ReturnType<typeof getData>>["recentSyncLogs"] = [];
  let dbError = false;

  try {
    const data = await getData();
    property = data.property;
    recentSyncLogs = data.recentSyncLogs;
  } catch {
    dbError = true;
  }

  if (dbError) {
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

  if (!property) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-gray-500">
          <AlertCircle className="mx-auto mb-2 text-amber-500" size={32} />
          <p className="font-medium">Property not found</p>
          <p className="text-sm mt-1">Seed the database to create the property record.</p>
        </div>
      </div>
    );
  }

  const channels = property.channels;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-gray-900">Channel Manager</h1>
        <ChannelAddForm />
      </div>

      {/* Channel list */}
      {channels.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Globe className="mx-auto mb-2 text-gray-300" size={28} />
          <p className="text-sm text-gray-400">
            No channels configured yet. Add an OTA channel to get started.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {channels.map((channel) => {
            const badge = channelTypeBadge[channel.type];
            const lastSync = channel.syncLogs[0];
            return (
              <div
                key={channel.id}
                className="bg-white rounded-xl border border-gray-200 p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.className}`}
                      >
                        {channelTypeLabel[channel.type]}
                      </span>
                    </div>
                    <h2 className="mt-2 font-medium text-gray-900 truncate">
                      {channel.name}
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatMarkup(channel.markupType, channel.markupValue)}
                    </p>
                  </div>
                  <ActiveToggle
                    id={channel.id}
                    isActive={channel.isActive}
                    onToggle={toggleChannel}
                  />
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-xs">
                  <div className="text-gray-500">
                    <span className="font-semibold text-gray-900">
                      {channel._count.bookings}
                    </span>{" "}
                    {channel._count.bookings === 1 ? "booking" : "bookings"}
                  </div>
                  <div className="text-right">
                    {lastSync ? (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">
                          {titleCase(lastSync.type)} · {fmtDateTime(lastSync.startedAt)}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full font-medium ${syncStatusBadge[lastSync.status].className}`}
                        >
                          {syncStatusBadge[lastSync.status].label}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-300">No syncs yet</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sync logs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-medium text-gray-900">Recent sync activity</h2>
        </div>
        {recentSyncLogs.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">
            No sync activity yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-5 py-2.5 font-medium text-gray-400 text-xs">Channel</th>
                  <th className="px-3 py-2.5 font-medium text-gray-400 text-xs">Type</th>
                  <th className="px-3 py-2.5 font-medium text-gray-400 text-xs">Direction</th>
                  <th className="px-3 py-2.5 font-medium text-gray-400 text-xs">Status</th>
                  <th className="px-3 py-2.5 font-medium text-gray-400 text-xs">Date range</th>
                  <th className="px-3 py-2.5 font-medium text-gray-400 text-xs">Started</th>
                  <th className="px-5 py-2.5 font-medium text-gray-400 text-xs">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentSyncLogs.map((log) => {
                  const status = syncStatusBadge[log.status];
                  return (
                    <tr key={log.id}>
                      <td className="px-5 py-2.5 text-gray-900">
                        {log.channel.name || channelTypeLabel[log.channel.type]}
                      </td>
                      <td className="px-3 py-2.5 text-gray-600">{titleCase(log.type)}</td>
                      <td className="px-3 py-2.5 text-gray-600">{titleCase(log.direction)}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                        {log.dateFrom && log.dateTo
                          ? `${fmtDate(log.dateFrom)} – ${fmtDate(log.dateTo)}`
                          : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                        {fmtDateTime(log.startedAt)}
                      </td>
                      <td className="px-5 py-2.5 text-gray-400 max-w-[16rem] truncate">
                        {log.error
                          ? log.error.length > 48
                            ? `${log.error.slice(0, 48)}…`
                            : log.error
                          : "—"}
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
  );
}
