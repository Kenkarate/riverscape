export interface Room {
  id: string;
  name: string;
  description: string;
  longDescription: string;
  price: number;
  image: string;
  gallery: string[];
  capacity: number;
  size: string;
  features: string[];
}

export interface Amenity {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export interface Testimonial {
  id: string;
  name: string;
  location: string;
  rating: number;
  quote: string;
}

export interface GalleryImage {
  src: string;
  alt: string;
  span: "tall" | "wide" | "normal";
}

// Return shape for form Server Actions used with React's useActionState.
// Defined here (not in a "use server" file) so it can be imported by both
// the actions and the client components without violating the rule that
// "use server" modules may only export async functions.
export type ActionState = { ok: boolean; message?: string } | null;

// Payload for the admin "New Booking" server action. Enum-like fields are kept
// as plain strings here (validated/cast inside the action) so this module stays
// free of `@prisma/client` imports and can be shared with the client form.
export interface AdminBookingInput {
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  adults: number;
  children: number;
  source: string; // BookingSource
  roomTypeId: string;
  mealPlan: string; // MealPlan
  addonIds: string[];
  guest: {
    name: string;
    email?: string;
    phone: string;
    address?: string;
    idType?: string;
    idNumber?: string;
  };
  payment: {
    method: string; // "Cash" | "Card" | "UPI" | "Bank Transfer" | "None"
    amountRupees: number; // 0 when method is "None"
  };
}

// Result of an admin guest phone lookup. Defined here (not in the "use server"
// actions module) so both the action and the client form can import it.
export interface GuestLookupResult {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  address: string | null;
  idType: string | null;
  idNumber: string | null;
}

// Minimal active add-on shape used by the admin new-booking form.
export interface ActiveAddon {
  id: string;
  name: string;
  price: number; // paise
  unit: string;
  gstRate: number;
}

// Available physical room option for booking room assignment.
export interface AvailableRoomOption {
  id: string;
  number: string;
  floor: string | null;
}
