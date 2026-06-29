"use client";

import { useState, useTransition } from "react";
import { Plus, X, Loader2 } from "lucide-react";
import { upsertRateOverride } from "@/app/(admin)/admin/rates/actions";
import type { RateOverrideType } from "@prisma/client";

const inputClass =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]/30 bg-white";
const labelClass = "block text-xs font-medium text-gray-500 mb-1";

const TYPE_OPTIONS: { value: RateOverrideType; label: string }[] = [
  { value: "DATE_RANGE", label: "Override" },
  { value: "WEEKEND", label: "Weekend" },
  { value: "SEASONAL", label: "Seasonal" },
];

interface Props {
  ratePlanId: string;
}

export default function RateOverrideForm({ ratePlanId }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [date, setDate] = useState("");
  const [price, setPrice] = useState("");
  const [type, setType] = useState<RateOverrideType>("DATE_RANGE");
  const [stopSell, setStopSell] = useState(false);
  const [cta, setCta] = useState(false);
  const [ctd, setCtd] = useState(false);

  function reset() {
    setDate("");
    setPrice("");
    setType("DATE_RANGE");
    setStopSell(false);
    setCta(false);
    setCtd(false);
  }

  function handleSave() {
    setError(null);
    if (!date) {
      setError("Select a date.");
      return;
    }
    const value = Number(price);
    if (Number.isNaN(value) || value < 0) {
      setError("Enter a valid price.");
      return;
    }
    startTransition(async () => {
      const res = await upsertRateOverride(ratePlanId, date, value, type, stopSell, cta, ctd);
      if (res?.ok) {
        reset();
        setOpen(false);
      } else {
        setError(res?.message ?? "Could not save override.");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
      >
        <Plus size={13} />
        Add override
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50/50 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-gray-700">New date override</h4>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          <X size={15} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Price (₹)</label>
          <input
            type="number"
            min={0}
            step="1"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as RateOverrideType)}
            className={inputClass}
          >
            {TYPE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={stopSell}
            onChange={(e) => setStopSell(e.target.checked)}
            className="accent-[#1a3a2a]"
          />
          Stop Sell
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={cta}
            onChange={(e) => setCta(e.target.checked)}
            className="accent-[#1a3a2a]"
          />
          Closed to Arrival
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={ctd}
            onChange={(e) => setCtd(e.target.checked)}
            className="accent-[#1a3a2a]"
          />
          Closed to Departure
        </label>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={handleSave}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#1a3a2a] text-white rounded-lg hover:bg-[#14301f] disabled:opacity-50 transition-colors"
        >
          {isPending && <Loader2 size={12} className="animate-spin" />}
          Save override
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
