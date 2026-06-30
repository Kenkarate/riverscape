"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const PRESETS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last7", label: "Last 7 Days" },
  { key: "last30", label: "Last 30 Days" },
  { key: "thisMonth", label: "This Month" },
  { key: "lastMonth", label: "Last Month" },
];

export default function DashboardDateFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = searchParams.get("range") ?? "today";

  return (
    <div className="flex flex-wrap gap-2">
      {PRESETS.map((p) => (
        <button
          key={p.key}
          onClick={() => router.push(`/admin?range=${p.key}`)}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
            active === p.key
              ? "bg-[#1a3a2a] text-white"
              : "bg-white border border-gray-200 text-gray-600 hover:border-[#1a3a2a]/40 hover:text-[#1a3a2a]"
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
