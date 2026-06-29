"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import RatePlanForm from "./rate-plan-form";
import type { MealPlan } from "@prisma/client";

interface EditRatePlanPanelProps {
  plan: {
    id: string;
    name: string;
    roomTypeId: string | null;
    mealPlan: MealPlan;
    basePrice: number;
    extraAdultPrice: number;
    extraChildWithBed: number;
    extraChildNoBed: number;
    minStay: number;
    maxStay: number | null;
  };
  roomTypes: { id: string; name: string }[];
}

export default function EditRatePlanPanel({ plan, roomTypes }: EditRatePlanPanelProps) {
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
    <div className="mt-2 w-full">
      <RatePlanForm
        roomTypes={roomTypes}
        plan={plan}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
