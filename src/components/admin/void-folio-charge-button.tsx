"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { voidFolioCharge } from "@/app/(admin)/admin/billing/actions";

interface Props {
  chargeId: string;
}

/**
 * Admin-only inline action to void a posted POS charge. Confirms before firing.
 */
export default function VoidFolioChargeButton({ chargeId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function handleVoid() {
    startTransition(async () => {
      const res = await voidFolioCharge(chargeId);
      if (res.success) {
        router.refresh();
      } else {
        setConfirming(false);
        alert(res.error ?? "Could not void the charge.");
      }
    });
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <button
          type="button"
          onClick={handleVoid}
          disabled={isPending}
          className="inline-flex items-center gap-1 text-xs text-red-600 font-medium hover:text-red-700 disabled:opacity-50"
        >
          {isPending && <Loader2 size={12} className="animate-spin" />}
          Confirm void
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      title="Void charge"
      className="text-gray-300 hover:text-red-600 transition-colors"
    >
      <Trash2 size={14} />
    </button>
  );
}
