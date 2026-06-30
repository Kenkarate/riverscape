import type {
  BookingStatus,
  BookingSource,
  HousekeepingStatus,
  MealPlan,
  PaymentStatus,
  ChannelType,
  SyncStatus,
  AddonCategory,
  FolioStatus,
  FolioDepartment,
} from "@prisma/client";

export interface Badge {
  label: string;
  className: string;
}

export const bookingStatusBadge: Record<BookingStatus, Badge> = {
  PENDING: { label: "Pending", className: "bg-amber-100 text-amber-700" },
  CONFIRMED: { label: "Confirmed", className: "bg-green-100 text-green-700" },
  CHECKED_IN: { label: "Checked In", className: "bg-blue-100 text-blue-700" },
  CHECKED_OUT: { label: "Checked Out", className: "bg-gray-100 text-gray-600" },
  CANCELLED: { label: "Cancelled", className: "bg-red-100 text-red-700" },
  NO_SHOW: { label: "No Show", className: "bg-rose-100 text-rose-700" },
};

export const sourceBadge: Record<BookingSource, Badge> = {
  DIRECT: { label: "Direct", className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" },
  WALK_IN: { label: "Walk-in", className: "bg-teal-50 text-teal-700 ring-1 ring-teal-200" },
  PHONE: { label: "Phone", className: "bg-sky-50 text-sky-700 ring-1 ring-sky-200" },
  BOOKING_COM: { label: "Booking.com", className: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200" },
  MAKEMYTRIP: { label: "MakeMyTrip", className: "bg-orange-50 text-orange-700 ring-1 ring-orange-200" },
  GOIBIBO: { label: "Goibibo", className: "bg-rose-50 text-rose-700 ring-1 ring-rose-200" },
  AGODA: { label: "Agoda", className: "bg-violet-50 text-violet-700 ring-1 ring-violet-200" },
  AIRBNB: { label: "Airbnb", className: "bg-pink-50 text-pink-700 ring-1 ring-pink-200" },
  EXPEDIA: { label: "Expedia", className: "bg-amber-50 text-amber-700 ring-1 ring-amber-200" },
};

export const housekeepingBadge: Record<HousekeepingStatus, Badge> = {
  CLEAN: { label: "Clean", className: "bg-green-100 text-green-700" },
  DIRTY: { label: "Dirty", className: "bg-amber-100 text-amber-700" },
  INSPECTED: { label: "Inspected", className: "bg-blue-100 text-blue-700" },
  OUT_OF_ORDER: { label: "Out of Order", className: "bg-red-100 text-red-700" },
};

export const mealPlanLabel: Record<MealPlan, string> = {
  ROOM_ONLY: "Room Only",
  BREAKFAST: "Breakfast",
  HALF_BOARD: "Half Board",
  FULL_BOARD: "Full Board",
};

export const paymentStatusBadge: Record<PaymentStatus, Badge> = {
  CREATED: { label: "Created", className: "bg-gray-100 text-gray-600" },
  PENDING: { label: "Pending", className: "bg-amber-100 text-amber-700" },
  CAPTURED: { label: "Captured", className: "bg-green-100 text-green-700" },
  FAILED: { label: "Failed", className: "bg-red-100 text-red-700" },
  REFUNDED: { label: "Refunded", className: "bg-purple-100 text-purple-700" },
  PARTIALLY_REFUNDED: { label: "Partially Refunded", className: "bg-purple-50 text-purple-600" },
};

export const BOOKING_STATUS_OPTIONS: BookingStatus[] = [
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "CANCELLED",
  "NO_SHOW",
];

export const BOOKING_SOURCE_OPTIONS: BookingSource[] = [
  "DIRECT",
  "WALK_IN",
  "PHONE",
  "BOOKING_COM",
  "MAKEMYTRIP",
  "GOIBIBO",
  "AGODA",
  "AIRBNB",
  "EXPEDIA",
];

export const HOUSEKEEPING_OPTIONS: HousekeepingStatus[] = [
  "CLEAN",
  "DIRTY",
  "INSPECTED",
  "OUT_OF_ORDER",
];

export const channelTypeLabel: Record<ChannelType, string> = {
  DIRECT: "Direct",
  BOOKING_COM: "Booking.com",
  MAKEMYTRIP: "MakeMyTrip",
  GOIBIBO: "Goibibo",
  AGODA: "Agoda",
  AIRBNB: "Airbnb",
  EXPEDIA: "Expedia",
};

export const channelTypeBadge: Record<ChannelType, Badge> = {
  DIRECT: { label: "Direct", className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" },
  BOOKING_COM: { label: "Booking.com", className: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200" },
  MAKEMYTRIP: { label: "MakeMyTrip", className: "bg-orange-50 text-orange-700 ring-1 ring-orange-200" },
  GOIBIBO: { label: "Goibibo", className: "bg-rose-50 text-rose-700 ring-1 ring-rose-200" },
  AGODA: { label: "Agoda", className: "bg-violet-50 text-violet-700 ring-1 ring-violet-200" },
  AIRBNB: { label: "Airbnb", className: "bg-pink-50 text-pink-700 ring-1 ring-pink-200" },
  EXPEDIA: { label: "Expedia", className: "bg-amber-50 text-amber-700 ring-1 ring-amber-200" },
};

// OTA channels only — DIRECT is the in-house booking source, not a managed channel.
export const CHANNEL_TYPE_OPTIONS: ChannelType[] = [
  "BOOKING_COM",
  "MAKEMYTRIP",
  "GOIBIBO",
  "AGODA",
  "AIRBNB",
  "EXPEDIA",
];

export const syncStatusBadge: Record<SyncStatus, Badge> = {
  SUCCESS: { label: "Success", className: "bg-green-100 text-green-700" },
  FAILED: { label: "Failed", className: "bg-red-100 text-red-700" },
  PARTIAL: { label: "Partial", className: "bg-amber-100 text-amber-700" },
  PENDING: { label: "Pending", className: "bg-gray-100 text-gray-600" },
};

export const addonCategoryLabel: Record<AddonCategory, string> = {
  EXTRA_BED: "Extra Bed",
  TRANSPORT: "Transport",
  MEAL: "Meal",
  ACTIVITY: "Activity",
  OTHER: "Other",
};

export const ADDON_CATEGORY_OPTIONS: AddonCategory[] = [
  "EXTRA_BED",
  "TRANSPORT",
  "MEAL",
  "ACTIVITY",
  "OTHER",
];

// ─── Billing / Folio ──────────────────────────────────────────────────────────

export const folioStatusBadge: Record<FolioStatus, Badge> = {
  OPEN: { label: "Open", className: "bg-blue-100 text-blue-700" },
  CLOSED: { label: "Closed", className: "bg-gray-100 text-gray-600" },
  SETTLED: { label: "Settled", className: "bg-green-100 text-green-700" },
  VOID: { label: "Void", className: "bg-red-100 text-red-700" },
};

export const folioDepartmentLabel: Record<FolioDepartment, string> = {
  ROOM: "Room",
  ADDON: "Add-on",
  SPA: "Spa",
  RESTAURANT: "Restaurant",
  MINIBAR: "Minibar",
  LAUNDRY: "Laundry",
  ACTIVITY: "Activity",
  TRANSPORT: "Transport",
  OTHER: "Other",
};

export const folioDepartmentBadge: Record<FolioDepartment, Badge> = {
  ROOM: { label: "Room", className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" },
  ADDON: { label: "Add-on", className: "bg-teal-50 text-teal-700 ring-1 ring-teal-200" },
  SPA: { label: "Spa", className: "bg-pink-50 text-pink-700 ring-1 ring-pink-200" },
  RESTAURANT: { label: "Restaurant", className: "bg-orange-50 text-orange-700 ring-1 ring-orange-200" },
  MINIBAR: { label: "Minibar", className: "bg-amber-50 text-amber-700 ring-1 ring-amber-200" },
  LAUNDRY: { label: "Laundry", className: "bg-sky-50 text-sky-700 ring-1 ring-sky-200" },
  ACTIVITY: { label: "Activity", className: "bg-violet-50 text-violet-700 ring-1 ring-violet-200" },
  TRANSPORT: { label: "Transport", className: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200" },
  OTHER: { label: "Other", className: "bg-gray-100 text-gray-600 ring-1 ring-gray-200" },
};

// Departments a staff member can post an ad-hoc POS charge to. ROOM / ADDON are
// reconciled from the Booking, so they are excluded from the manual picker.
export const FOLIO_POS_DEPARTMENT_OPTIONS: FolioDepartment[] = [
  "RESTAURANT",
  "SPA",
  "MINIBAR",
  "LAUNDRY",
  "ACTIVITY",
  "TRANSPORT",
  "OTHER",
];

// Payment methods accepted at the folio desk — mirrors the booking payment form.
export const FOLIO_PAYMENT_METHODS = ["Cash", "Card", "UPI", "Bank Transfer"] as const;
