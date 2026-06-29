"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import RoomTypeForm from "./room-type-form";

interface EditRoomTypePanelProps {
  roomType: {
    id: string;
    name: string;
    slug: string;
    description: string;
    basePrice: number; // paise
    baseOccupancy: number;
    maxAdults: number;
    maxChildren: number;
    extraBedAllowed: boolean;
    maxExtraBeds: number;
  };
}

export default function EditRoomTypePanel({ roomType }: EditRoomTypePanelProps) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
        aria-label={`Edit ${roomType.name}`}
      >
        <Pencil size={13} />
        Edit
      </button>
    );
  }

  return (
    <div className="w-full">
      <RoomTypeForm roomType={roomType} onClose={() => setOpen(false)} />
    </div>
  );
}
