"use client";

import { useTransition } from "react";
import type { HousekeepingStatus } from "@prisma/client";
import { HOUSEKEEPING_OPTIONS, housekeepingBadge } from "@/lib/badges";
import { updateHousekeepingStatus } from "@/app/(admin)/admin/rooms/actions";

interface Props {
  roomId: string;
  current: HousekeepingStatus;
}

export default function HousekeepingSelect({ roomId, current }: Props) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      value={current}
      disabled={isPending}
      onChange={(e) => {
        const next = e.target.value as HousekeepingStatus;
        startTransition(() => updateHousekeepingStatus(roomId, next));
      }}
      className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]/30 disabled:opacity-50 disabled:cursor-wait bg-white"
    >
      {HOUSEKEEPING_OPTIONS.map((s) => (
        <option key={s} value={s}>
          {housekeepingBadge[s].label}
        </option>
      ))}
    </select>
  );
}
