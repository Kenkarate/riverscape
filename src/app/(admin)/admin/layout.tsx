import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AdminSidebar from "@/components/admin/sidebar";
import AdminTopbar from "@/components/admin/topbar";
import PendingColorSync from "@/components/admin/pending-color-sync";

const PENDING_APPROVAL_PATH = "/admin/pending-approval";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  // No session = login page (or redirected by middleware). Pass through without chrome.
  if (!session?.user || session.user.role === "GUEST") {
    return <>{children}</>;
  }

  // Fresh read of the user's role/status/color. Best-effort: if the DB is
  // unavailable, the chrome still renders so the page can show its own error.
  let dbUser:
    | { role: string; status: string; salesColor: string | null; colorLocked: boolean }
    | null = null;
  try {
    if (session.user.id) {
      dbUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true, status: true, salesColor: true, colorLocked: true },
      });
    }
  } catch {
    dbUser = null;
  }

  // ─── SALES approval gate ────────────────────────────────────────────────────
  // A SALES user who is not ACTIVE (pending approval or suspended) is held on the
  // standalone /admin/pending-approval page and never sees the dashboard chrome.
  // ADMIN / STAFF / SUPER_ADMIN always bypass this check.
  if (dbUser && dbUser.role === "SALES" && dbUser.status !== "ACTIVE") {
    const hdrs = await headers();
    const pathname = hdrs.get("x-pathname") ?? "";
    if (pathname !== PENDING_APPROVAL_PATH) {
      redirect(PENDING_APPROVAL_PATH);
    }
    // Render the holding page bare — no sidebar/topbar.
    return <>{children}</>;
  }

  // Count of SALES accounts awaiting approval (red badge in the sidebar).
  // Only Super Admins see the Staff link, so only fetch the count for them.
  let pendingCount = 0;
  if (session.user.role === "SUPER_ADMIN") {
    try {
      pendingCount = await prisma.user.count({
        where: { role: "SALES", status: "PENDING_APPROVAL" },
      });
    } catch {
      pendingCount = 0;
    }
  }

  const salesColor = dbUser?.salesColor ?? null;
  const colorLocked = dbUser?.colorLocked ?? false;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <PendingColorSync />
      <AdminSidebar role={session.user.role} pendingCount={pendingCount} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AdminTopbar user={session.user} salesColor={salesColor} colorLocked={colorLocked} />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
