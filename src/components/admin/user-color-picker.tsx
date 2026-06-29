"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SALES_COLOR_PALETTE, SALES_COLOR_DEFAULT } from "@/lib/sales-colors";
import { updateUserColor } from "@/app/(admin)/admin/allocation/actions";

interface Props {
  initialColor: string | null;
}

export default function UserColorPicker({ initialColor }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState<string | null>(initialColor);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function pick(hex: string) {
    setColor(hex); // optimistic
    startTransition(async () => {
      try {
        await updateUserColor(hex);
        router.refresh();
      } catch {
        setColor(initialColor); // revert on failure
      }
    });
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Your allocation color"
        aria-label="Choose your allocation color"
        className="flex items-center justify-center w-7 h-7 rounded-full hover:ring-2 hover:ring-gray-200 transition-shadow"
      >
        {isPending ? (
          <Loader2 size={14} className="animate-spin text-gray-400" />
        ) : (
          <span
            className="w-4 h-4 rounded-full inline-block ring-1 ring-black/10"
            style={{ backgroundColor: color ?? SALES_COLOR_DEFAULT }}
          />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-44">
          <p className="text-xs font-medium text-gray-500 mb-2">My color</p>
          <div className="grid grid-cols-5 gap-2">
            {SALES_COLOR_PALETTE.map((hex) => {
              const active = color?.toLowerCase() === hex.toLowerCase();
              return (
                <button
                  key={hex}
                  type="button"
                  onClick={() => pick(hex)}
                  aria-label={`Set color ${hex}`}
                  title={hex}
                  className={cn(
                    "w-6 h-6 rounded-full inline-flex items-center justify-center transition-transform hover:scale-110",
                    active ? "ring-2 ring-offset-1 ring-gray-800" : "ring-1 ring-black/10"
                  )}
                  style={{ backgroundColor: hex }}
                >
                  {active && <Check size={12} className="text-white" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
