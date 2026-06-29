"use client";

import { useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { resolveMaintenanceBlock } from "@/app/(admin)/admin/rooms/actions";

interface Props {
  blockId: string;
}

export default function MaintenanceBlockResolve({ blockId }: Props) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => resolveMaintenanceBlock(blockId))}
      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-white hover:text-green-700 disabled:opacity-50 transition-colors"
      aria-label="Resolve maintenance block"
    >
      {isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
      Resolve
    </button>
  );
}
