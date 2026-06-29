"use client";

import { useTransition } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { deleteRateOverride } from "@/app/(admin)/admin/rates/actions";

interface Props {
  ratePlanId: string;
  date: string; // YYYY-MM-DD
}

export default function RateOverrideDelete({ ratePlanId, date }: Props) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => deleteRateOverride(ratePlanId, date))}
      className="text-gray-300 hover:text-red-500 disabled:opacity-50 transition-colors"
      aria-label="Delete override"
    >
      {isPending ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
    </button>
  );
}
