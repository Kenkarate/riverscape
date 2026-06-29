"use client";

import { useState, useTransition } from "react";
import { FileText, Loader2 } from "lucide-react";
import { generateInvoice } from "@/app/(admin)/admin/bookings/[ref]/actions";

interface Props {
  bookingId: string;
}

export default function GenerateInvoiceButton({ bookingId }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        await generateInvoice(bookingId);
        // revalidatePath in the action re-renders this page with the invoice section.
      } catch {
        setError("Could not generate invoice. Try again.");
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={handleClick}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-[#1a3a2a] text-white rounded-lg hover:bg-[#14301f] disabled:opacity-50 transition-colors"
      >
        {isPending ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
        Generate Invoice
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
