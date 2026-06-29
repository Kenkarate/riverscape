"use client";

import { Printer } from "lucide-react";

interface Props {
  label?: string;
  className?: string;
}

export default function PrintButton({ label = "Print / Save PDF", className }: Props) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={
        className ??
        "no-print inline-flex items-center gap-2 px-4 py-2 text-sm bg-[#1a3a2a] text-white rounded-lg hover:bg-[#14301f] transition-colors"
      }
    >
      <Printer size={15} />
      {label}
    </button>
  );
}
