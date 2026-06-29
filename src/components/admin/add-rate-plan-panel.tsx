"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import RatePlanForm from "./rate-plan-form";

interface AddRatePlanPanelProps {
  roomTypes: { id: string; name: string }[];
}

export default function AddRatePlanPanel({ roomTypes }: AddRatePlanPanelProps) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#1a3a2a] text-white rounded-lg hover:bg-[#14301f] transition-colors"
      >
        <Plus size={16} />
        Add Rate Plan
      </button>
    );
  }

  return <RatePlanForm roomTypes={roomTypes} onClose={() => setOpen(false)} />;
}
