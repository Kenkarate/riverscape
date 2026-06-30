"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { deleteBooking } from "@/app/(admin)/admin/bookings/[ref]/actions";

interface Props {
  bookingId: string;
  bookingRef: string;
  /** Where to navigate after a successful delete. Omit to refresh in place. */
  redirectTo?: string;
  /** Compact icon-only variant for table rows. */
  compact?: boolean;
}

export default function DeleteBookingButton({
  bookingId,
  bookingRef,
  redirectTo,
  compact = false,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    setError(null);
    const ok = window.confirm(
      `Permanently delete booking ${bookingRef}? This removes its rooms, payments and history and cannot be undone.`
    );
    if (!ok) return;

    startTransition(async () => {
      const res = await deleteBooking(bookingId);
      if (res.success) {
        if (redirectTo) {
          router.push(redirectTo);
        } else {
          router.refresh();
        }
      } else {
        const message = res.error ?? "Could not delete the booking.";
        setError(message);
        // Table rows have no room for inline text — surface the reason directly.
        if (compact) window.alert(message);
      }
    });
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        title="Delete booking"
        aria-label={`Delete booking ${bookingRef}`}
        className="inline-flex items-center justify-center p-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50 transition-colors"
      >
        {isPending ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <Trash2 size={13} />
        )}
      </button>
    );
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
      >
        {isPending ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <Trash2 size={13} />
        )}
        Delete
      </button>
      {error && (
        <span className="text-[11px] text-red-600 text-right max-w-[220px] leading-tight">
          {error}
        </span>
      )}
    </div>
  );
}
