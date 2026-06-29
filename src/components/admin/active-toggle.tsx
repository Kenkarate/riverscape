"use client";

import { useTransition } from "react";
import { cn } from "@/lib/utils";

interface Props {
  id: string;
  isActive: boolean;
  onToggle: (id: string, isActive: boolean) => Promise<void>;
}

export default function ActiveToggle({ id, isActive, onToggle }: Props) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await onToggle(id, !isActive);
        })
      }
      className={cn(
        "text-xs px-2.5 py-1 rounded-full font-medium transition-colors disabled:opacity-50 disabled:cursor-wait",
        isActive
          ? "bg-green-100 text-green-700 hover:bg-green-200"
          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
      )}
    >
      {isPending ? "…" : isActive ? "Active" : "Inactive"}
    </button>
  );
}
