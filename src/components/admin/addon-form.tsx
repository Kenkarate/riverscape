"use client";

import { useActionState, useState } from "react";
import { Plus, X } from "lucide-react";
import { createAddon } from "@/app/(admin)/admin/settings/actions";
import { ADDON_CATEGORY_OPTIONS, addonCategoryLabel } from "@/lib/badges";
import type { ActionState } from "@/types";

const inputClass =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]/30 bg-white";
const labelClass = "block text-xs font-medium text-gray-500 mb-1";

const GST_OPTIONS = [5, 12, 18];

export default function AddonForm() {
  const [open, setOpen] = useState(false);
  const [handled, setHandled] = useState<ActionState>(null);
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    createAddon,
    null
  );

  // Collapse (which unmounts and resets the form) once when an action succeeds.
  // Adjusting state during render is React's recommended alternative to an effect.
  if (state?.ok && state !== handled) {
    setHandled(state);
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
        Add addon
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="bg-white rounded-xl border border-gray-200 p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900 text-sm">New addon</h3>
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
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="addon-name">
            Name
          </label>
          <input
            id="addon-name"
            name="name"
            type="text"
            required
            placeholder="e.g. Airport transfer"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="addon-category">
            Category
          </label>
          <select id="addon-category" name="category" className={inputClass}>
            {ADDON_CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {addonCategoryLabel[c]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="addon-price">
            Price (₹)
          </label>
          <input
            id="addon-price"
            name="price"
            type="number"
            min={0}
            step="1"
            required
            defaultValue={0}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="addon-unit">
            Unit
          </label>
          <input
            id="addon-unit"
            name="unit"
            type="text"
            placeholder="per unit"
            defaultValue="per unit"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="addon-gst">
            GST rate
          </label>
          <select id="addon-gst" name="gstRate" defaultValue={18} className={inputClass}>
            {GST_OPTIONS.map((g) => (
              <option key={g} value={g}>
                {g}%
              </option>
            ))}
          </select>
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
          {isPending ? "Saving…" : "Save addon"}
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
