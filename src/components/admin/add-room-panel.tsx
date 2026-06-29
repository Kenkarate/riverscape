"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import RoomForm from "./room-form";

interface AddRoomPanelProps {
  roomTypes: { id: string; name: string }[];
}

export default function AddRoomPanel({ roomTypes }: AddRoomPanelProps) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#1a3a2a] text-white rounded-lg hover:bg-[#14301f] transition-colors"
        >
          <Plus size={16} />
          Add Room
        </button>
      </div>
    );
  }

  return <RoomForm roomTypes={roomTypes} onClose={() => setOpen(false)} />;
}
