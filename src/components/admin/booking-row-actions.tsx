"use client";

import { useTransition } from "react";
import { Loader2, LogIn, LogOut } from "lucide-react";
import {
  checkInBooking,
  checkOutBooking,
} from "@/app/(admin)/admin/bookings/[ref]/actions";
import type { BookingStatus } from "@prisma/client";

interface Props {
  bookingId: string;
  status: BookingStatus;
}

/**
 * Inline Check In / Check Out buttons for a bookings-list row so staff can run
 * routine front-desk operations without opening the full booking detail page.
 */
export default function BookingRowActions({ bookingId, status }: Props) {
  const [isPending, startTransition] = useTransition();

  if (status === "CONFIRMED") {
    return (
      <button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(() => checkInBooking(bookingId))}
        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
      >
        {isPending ? <Loader2 size={12} className="animate-spin" /> : <LogIn size={12} />}
        Check In
      </button>
    );
  }

  if (status === "CHECKED_IN") {
    return (
      <button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(() => checkOutBooking(bookingId))}
        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-[#1a3a2a] text-white rounded-lg hover:bg-[#14301f] disabled:opacity-50 transition-colors whitespace-nowrap"
      >
        {isPending ? <Loader2 size={12} className="animate-spin" /> : <LogOut size={12} />}
        Check Out
      </button>
    );
  }

  return <span className="text-xs text-gray-300">—</span>;
}
