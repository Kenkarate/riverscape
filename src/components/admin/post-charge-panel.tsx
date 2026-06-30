"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { postFolioCharge } from "@/app/(admin)/admin/billing/actions";
import { folioDepartmentLabel, FOLIO_POS_DEPARTMENT_OPTIONS } from "@/lib/badges";
import { formatINR } from "@/lib/pricing";

const inputClass =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]/30";
const labelClass = "block text-xs font-medium text-gray-500 mb-1";

const GST_RATES = [0, 5, 12, 18];

interface Props {
  bookingId: string;
}

export default function PostChargePanel({ bookingId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [entered, setEntered] = useState(false);

  const [department, setDepartment] = useState<string>(FOLIO_POS_DEPARTMENT_OPTIONS[0]);
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState("");
  const [gstRate, setGstRate] = useState(0);

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const unit = Number(unitPrice) || 0;
  const subtotalPaise = Math.round(unit * 100) * Math.max(1, quantity);
  const taxPaise = Math.round((subtotalPaise * gstRate) / 100);
  const totalPaise = subtotalPaise + taxPaise;

  function playEnter() {
    setEntered(false);
    requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)));
  }

  function openPanel() {
    setDepartment(FOLIO_POS_DEPARTMENT_OPTIONS[0]);
    setDescription("");
    setQuantity(1);
    setUnitPrice("");
    setGstRate(0);
    setError(null);
    setOpen(true);
    playEnter();
  }

  function closePanel() {
    setEntered(false);
    setTimeout(() => setOpen(false), 200);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!description.trim()) {
      setError("Enter a description.");
      return;
    }
    if (unit <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    startTransition(async () => {
      const res = await postFolioCharge({
        bookingId,
        department,
        description: description.trim(),
        quantity,
        unitPriceRupees: unit,
        gstRate,
      });
      if (res.success) {
        router.refresh();
        closePanel();
      } else {
        setError(res.error ?? "Could not post the charge.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#1a3a2a] text-white rounded-lg hover:bg-[#14301f] transition-colors"
      >
        <Plus size={15} /> Post Charge
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div
            className={cn(
              "absolute inset-0 bg-black/40 transition-opacity duration-200",
              entered ? "opacity-100" : "opacity-0"
            )}
            onClick={closePanel}
            aria-hidden
          />
          <div
            className={cn(
              "absolute bg-white shadow-xl flex flex-col transition-transform duration-200 ease-out",
              "inset-x-0 bottom-0 max-h-[90vh] rounded-t-2xl",
              "sm:inset-x-auto sm:right-0 sm:top-0 sm:bottom-0 sm:h-full sm:max-h-none sm:w-[440px] sm:max-w-full sm:rounded-none",
              entered
                ? "translate-y-0 sm:translate-x-0"
                : "translate-y-full sm:translate-y-0 sm:translate-x-full"
            )}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <h2 className="text-sm font-semibold text-gray-900">Post a Charge</h2>
              <button
                type="button"
                onClick={closePanel}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div>
                <label className={labelClass}>Department</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className={cn(inputClass, "bg-white")}
                >
                  {FOLIO_POS_DEPARTMENT_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {folioDepartmentLabel[d]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Description</label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Ayurvedic massage, Dinner buffet"
                  className={inputClass}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Quantity</label>
                  <input
                    type="number"
                    min={1}
                    max={9999}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Math.round(Number(e.target.value) || 1)))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Unit Price (₹)</label>
                  <input
                    type="number"
                    min={0}
                    step="1"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    placeholder="0"
                    className={inputClass}
                    required
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>GST Rate</label>
                <select
                  value={gstRate}
                  onChange={(e) => setGstRate(Number(e.target.value))}
                  className={cn(inputClass, "bg-white")}
                >
                  {GST_RATES.map((r) => (
                    <option key={r} value={r}>
                      {r}%
                    </option>
                  ))}
                </select>
              </div>

              {/* Live total preview */}
              <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3 space-y-1 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span>
                  <span>{formatINR(subtotalPaise)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>GST ({gstRate}%)</span>
                  <span>{formatINR(taxPaise)}</span>
                </div>
                <div className="flex justify-between font-semibold text-gray-900 border-t border-gray-200 pt-1 mt-1">
                  <span>Total</span>
                  <span>{formatINR(totalPaise)}</span>
                </div>
              </div>

              {error && (
                <p className="text-red-600 text-xs bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center justify-center gap-1.5 flex-1 bg-[#1a3a2a] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#14301f] transition-colors disabled:opacity-50"
                >
                  {isPending ? (
                    <>
                      <Loader2 size={15} className="animate-spin" /> Posting…
                    </>
                  ) : (
                    "Post Charge"
                  )}
                </button>
                <button
                  type="button"
                  onClick={closePanel}
                  className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
