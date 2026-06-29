"use client";

import { useState, useTransition } from "react";
import { Loader2, X } from "lucide-react";
import { createRoom, updateRoom } from "@/app/(admin)/admin/rooms/actions";

const inputClass =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]/30 bg-white";
const labelClass = "block text-xs font-medium text-gray-500 mb-1";

interface RoomFormProps {
  roomTypes: { id: string; name: string }[];
  room?: {
    id: string;
    number: string;
    floor: string | null;
    notes: string | null;
    roomTypeId: string;
  };
  onClose: () => void;
}

export default function RoomForm({ roomTypes, room, onClose }: RoomFormProps) {
  const isEdit = Boolean(room);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [number, setNumber] = useState(room?.number ?? "");
  const [floor, setFloor] = useState(room?.floor ?? "");
  const [notes, setNotes] = useState(room?.notes ?? "");
  const [roomTypeId, setRoomTypeId] = useState(
    room?.roomTypeId ?? roomTypes[0]?.id ?? ""
  );

  function handleSave() {
    setError(null);
    if (!number.trim()) {
      setError("Room number is required.");
      return;
    }
    if (!roomTypeId) {
      setError("Select a room type.");
      return;
    }

    const payload = {
      number: number.trim(),
      floor: floor.trim() || undefined,
      notes: notes.trim() || undefined,
      roomTypeId,
    };

    startTransition(async () => {
      try {
        if (isEdit && room) {
          await updateRoom(room.id, payload);
        } else {
          await createRoom(payload);
        }
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save the room.");
      }
    });
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900 text-sm">
          {isEdit ? `Edit Room ${room?.number}` : "New room"}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="room-number">
            Room number
          </label>
          <input
            id="room-number"
            type="text"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="e.g. 101 or Garden Villa"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="room-floor">
            Floor <span className="text-gray-300">(optional)</span>
          </label>
          <input
            id="room-floor"
            type="text"
            value={floor}
            onChange={(e) => setFloor(e.target.value)}
            placeholder="e.g. Ground"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="room-type">
            Room type
          </label>
          <select
            id="room-type"
            value={roomTypeId}
            onChange={(e) => setRoomTypeId(e.target.value)}
            className={inputClass}
          >
            {roomTypes.length === 0 && <option value="">No room types</option>}
            {roomTypes.map((rt) => (
              <option key={rt.id} value={rt.id}>
                {rt.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="room-notes">
            Notes <span className="text-gray-300">(optional)</span>
          </label>
          <input
            id="room-notes"
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. River-facing"
            className={inputClass}
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={handleSave}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-[#1a3a2a] text-white rounded-lg hover:bg-[#14301f] disabled:opacity-50 transition-colors"
        >
          {isPending && <Loader2 size={14} className="animate-spin" />}
          {isEdit ? "Save changes" : "Create room"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
