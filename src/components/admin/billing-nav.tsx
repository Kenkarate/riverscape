"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/admin/billing", label: "Dashboard", exact: true },
  { href: "/admin/billing/folios", label: "Folios", exact: false },
];

// Phase 2 sections — shown as disabled chips so the roadmap is visible.
const soon = ["City Ledger", "Credit Notes", "Reports"];

export default function BillingNav() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tabs.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "px-3 py-1.5 text-sm rounded-lg transition-colors",
              active
                ? "bg-[#1a3a2a] text-white font-medium"
                : "border border-gray-200 text-gray-600 hover:bg-gray-50"
            )}
          >
            {t.label}
          </Link>
        );
      })}
      {soon.map((s) => (
        <span
          key={s}
          title="Coming in Phase 2"
          className="px-3 py-1.5 text-sm rounded-lg border border-dashed border-gray-200 text-gray-300 cursor-not-allowed select-none"
        >
          {s}
        </span>
      ))}
    </div>
  );
}
