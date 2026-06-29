"use client";

import { useState, useTransition } from "react";
import { Loader2, X } from "lucide-react";
import {
  createRoomType,
  updateRoomType,
} from "@/app/(admin)/admin/rooms/actions";

const inputClass =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]/30 bg-white";
const labelClass = "block text-xs font-medium text-gray-500 mb-1";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface RoomTypeFormProps {
  roomType?: {
    id: string;
    name: string;
    slug: string;
    description: string;
    basePrice: number; // paise
    baseOccupancy: number;
    maxAdults: number;
    maxChildren: number;
    extraBedAllowed: boolean;
    maxExtraBeds: number;
  };
  onClose: () => void;
}

export default function RoomTypeForm({ roomType, onClose }: RoomTypeFormProps) {
  const isEdit = Boolean(roomType);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(roomType?.name ?? "");
  const [slug, setSlug] = useState(roomType?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState(roomType?.description ?? "");
  // Stored as paise in the DB; the form works in rupees.
  const [basePrice, setBasePrice] = useState(
    roomType ? String(roomType.basePrice / 100) : ""
  );
  const [baseOccupancy, setBaseOccupancy] = useState(
    String(roomType?.baseOccupancy ?? 2)
  );
  const [maxAdults, setMaxAdults] = useState(String(roomType?.maxAdults ?? 2));
  const [maxChildren, setMaxChildren] = useState(
    String(roomType?.maxChildren ?? 2)
  );
  const [extraBedAllowed, setExtraBedAllowed] = useState(
    roomType?.extraBedAllowed ?? false
  );
  const [maxExtraBeds, setMaxExtraBeds] = useState(
    String(roomType?.maxExtraBeds ?? 0)
  );

  function handleNameChange(value: string) {
    setName(value);
    // In create mode, keep the slug in sync with the name until the user
    // manually edits the slug.
    if (!isEdit && !slugEdited) {
      setSlug(slugify(value));
    }
  }

  function handleSave() {
    setError(null);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!description.trim()) {
      setError("Description is required.");
      return;
    }
    const priceNum = Number(basePrice);
    if (basePrice === "" || Number.isNaN(priceNum) || priceNum < 0) {
      setError("Base price must be a positive number.");
      return;
    }

    const payload = {
      name: name.trim(),
      slug: slug.trim() || slugify(name),
      description: description.trim(),
      basePrice: priceNum,
      baseOccupancy: Number(baseOccupancy) || 1,
      maxAdults: Number(maxAdults) || 1,
      maxChildren: Number(maxChildren) || 0,
      extraBedAllowed,
      maxExtraBeds: extraBedAllowed ? Number(maxExtraBeds) || 0 : 0,
    };

    startTransition(async () => {
      try {
        if (isEdit && roomType) {
          await updateRoomType(roomType.id, payload);
        } else {
          await createRoomType(payload);
        }
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save the room type.");
      }
    });
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900 text-sm">
          {isEdit ? `Edit ${roomType?.name}` : "New room type"}
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
          <label className={labelClass} htmlFor="rt-name">
            Name
          </label>
          <input
            id="rt-name"
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g. Riverview Suite"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="rt-slug">
            Slug
          </label>
          <input
            id="rt-slug"
            type="text"
            value={slug}
            readOnly={isEdit}
            onChange={(e) => {
              setSlug(slugify(e.target.value));
              setSlugEdited(true);
            }}
            placeholder="riverview-suite"
            className={`${inputClass} ${
              isEdit ? "bg-gray-50 text-gray-500 cursor-not-allowed" : ""
            }`}
          />
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="rt-description">
            Description
          </label>
          <textarea
            id="rt-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Short description shown to guests"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="rt-price">
            Base price (₹ / night)
          </label>
          <input
            id="rt-price"
            type="number"
            min={0}
            step="1"
            value={basePrice}
            onChange={(e) => setBasePrice(e.target.value)}
            placeholder="e.g. 12000"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="rt-occupancy">
            Base occupancy
          </label>
          <input
            id="rt-occupancy"
            type="number"
            min={1}
            step="1"
            value={baseOccupancy}
            onChange={(e) => setBaseOccupancy(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="rt-adults">
            Max adults
          </label>
          <input
            id="rt-adults"
            type="number"
            min={1}
            step="1"
            value={maxAdults}
            onChange={(e) => setMaxAdults(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="rt-children">
            Max children
          </label>
          <input
            id="rt-children"
            type="number"
            min={0}
            step="1"
            value={maxChildren}
            onChange={(e) => setMaxChildren(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="sm:col-span-2 flex items-center gap-2 pt-1">
          <input
            id="rt-extra-bed"
            type="checkbox"
            checked={extraBedAllowed}
            onChange={(e) => setExtraBedAllowed(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-[#1a3a2a] focus:ring-[#1a3a2a]/30"
          />
          <label htmlFor="rt-extra-bed" className="text-sm text-gray-700">
            Extra bed allowed
          </label>
        </div>

        {extraBedAllowed && (
          <div>
            <label className={labelClass} htmlFor="rt-max-extra-beds">
              Max extra beds
            </label>
            <input
              id="rt-max-extra-beds"
              type="number"
              min={0}
              step="1"
              value={maxExtraBeds}
              onChange={(e) => setMaxExtraBeds(e.target.value)}
              className={inputClass}
            />
          </div>
        )}
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
          {isEdit ? "Save changes" : "Create room type"}
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
