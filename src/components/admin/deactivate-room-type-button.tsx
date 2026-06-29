"use client";

import { useState, useTransition } from "react";
import { Ban, Loader2 } from "lucide-react";
import { deactivateRoomType } from "@/app/(admin)/admin/rooms/actions";

interface Props {
  roomTypeId: string;
  roomTypeName: string;
}

export default function DeactivateRoomTypeButton({
  roomTypeId,
  roomTypeName,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    const confirmed = window.confirm(
      `Deactivate "${roomTypeName}"? It will be hidden from the system and can no longer be assigned to new rooms or bookings until reactivated.`
    );
    if (!confirmed) return;

    setError(null);
    startTransition(async () => {
      try {
        await deactivateRoomType(roomTypeId);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Could not deactivate room type."
        );
      }
    });
  }

  return (
    <div className="flex flex-col items-start">
      <button
        type="button"
        disabled={isPending}
        onClick={handleClick}
        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200 disabled:opacity-50 transition-colors"
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
