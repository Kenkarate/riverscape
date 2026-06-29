"use client";

import { useState, useTransition } from "react";
import { Loader2, X } from "lucide-react";
import { createRatePlan, updateRatePlan } from "@/app/(admin)/admin/rates/actions";
import { mealPlanLabel } from "@/lib/badges";
import type { MealPlan } from "@prisma/client";

const inputClass =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]/30 bg-white";
const labelClass = "block text-xs font-medium text-gray-500 mb-1";

const MEAL_PLAN_OPTIONS: MealPlan[] = ["ROOM_ONLY", "BREAKFAST", "HALF_BOARD", "FULL_BOARD"];

interface RatePlanFormProps {
  roomTypes: { id: string; name: string }[];
  plan?: {
    id: string;
    name: string;
    roomTypeId: string | null;
    mealPlan: MealPlan;
    basePrice: number; // paise
    extraAdultPrice: number; // paise
    extraChildWithBed: number; // paise
    extraChildNoBed: number; // paise
    minStay: number;
    maxStay: number | null;
  };
  onClose: () => void;
}

// paise → rupees string for editable inputs
function toRupees(paise: number): string {
  return String(paise / 100);
}

export default function RatePlanForm({ roomTypes, plan, onClose }: RatePlanFormProps) {
  const isEdit = Boolean(plan);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(plan?.name ?? "");
  const [roomTypeId, setRoomTypeId] = useState(plan?.roomTypeId ?? "");
  const [mealPlan, setMealPlan] = useState<MealPlan>(plan?.mealPlan ?? "ROOM_ONLY");
  const [basePrice, setBasePrice] = useState(plan ? toRupees(plan.basePrice) : "");
  const [extraAdult, setExtraAdult] = useState(plan ? toRupees(plan.extraAdultPrice) : "1000");
  const [extraChildWithBed, setExtraChildWithBed] = useState(
    plan ? toRupees(plan.extraChildWithBed) : "1000"
  );
  const [extraChildNoBed, setExtraChildNoBed] = useState(
    plan ? toRupees(plan.extraChildNoBed) : "500"
  );
  const [minStay, setMinStay] = useState(plan ? String(plan.minStay) : "1");
  const [maxStay, setMaxStay] = useState(
    plan?.maxStay != null ? String(plan.maxStay) : ""
  );

  function handleSave() {
    setError(null);

    if (!name.trim()) {
      setError("Rate plan name is required.");
      return;
    }
    const base = Number(basePrice);
    if (!Number.isFinite(base) || base < 0) {
      setError("Enter a valid base price.");
      return;
    }

    const payload = {
      name: name.trim(),
      roomTypeId, // "" = all room types (server converts to null)
      mealPlan,
      basePriceRupees: Number(basePrice),
      extraAdultRupees: Number(extraAdult || 0),
      extraChildWithBedRupees: Number(extraChildWithBed || 0),
      extraChildNoBedRupees: Number(extraChildNoBed || 0),
      minStay: Number(minStay || 1),
      maxStay: maxStay.trim() ? Number(maxStay) : undefined,
    };

    startTransition(async () => {
      try {
        if (isEdit && plan) {
          await updateRatePlan(plan.id, payload);
        } else {
          await createRatePlan(payload);
        }
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save the rate plan.");
      }
    });
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900 text-sm">
          {isEdit ? `Edit ${plan?.name}` : "New rate plan"}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="rp-name">
            Name
          </label>
          <input
            id="rp-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Standard Rate"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="rp-roomtype">
            Room type
          </label>
          <select
            id="rp-roomtype"
            value={roomTypeId}
            onChange={(e) => setRoomTypeId(e.target.value)}
            className={inputClass}
          >
            <option value="">All room types</option>
            {roomTypes.map((rt) => (
              <option key={rt.id} value={rt.id}>
                {rt.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="rp-mealplan">
            Meal plan
          </label>
          <select
            id="rp-mealplan"
            value={mealPlan}
            onChange={(e) => setMealPlan(e.target.value as MealPlan)}
            className={inputClass}
          >
            {MEAL_PLAN_OPTIONS.map((mp) => (
              <option key={mp} value={mp}>
                {mealPlanLabel[mp]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="rp-base">
            Base price (₹ / night)
          </label>
          <input
            id="rp-base"
            type="number"
            min={0}
            step="1"
            value={basePrice}
            onChange={(e) => setBasePrice(e.target.value)}
            placeholder="e.g. 20000"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="rp-extra-adult">
            Extra adult (₹ / night)
          </label>
          <input
            id="rp-extra-adult"
            type="number"
            min={0}
            step="1"
            value={extraAdult}
            onChange={(e) => setExtraAdult(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="rp-extra-child-bed">
            Extra child with bed (₹ / night)
          </label>
          <input
            id="rp-extra-child-bed"
            type="number"
            min={0}
            step="1"
            value={extraChildWithBed}
            onChange={(e) => setExtraChildWithBed(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="rp-extra-child-nobed">
            Extra child no bed (₹ / night)
          </label>
          <input
            id="rp-extra-child-nobed"
            type="number"
            min={0}
            step="1"
            value={extraChildNoBed}
            onChange={(e) => setExtraChildNoBed(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass} htmlFor="rp-minstay">
              Min stay (nights)
            </label>
            <input
              id="rp-minstay"
              type="number"
              min={1}
              step="1"
              value={minStay}
              onChange={(e) => setMinStay(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="rp-maxstay">
              Max stay <span className="text-gray-300">(optional)</span>
            </label>
            <input
              id="rp-maxstay"
              type="number"
              min={1}
              step="1"
              value={maxStay}
              onChange={(e) => setMaxStay(e.target.value)}
              placeholder="—"
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={handleSave}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-[#1a3a2a] text-white rounded-lg hover:bg-[#14301f] disabled:opacity-50 transition-colors"
        >
          {isPending && <Loader2 size={14} className="animate-spin" />}
          {isEdit ? "Save changes" : "Create rate plan"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
