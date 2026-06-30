"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { deleteGuest } from "@/app/(admin)/admin/guests/actions";

interface Props {
  guestId: string;
  guestName: string;
  /** Optional label override (defaults to "Delete"). */
  label?: string;
  /** Where to send the user after a successful delete. Defaults to a refresh. */
  redirectTo?: string;
}

export default function DeleteGuestButton({
  guestId,
  guestName,
  label = "Delete",
  redirectTo,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    setError(null);
    const ok = window.confirm(
      `Delete guest "${guestName}"? This permanently removes their profile and cannot be undone.`
    );
    if (!ok) return;

    startTransition(async () => {
      const res = await deleteGuest(guestId);
      if (res.success) {
        if (redirectTo) {
          router.push(redirectTo);
        } else {
          router.refresh();
        }
      } else {
        setError(res.error ?? "Could not delete the guest.");
      }
    });
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
      >
        {isPending ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <Trash2 size={13} />
        )}
        {label}
      </button>
      {error && (
        <span className="text-[11px] text-red-600 text-right max-w-[180px] leading-tight">
          {error}
        </span>
      )}
    </div>
  );
}
