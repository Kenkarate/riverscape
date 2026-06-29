"use client";

import { signOut } from "next-auth/react";
import { LogOut, User } from "lucide-react";

interface TopbarProps {
  user: {
    name?: string | null;
    email?: string | null;
    role?: string | null;
  };
}

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  STAFF: "Staff",
};

export default function AdminTopbar({ user }: TopbarProps) {
  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
      <div />
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <User size={15} className="text-gray-400" />
          <span>{user.name ?? user.email}</span>
          <span className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full">
            {roleLabels[user.role ?? "STAFF"] ?? user.role}
          </span>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/admin/login" })}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </header>
  );
}
