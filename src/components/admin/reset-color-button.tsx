"use client";

import { useState, useTransition } from "react";
import { RotateCcw, Loader2 } from "lucide-react";
import { resetUserColor } from "@/app/(admin)/admin/staff/actions";

interface Props {
  userId: string;
  userName: string;
}

export default function ResetColorButton({ userId, userName }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    const confirmed = window.confirm(
      `Reset ${userName}'s allocation color? They will be able to pick a new one.`
    );
    if (!confirmed) return;
    setError(null);
    startTransition(async () => {
      try {
        await resetUserColor(userId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not reset color.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 transition-colors"
      >
        {isPending ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <RotateCcw size={13} />
        )}
        Reset Color
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
