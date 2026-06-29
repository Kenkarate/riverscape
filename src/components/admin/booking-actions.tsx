"use client";

import { useTransition, useState } from "react";
import {
  checkInBooking,
  checkOutBooking,
  cancelBooking,
  confirmBooking,
  markNoShow,
} from "@/app/(admin)/admin/bookings/[ref]/actions";
import type { BookingStatus } from "@prisma/client";

interface Props {
  bookingId: string;
  status: BookingStatus;
}

export default function BookingActions({ bookingId, status }: Props) {
  const [isPending, startTransition] = useTransition();
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  if (status === "CHECKED_OUT" || status === "CANCELLED" || status === "NO_SHOW") {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "PENDING" && (
        <button
          disabled={isPending}
          onClick={() => startTransition(() => confirmBooking(bookingId))}
          className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          Confirm
        </button>
      )}
      {status === "CONFIRMED" && (
        <button
          disabled={isPending}
          onClick={() => startTransition(() => checkInBooking(bookingId))}
          className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          Check In
        </button>
      )}
      {status === "CONFIRMED" && (
        <button
          disabled={isPending}
          onClick={() => startTransition(() => markNoShow(bookingId))}
          className="px-3 py-1.5 text-xs bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors"
        >
          No Show
        </button>
      )}
      {status === "CHECKED_IN" && (
        <button
          disabled={isPending}
          onClick={() => startTransition(() => checkOutBooking(bookingId))}
          className="px-3 py-1.5 text-xs bg-[#1a3a2a] text-white rounded-lg hover:bg-[#14301f] disabled:opacity-50 transition-colors"
        >
          Check Out
        </button>
      )}
      {(status === "PENDING" || status === "CONFIRMED") && !showCancel && (
        <button
          disabled={isPending}
          onClick={() => setShowCancel(true)}
          className="px-3 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
        >
          Cancel
        </button>
      )}
      {showCancel && (
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Cancellation reason (optional)"
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs w-56 focus:outline-none focus:ring-2 focus:ring-red-200"
          />
          <button
            disabled={isPending}
            onClick={() =>
              startTransition(() => cancelBooking(bookingId, cancelReason))
            }
            className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            Confirm Cancel
          </button>
          <button
            onClick={() => setShowCancel(false)}
            className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
          >
            Back
          </button>
        </div>
      )}
    </div>
  );
}
