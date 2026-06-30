import { auth } from "@/lib/auth";

export interface SessionUser {
  id: string;
  email?: string | null;
  name?: string | null;
  role: string;
}

const STAFF_ROLES = ["STAFF", "ADMIN", "SUPER_ADMIN"];
const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];
// SALES users are deliberately NOT staff-level: they may only touch the
// allocation chart, not bookings/rooms/room-rack. This dedicated set widens
// access for the allocation actions only.
const ALLOCATION_ROLES = ["SALES", "STAFF", "ADMIN", "SUPER_ADMIN"];

/**
 * Ensures the current session belongs to a staff-level user (STAFF/ADMIN/SUPER_ADMIN).
 * Throws if unauthenticated or unauthorised — use inside Server Actions.
 */
export async function requireStaff(): Promise<SessionUser> {
  const session = await auth();
  const user = session?.user;
  if (!user || !user.role || !STAFF_ROLES.includes(user.role)) {
    throw new Error("Unauthorised");
  }
  return user as SessionUser;
}

/**
 * Ensures the current session belongs to an admin-level user (ADMIN/SUPER_ADMIN).
 * Throws if unauthenticated or unauthorised — use inside Server Actions.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const session = await auth();
  const user = session?.user;
  if (!user || !user.role || !ADMIN_ROLES.includes(user.role)) {
    throw new Error("Unauthorised");
  }
  return user as SessionUser;
}

/**
 * Ensures the current session may use the allocation chart — staff-level users
 * plus the SALES role. Use inside the allocation Server Actions only.
 */
export async function requireAllocationStaff(): Promise<SessionUser> {
  const session = await auth();
  const user = session?.user;
  if (!user || !user.role || !ALLOCATION_ROLES.includes(user.role)) {
    throw new Error("Unauthorised");
  }
  return user as SessionUser;
}
