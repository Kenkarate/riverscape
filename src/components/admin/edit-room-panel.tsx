"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import RoomForm from "./room-form";

interface EditRoomPanelProps {
  room: {
    id: string;
    number: string;
    floor: string | null;
    notes: string | null;
    roomTypeId: string;
  };
  roomTypes: { id: string; name: string }[];
}

export default function EditRoomPanel({ room, roomTypes }: EditRoomPanelProps) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
      >
        <Pencil size={13} />
        Edit
      </button>
    );
  }

  return (
    <div className="mt-1">
      <RoomForm
        roomTypes={roomTypes}
        room={room}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
