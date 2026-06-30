"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { recordFolioPayment } from "@/app/(admin)/admin/billing/actions";
import { FOLIO_PAYMENT_METHODS } from "@/lib/badges";

const inputClass =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]/30 bg-white";
const labelClass = "block text-xs font-medium text-gray-500 mb-1";

interface Props {
  bookingId: string;
  /** POS balance due in paise — used to pre-fill the amount. */
  posBalance: number;
}

export default function RecordFolioPaymentForm({ bookingId, posBalance }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState<string>(posBalance > 0 ? String(posBalance / 100) : "");
  const [method, setMethod] = useState<string>("Cash");
  const [direction, setDirection] = useState<"PAYMENT" | "REFUND">("PAYMENT");
  const [reference, setReference] = useState("");

  function handleSubmit() {
    setError(null);
    const value = Number(amount);
    if (Number.isNaN(value) || value <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    startTransition(async () => {
      const res = await recordFolioPayment({
        bookingId,
        amountRupees: value,
        method,
        reference: reference.trim() || null,
        direction,
      });
      if (res.success) {
        setAmount("");
        setReference("");
        router.refresh();
      } else {
        setError(res.error ?? "Could not record the payment.");
      }
    });
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="font-medium text-gray-900 text-sm mb-4">Record Folio Payment</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className={labelClass}>Amount (₹)</label>
          <input
            type="number"
            min={0}
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Type</label>
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as "PAYMENT" | "REFUND")}
            className={inputClass}
          >
            <option value="PAYMENT">Payment</option>
            <option value="REFUND">Refund</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Method</label>
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputClass}>
            {FOLIO_PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Reference</label>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Optional"
            className={inputClass}
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

      <div className="mt-4">
        <button
          type="button"
          disabled={isPending}
          onClick={handleSubmit}
          className={cn(
            "inline-flex items-center gap-2 px-4 py-2 text-sm text-white rounded-lg transition-colors disabled:opacity-50",
            direction === "REFUND" ? "bg-rose-600 hover:bg-rose-700" : "bg-[#1a3a2a] hover:bg-[#14301f]"
          )}
        >
          {isPending && <Loader2 size={15} className="animate-spin" />}
          {direction === "REFUND" ? "Record Refund" : "Record Payment"}
        </button>
      </div>
    </div>
  );
}
