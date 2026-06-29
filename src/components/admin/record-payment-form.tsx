"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { recordPayment } from "@/app/(admin)/admin/bookings/[ref]/actions";
import type { PaymentType } from "@prisma/client";

const inputClass =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]/30 bg-white";
const labelClass = "block text-xs font-medium text-gray-500 mb-1";

const PAYMENT_TYPES: PaymentType[] = ["ADVANCE", "BALANCE", "FULL"];
const METHODS = ["Cash", "Card", "UPI", "Bank Transfer"];

interface Props {
  bookingId: string;
  /** Balance due in paise — used to pre-fill the amount. */
  balanceDue: number;
}

export default function RecordPaymentForm({ bookingId, balanceDue }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState<string>(String(balanceDue / 100));
  const [type, setType] = useState<PaymentType>("BALANCE");
  const [method, setMethod] = useState<string>("Cash");

  function handleSubmit() {
    setError(null);
    const value = Number(amount);
    if (Number.isNaN(value) || value <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    startTransition(async () => {
      try {
        await recordPayment(bookingId, value, method, type);
        // revalidatePath in the action refreshes the page with the new totals.
      } catch {
        setError("Could not record payment. Try again.");
      }
    });
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="font-medium text-gray-900 text-sm mb-4">Record Payment</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            value={type}
            onChange={(e) => setType(e.target.value as PaymentType)}
            className={inputClass}
          >
            {PAYMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0) + t.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Method</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className={inputClass}
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

      <div className="mt-4">
        <button
          type="button"
          disabled={isPending}
          onClick={handleSubmit}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-[#1a3a2a] text-white rounded-lg hover:bg-[#14301f] disabled:opacity-50 transition-colors"
        >
          {isPending && <Loader2 size={15} className="animate-spin" />}
          Record Payment
        </button>
      </div>
    </div>
  );
}
