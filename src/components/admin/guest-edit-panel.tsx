"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { updateGuest } from "@/app/(admin)/admin/guests/actions";

const inputClass =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]/30";
const labelClass = "block text-xs font-medium text-gray-500 mb-1";

// idType is a free-text String on the Guest model — these are the standard
// Indian ID document types offered as a convenience.
const ID_TYPES: { value: string; label: string }[] = [
  { value: "AADHAAR", label: "Aadhaar" },
  { value: "PASSPORT", label: "Passport" },
  { value: "DRIVING_LICENSE", label: "Driving License" },
  { value: "PAN", label: "PAN" },
  { value: "OTHER", label: "Other" },
];

export interface GuestInitialValues {
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  idType: string | null;
  idNumber: string | null;
  country: string | null;
}

interface Props {
  guestId: string;
  initial: GuestInitialValues;
}

export default function GuestEditPanel({ guestId, initial }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [entered, setEntered] = useState(false);

  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone);
  const [email, setEmail] = useState(initial.email ?? "");
  const [address, setAddress] = useState(initial.address ?? "");
  const [idType, setIdType] = useState(initial.idType ?? "");
  const [idNumber, setIdNumber] = useState(initial.idNumber ?? "");
  const [country, setCountry] = useState(initial.country ?? "");

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Preserve any non-standard existing idType value as a selectable option.
  const idTypeOptions =
    idType && !ID_TYPES.some((t) => t.value === idType)
      ? [{ value: idType, label: idType }, ...ID_TYPES]
      : ID_TYPES;

  function playEnter() {
    setEntered(false);
    requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)));
  }

  function openPanel() {
    // Reset to the latest server values each time the panel is opened.
    setName(initial.name);
    setPhone(initial.phone);
    setEmail(initial.email ?? "");
    setAddress(initial.address ?? "");
    setIdType(initial.idType ?? "");
    setIdNumber(initial.idNumber ?? "");
    setCountry(initial.country ?? "");
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

    if (!name.trim()) {
      setError("Guest name is required.");
      return;
    }
    const cleanPhone = phone.replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      setError("Enter a valid 10-digit Indian mobile number.");
      return;
    }

    startTransition(async () => {
      const res = await updateGuest(guestId, {
        name: name.trim(),
        phone: cleanPhone,
        email: email.trim() || null,
        address: address.trim() || null,
        idType: idType || null,
        idNumber: idNumber.trim() || null,
        country: country.trim() || null,
      });
      if (res.success) {
        router.refresh();
        closePanel();
      } else {
        setError(res.error ?? "Could not update the guest.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <Pencil size={14} /> Edit
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
              "sm:inset-x-auto sm:right-0 sm:top-0 sm:bottom-0 sm:h-full sm:max-h-none sm:w-[480px] sm:max-w-full sm:rounded-none",
              entered
                ? "translate-y-0 sm:translate-x-0"
                : "translate-y-full sm:translate-y-0 sm:translate-x-full"
            )}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-gray-900 truncate">Edit Guest</h2>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{initial.name}</p>
              </div>
              <button
                type="button"
                onClick={closePanel}
                className="text-gray-400 hover:text-gray-600 shrink-0"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div>
                <label className={labelClass}>Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="10-digit mobile number"
                  inputMode="numeric"
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="guest@example.com"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Address</label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={3}
                  placeholder="Street, city, state, PIN"
                  className={cn(inputClass, "resize-none")}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>ID Type</label>
                  <select
                    value={idType}
                    onChange={(e) => setIdType(e.target.value)}
                    className={cn(inputClass, "bg-white")}
                  >
                    <option value="">None</option>
                    {idTypeOptions.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>ID Number</label>
                  <input
                    type="text"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    placeholder="Document number"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Nationality / Country</label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="e.g. IN"
                  className={inputClass}
                />
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
                      <Loader2 size={15} className="animate-spin" /> Saving…
                    </>
                  ) : (
                    "Save Changes"
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
