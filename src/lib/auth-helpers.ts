import { auth } from "@/lib/auth";

export interface SessionUser {
  id: string;
  email?: string | null;
  name?: string | null;
  role: string;
}

const STAFF_ROLES = ["STAFF", "ADMIN", "SUPER_ADMIN"];
const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

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
