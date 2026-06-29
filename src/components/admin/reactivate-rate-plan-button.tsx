"use client";

import { useState, useTransition } from "react";
import { RotateCcw, Loader2 } from "lucide-react";
import { reactivateRatePlan } from "@/app/(admin)/admin/rates/actions";

interface Props {
  ratePlanId: string;
}

export default function ReactivateRatePlanButton({ ratePlanId }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        await reactivateRatePlan(ratePlanId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not reactivate rate plan.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        disabled={isPending}
        onClick={handleClick}
        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-green-50 hover:text-green-700 hover:border-green-200 disabled:opacity-50 transition-colors"
      >
        {isPending ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <RotateCcw size={13} />
        )}
        Reactivate
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
