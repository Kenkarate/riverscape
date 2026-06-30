"use client";

import { signOut } from "next-auth/react";
import { LogOut, Menu, User } from "lucide-react";
import UserColorPicker from "@/components/admin/user-color-picker";
import { useMobileNav } from "@/components/admin/mobile-nav-context";

interface TopbarProps {
  user: {
    name?: string | null;
    email?: string | null;
    role?: string | null;
  };
  salesColor?: string | null;
  colorLocked?: boolean;
}

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  STAFF: "Staff",
  SALES: "Sales",
};

export default function AdminTopbar({ user, salesColor, colorLocked = false }: TopbarProps) {
  const { toggle } = useMobileNav();

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 shrink-0">
      <div className="flex items-center">
        <button
          type="button"
          onClick={toggle}
          aria-label="Open menu"
          className="lg:hidden -ml-1 p-2 rounded-md text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <Menu size={20} />
        </button>
      </div>
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <User size={15} className="text-gray-400 shrink-0" />
          <span className="hidden sm:inline max-w-[140px] truncate">
            {user.name ?? user.email}
          </span>
          <span className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full whitespace-nowrap">
            {roleLabels[user.role ?? "STAFF"] ?? user.role}
          </span>
        </div>
        <UserColorPicker initialColor={salesColor ?? null} locked={colorLocked} />
        <button
          onClick={() => signOut({ callbackUrl: "/admin/login" })}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors"
          aria-label="Sign out"
        >
          <LogOut size={15} className="shrink-0" />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  );
}
