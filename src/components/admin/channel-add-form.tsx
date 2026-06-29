"use client";

import { useActionState, useState } from "react";
import { Plus, X } from "lucide-react";
import { createChannel } from "@/app/(admin)/admin/channels/actions";
import { CHANNEL_TYPE_OPTIONS, channelTypeLabel } from "@/lib/badges";
import type { ActionState } from "@/types";
import type { DiscountType } from "@prisma/client";

const inputClass =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]/30 bg-white";
const labelClass = "block text-xs font-medium text-gray-500 mb-1";

export default function ChannelAddForm() {
  const [open, setOpen] = useState(false);
  const [markupType, setMarkupType] = useState<DiscountType>("PERCENT");
  const [handled, setHandled] = useState<ActionState>(null);
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    createChannel,
    null
  );

  // Collapse (which unmounts and resets the form) once when an action succeeds.
  // Adjusting state during render is React's recommended alternative to an effect.
  if (state?.ok && state !== handled) {
    setHandled(state);
    setMarkupType("PERCENT");
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
        Add channel
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="bg-white rounded-xl border border-gray-200 p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900 text-sm">New channel</h3>
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
          <label className={labelClass} htmlFor="channel-type">
            Channel
          </label>
          <select id="channel-type" name="type" required className={inputClass}>
            {CHANNEL_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {channelTypeLabel[t]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="channel-name">
            Custom name (optional)
          </label>
          <input
            id="channel-name"
            name="name"
            type="text"
            placeholder="Defaults to channel label"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="channel-markup-type">
            Markup type
          </label>
          <select
            id="channel-markup-type"
            name="markupType"
            value={markupType}
            onChange={(e) => setMarkupType(e.target.value as DiscountType)}
            className={inputClass}
          >
            <option value="PERCENT">Percentage (%)</option>
            <option value="FLAT">Flat (₹)</option>
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="channel-markup-value">
            {markupType === "PERCENT" ? "Markup (%)" : "Markup (₹)"}
          </label>
          <input
            id="channel-markup-value"
            name="markupValue"
            type="number"
            min={0}
            step={markupType === "PERCENT" ? "0.1" : "1"}
            defaultValue={0}
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
          {isPending ? "Saving…" : "Save channel"}
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
