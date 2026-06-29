"use client";

import { useActionState, useState } from "react";
import { Plus, X } from "lucide-react";
import { createCoupon } from "@/app/(admin)/admin/settings/actions";
import type { ActionState } from "@/types";
import type { DiscountType } from "@prisma/client";

const inputClass =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]/30 bg-white";
const labelClass = "block text-xs font-medium text-gray-500 mb-1";

export default function CouponForm() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<DiscountType>("PERCENT");
  const [handled, setHandled] = useState<ActionState>(null);
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    createCoupon,
    null
  );

  // Collapse (which unmounts and resets the form) once when an action succeeds.
  // Adjusting state during render is React's recommended alternative to an effect.
  if (state?.ok && state !== handled) {
    setHandled(state);
    setType("PERCENT");
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#1a3a2a] text-white rounded-lg hover:bg-[#14301f] transition-colors"
      >
        <Plus size={16} />
        Add coupon
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="bg-white rounded-xl border border-gray-200 p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900 text-sm">New coupon</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="coupon-code">
            Code
          </label>
          <input
            id="coupon-code"
            name="code"
            type="text"
            required
            placeholder="MONSOON25"
            className={`${inputClass} uppercase`}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="coupon-type">
            Discount type
          </label>
          <select
            id="coupon-type"
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as DiscountType)}
            className={inputClass}
          >
            <option value="PERCENT">Percentage (%)</option>
            <option value="FLAT">Flat (₹)</option>
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="coupon-value">
            {type === "PERCENT" ? "Discount (%)" : "Discount (₹)"}
          </label>
          <input
            id="coupon-value"
            name="value"
            type="number"
            min={1}
            max={type === "PERCENT" ? 100 : undefined}
            step="1"
            required
            className={inputClass}
          />
        </div>

        {type === "PERCENT" && (
          <div>
            <label className={labelClass} htmlFor="coupon-max">
              Max discount cap (₹, optional)
            </label>
            <input
              id="coupon-max"
              name="maxDiscount"
              type="number"
              min={0}
              step="1"
              placeholder="No cap"
              className={inputClass}
            />
          </div>
        )}

        <div>
          <label className={labelClass} htmlFor="coupon-from">
            Valid from
          </label>
          <input
            id="coupon-from"
            name="validFrom"
            type="date"
            required
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="coupon-to">
            Valid to
          </label>
          <input
            id="coupon-to"
            name="validTo"
            type="date"
            required
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="coupon-usage">
            Usage limit (optional)
          </label>
          <input
            id="coupon-usage"
            name="usageLimit"
            type="number"
            min={1}
            step="1"
            placeholder="Unlimited"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="coupon-min">
            Min booking amount (₹, optional)
          </label>
          <input
            id="coupon-min"
            name="minBookingAmount"
            type="number"
            min={0}
            step="1"
            placeholder="0"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="coupon-per-user">
            Per-user limit
          </label>
          <input
            id="coupon-per-user"
            name="perUserLimit"
            type="number"
            min={1}
            step="1"
            defaultValue={1}
            className={inputClass}
          />
        </div>
      </div>

      {state && !state.ok && state.message && (
        <p className="text-sm text-red-600">{state.message}</p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 text-sm bg-[#1a3a2a] text-white rounded-lg hover:bg-[#14301f] disabled:opacity-50 transition-colors"
        >
          {isPending ? "Saving…" : "Save coupon"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
