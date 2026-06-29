"use client";

import { useState, useTransition } from "react";
import { Ban, Loader2 } from "lucide-react";
import { deactivateStaffUser } from "@/app/(admin)/admin/staff/actions";

interface Props {
  userId: string;
  userName: string;
  disabled?: boolean;
}

export default function DeactivateStaffButton({ userId, userName, disabled }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    const confirmed = window.confirm(
      `Deactivate ${userName}? They will lose all admin access (role set to Guest).`
    );
    if (!confirmed) return;

    setError(null);
    startTransition(async () => {
      try {
        await deactivateStaffUser(userId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not deactivate user.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        disabled={disabled || isPending}
        onClick={handleClick}
        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <Ban size={13} />
        )}
        Deactivate
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
