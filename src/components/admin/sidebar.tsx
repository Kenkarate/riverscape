"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  LayoutDashboard,
  LayoutGrid,
  BookOpen,
  Building2,
  BarChart3,
  Globe,
  Settings,
  Percent,
  Users,
  Sparkles,
  ClipboardList,
  UserCog,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMobileNav } from "@/components/admin/mobile-nav-context";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, roles: ["SALES", "STAFF", "ADMIN", "SUPER_ADMIN"] },
  { href: "/admin/room-rack", label: "Allocation & Rack", icon: LayoutGrid, roles: ["SALES", "STAFF", "ADMIN", "SUPER_ADMIN"] },
  { href: "/admin/bookings", label: "Bookings", icon: BookOpen, roles: ["STAFF", "ADMIN", "SUPER_ADMIN"] },
  { href: "/admin/guests", label: "Guests", icon: Users, roles: ["STAFF", "ADMIN", "SUPER_ADMIN"] },
  { href: "/admin/rooms", label: "Rooms", icon: Building2, roles: ["STAFF", "ADMIN", "SUPER_ADMIN"] },
  { href: "/admin/housekeeping", label: "Housekeeping", icon: Sparkles, roles: ["STAFF", "ADMIN", "SUPER_ADMIN"] },
  { href: "/admin/rates", label: "Rate Plans", icon: Percent, roles: ["ADMIN", "SUPER_ADMIN"] },
  { href: "/admin/channels", label: "Channels", icon: Globe, roles: ["ADMIN", "SUPER_ADMIN"] },
  { href: "/admin/reports", label: "Reports", icon: BarChart3, roles: ["ADMIN", "SUPER_ADMIN"] },
  { href: "/admin/audit", label: "Audit Log", icon: ClipboardList, roles: ["ADMIN", "SUPER_ADMIN"] },
  { href: "/admin/settings", label: "Settings", icon: Settings, roles: ["SUPER_ADMIN"] },
  { href: "/admin/staff", label: "Staff", icon: UserCog, roles: ["SUPER_ADMIN"] },
];

interface AdminSidebarProps {
  role?: string | null;
  /** Number of SALES accounts awaiting approval — shown as a red badge on Staff. */
  pendingCount?: number;
}

function SidebarNav({
  role,
  pendingCount,
  onNavigate,
}: {
  role?: string | null;
  pendingCount: number;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const visible = navItems.filter((item) => item.roles.includes(role ?? "STAFF"));

  return (
    <nav className="flex-1 py-4 space-y-0.5 px-2 overflow-y-auto">
      {visible.map((item) => {
        const Icon = item.icon;
        const active =
          item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        const showBadge = item.href === "/admin/staff" && pendingCount > 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
              active
                ? "bg-white/15 text-white font-medium"
                : "text-white/70 hover:bg-white/10 hover:text-white"
            )}
          >
            <Icon size={16} />
            <span className="flex-1">{item.label}</span>
            {showBadge && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold leading-none">
                {pendingCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export default function AdminSidebar({ role, pendingCount = 0 }: AdminSidebarProps) {
  const { isOpen, close } = useMobileNav();
  const pathname = usePathname();

  // Auto-close the mobile drawer whenever the route changes.
  useEffect(() => {
    close();
  }, [pathname, close]);

  return (
    <>
      {/* ─── Desktop sidebar (static) ──────────────────────────────────────── */}
      <aside className="hidden lg:flex w-56 bg-[#1a3a2a] text-white flex-col shrink-0">
        <div className="px-5 py-5 border-b border-white/10">
          <span className="font-serif text-lg font-semibold">Riverscape</span>
          <span className="block text-xs text-white/50 mt-0.5">Admin Portal</span>
        </div>
        <SidebarNav role={role} pendingCount={pendingCount} />
        <div className="px-5 py-4 border-t border-white/10 text-xs text-white/40">
          Riverscape PMS v1.0
        </div>
      </aside>

      {/* ─── Mobile drawer ─────────────────────────────────────────────────── */}
      <div
        className={cn("fixed inset-0 z-50 lg:hidden", isOpen ? "" : "pointer-events-none")}
        aria-hidden={!isOpen}
      >
        {/* Backdrop */}
        <div
          onClick={close}
          className={cn(
            "absolute inset-0 bg-black/50 transition-opacity duration-200",
            isOpen ? "opacity-100" : "opacity-0"
          )}
        />
        {/* Panel */}
        <aside
          className={cn(
            "absolute left-0 top-0 h-full w-64 max-w-[80vw] bg-[#1a3a2a] text-white flex flex-col shadow-xl transition-transform duration-200 ease-out",
            isOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
            <div>
              <span className="font-serif text-lg font-semibold">Riverscape</span>
              <span className="block text-xs text-white/50 mt-0.5">Admin Portal</span>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Close menu"
              className="text-white/70 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>
          <SidebarNav role={role} pendingCount={pendingCount} onNavigate={close} />
          <div className="px-5 py-4 border-t border-white/10 text-xs text-white/40">
            Riverscape PMS v1.0
          </div>
        </aside>
      </div>
    </>
  );
}
