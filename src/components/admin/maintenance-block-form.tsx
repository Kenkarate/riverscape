"use client";

import { useState, useTransition } from "react";
import { Wrench, X, Loader2 } from "lucide-react";
import { createMaintenanceBlock } from "@/app/(admin)/admin/rooms/actions";

const inputClass =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]/30 bg-white";
const labelClass = "block text-xs font-medium text-gray-500 mb-1";

interface Props {
  roomId: string;
}

export default function MaintenanceBlockForm({ roomId }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [reason, setReason] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  function reset() {
    setReason("");
    setStartDate("");
    setEndDate("");
  }

  function handleSave() {
    setError(null);
    if (!reason.trim()) {
      setError("Enter a reason.");
      return;
    }
    if (!startDate || !endDate) {
      setError("Select start and end dates.");
      return;
    }
    if (endDate < startDate) {
      setError("End date must be on or after the start date.");
      return;
    }
    startTransition(async () => {
      try {
        await createMaintenanceBlock(roomId, reason.trim(), startDate, endDate);
        reset();
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not add maintenance block.");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
      >
        <Wrench size={13} />
        Add maintenance block
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50/50 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-gray-700">New maintenance block</h4>
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
        <div className="sm:col-span-1">
          <label className={labelClass}>Reason</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Plumbing repair"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Start date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>End date</label>
          <input
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
            className={inputClass}
          />
        </div>
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
          Save block
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
