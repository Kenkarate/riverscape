"use client";

import { useState, useEffect, useTransition } from "react";
import { Loader2 } from "lucide-react";
import {
  getAvailableRooms,
  assignRoom,
} from "@/app/(admin)/admin/bookings/[ref]/actions";
import type { AvailableRoomOption } from "@/types";

interface Props {
  bookingRoomId: string;
  roomTypeId: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
}

export default function RoomAssignSelect({
  bookingRoomId,
  roomTypeId,
  checkIn,
  checkOut,
}: Props) {
  const [rooms, setRooms] = useState<AvailableRoomOption[] | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    getAvailableRooms(roomTypeId, checkIn, checkOut, bookingRoomId)
      .then((r) => {
        if (active) setRooms(r);
      })
      .catch(() => {
        if (active) setRooms([]);
      });
    return () => {
      active = false;
    };
  }, [roomTypeId, checkIn, checkOut, bookingRoomId]);

  function handleAssign() {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      try {
        await assignRoom(bookingRoomId, selected);
        // revalidatePath in the action refreshes the page with the assigned room.
      } catch {
        setError("Could not assign room. Try again.");
      }
    });
  }

  if (rooms === null) {
    return (
      <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-400">
        <Loader2 size={13} className="animate-spin" /> Loading available rooms…
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <p className="mt-2 text-xs text-amber-600">
        No free rooms of this type for these dates.
      </p>
    );
  }

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]/30 bg-white"
        >
          <option value="">Select a room…</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              Room {r.number}
              {r.floor ? ` · Floor ${r.floor}` : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!selected || isPending}
          onClick={handleAssign}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#1a3a2a] text-white rounded-lg hover:bg-[#14301f] disabled:opacity-50 transition-colors"
        >
          {isPending && <Loader2 size={12} className="animate-spin" />}
          Assign
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}
