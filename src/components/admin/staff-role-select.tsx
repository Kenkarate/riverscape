"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { updateStaffRole } from "@/app/(admin)/admin/staff/actions";
import type { Role } from "@prisma/client";

type StaffRole = "SALES" | "STAFF" | "ADMIN" | "SUPER_ADMIN";

interface Props {
  userId: string;
  current: Role;
  disabled?: boolean;
}

export default function StaffRoleSelect({ userId, current, disabled }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState<StaffRole>(current as StaffRole);

  function handleChange(next: StaffRole) {
    if (next === value) return;
    const previous = value;
    setValue(next);
    setError(null);
    startTransition(async () => {
      try {
        await updateStaffRole(userId, next);
      } catch (e) {
        setValue(previous);
        setError(e instanceof Error ? e.message : "Could not update role.");
      }
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={value}
        disabled={disabled || isPending}
        onChange={(e) => handleChange(e.target.value as StaffRole)}
        className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]/30 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option value="SALES">Sales</option>
        <option value="STAFF">Staff</option>
        <option value="ADMIN">Admin</option>
        <option value="SUPER_ADMIN">Super Admin</option>
      </select>
      {isPending && <Loader2 size={13} className="animate-spin text-gray-400" />}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
