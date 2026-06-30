"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

interface Props {
  className?: string;
  label?: string;
}

export default function SignOutButton({ className, label = "Sign out" }: Props) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/admin/login" })}
      className={
        className ??
        "inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-colors"
      }
    >
      <LogOut size={15} />
      {label}
    </button>
  );
}
