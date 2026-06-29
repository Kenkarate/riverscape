"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { updateProperty } from "@/app/(admin)/admin/settings/actions";
import type { ActionState } from "@/types";
import type { Property } from "@prisma/client";

const inputClass =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]/30 bg-white";
const labelClass = "block text-xs font-medium text-gray-500 mb-1";

const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

export default function PropertyForm({ property }: { property: Property }) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    updateProperty,
    null
  );

  return (
    <form
      action={formAction}
      className="bg-white rounded-xl border border-gray-200 p-5 space-y-5"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="prop-name">
            Property name
          </label>
          <input
            id="prop-name"
            name="name"
            type="text"
            required
            defaultValue={property.name}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="prop-checkin">
            Check-in time
          </label>
          <input
            id="prop-checkin"
            name="checkInTime"
            type="time"
            defaultValue={property.checkInTime}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="prop-checkout">
            Check-out time
          </label>
          <input
            id="prop-checkout"
            name="checkOutTime"
            type="time"
            defaultValue={property.checkOutTime}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="prop-gstin">
            GSTIN
          </label>
          <input
            id="prop-gstin"
            name="gstin"
            type="text"
            defaultValue={property.gstin ?? ""}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="prop-phone">
            Phone
          </label>
          <input
            id="prop-phone"
            name="phone"
            type="tel"
            defaultValue={property.phone ?? ""}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="prop-email">
            Email
          </label>
          <input
            id="prop-email"
            name="email"
            type="email"
            defaultValue={property.email ?? ""}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="prop-website">
            Website
          </label>
          <input
            id="prop-website"
            name="website"
            type="url"
            defaultValue={property.website ?? ""}
            className={inputClass}
          />
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="prop-address">
            Address
          </label>
          <textarea
            id="prop-address"
            name="address"
            required
            rows={2}
            defaultValue={property.address}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <span className={labelClass}>Weekend days</span>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((d) => {
            const checked = property.weekendDays.includes(d.value);
            return (
              <label
                key={d.value}
                className="inline-flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg text-sm cursor-pointer hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  name="weekendDays"
                  value={d.value}
                  defaultChecked={checked}
                  className="accent-[#1a3a2a]"
                />
                {d.label}
              </label>
            );
          })}
        </div>
      </div>

      {state?.ok && state.message && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <CheckCircle2 size={16} />
          {state.message}
        </div>
      )}
      {state && !state.ok && state.message && (
        <p className="text-sm text-red-600">{state.message}</p>
      )}

      <div>
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 text-sm bg-[#1a3a2a] text-white rounded-lg hover:bg-[#14301f] disabled:opacity-50 transition-colors"
        >
          {isPending ? "Saving…" : "Save settings"}
        </button>
      </div>
    </form>
  );
}
