"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import RoomTypeForm from "./room-type-form";

export default function AddRoomTypePanel() {
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
          Add Room Type
        </button>
      </div>
    );
  }

  return <RoomTypeForm onClose={() => setOpen(false)} />;
}
