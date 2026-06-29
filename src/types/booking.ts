// Client-facing types for the guest booking flow.
// These mirror the JSON shapes returned by the booking/payment API routes.
// Kept here (not co-located) so both pages and components can share them.

export type MealPlan = "ROOM_ONLY" | "BREAKFAST" | "HALF_BOARD" | "FULL_BOARD";

export const MEAL_PLANS: { value: MealPlan; label: string; hint: string }[] = [
  { value: "ROOM_ONLY", label: "Room Only", hint: "No meals included" },
  { value: "BREAKFAST", label: "Breakfast", hint: "Daily breakfast" },
  { value: "HALF_BOARD", label: "Half Board", hint: "Breakfast + dinner" },
  { value: "FULL_BOARD", label: "Full Board", hint: "All meals included" },
];

export function mealPlanLabel(value: string): string {
  return MEAL_PLANS.find((m) => m.value === value)?.label ?? "Room Only";
}

/** A single bookable room type returned by GET /api/availability. */
export interface AvailableRoom {
  id: string;
  slug: string;
  name: string;
  description: string;
  longDescription: string | null;
  basePrice: number; // paise — cheapest rate plan base price per night
  maxAdults: number;
  maxChildren: number;
  extraBedAllowed: boolean;
  images: string[];
  amenities: string[];
  availableCount: number;
  nights: number;
  ratePlan: {
    id: string;
    name: string;
    mealPlan: string;
    basePrice: number; // paise / night
    extraAdultPrice: number; // paise / night / adult
    extraChildWithBed: number; // paise / night / child
    extraChildNoBed: number; // paise / night / child
  };
}

export interface AvailabilityResponse {
  rooms: AvailableRoom[];
  checkIn: string;
  checkOut: string;
  nights: number;
}

export interface AddonItem {
  id: string;
  name: string;
  category: string;
  price: number; // paise / unit
  unit: string;
  gstRate: number;
}

export interface CouponResult {
  valid: boolean;
  message?: string;
  discount?: number; // paise
  code?: string;
  type?: string;
  value?: number;
}

export interface CreateOrderResponse {
  bookingRef: string;
  razorpayOrderId: string | null;
  amount: number; // paise
  currency: string;
  keyId: string | null;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
}

export interface BookingDetails {
  bookingRef: string;
  status: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  mealPlan: string;
  specialRequests: string | null;
  roomSubtotal: number;
  addonSubtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  guest: { name: string; email: string | null; phone: string };
  rooms: Array<{
    roomType: { id: string; slug: string; name: string; images: string[] };
    room: { id: string; number: string } | null;
    checkIn: string;
    checkOut: string;
    subtotal: number;
  }>;
  addons: Array<{
    addon: { id: string; name: string; category: string; unit: string };
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  payments: Array<{
    id: string;
    type: string;
    status: string;
    amount: number;
    razorpayOrderId: string | null;
    razorpayPaymentId: string | null;
    capturedAt: string | null;
    createdAt: string;
  }>;
}

/** Razorpay checkout types (loaded from the external script at runtime). */
export interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  handler?: (response: RazorpaySuccessResponse) => void;
  modal?: { ondismiss?: () => void };
}

export interface RazorpayInstance {
  open: () => void;
  on: (event: string, handler: (response: { error?: { description?: string } }) => void) => void;
}
