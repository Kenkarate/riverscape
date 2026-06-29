import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AdminSidebar from "@/components/admin/sidebar";
import AdminTopbar from "@/components/admin/topbar";
import PendingColorSync from "@/components/admin/pending-color-sync";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  // No session = login page (or redirected by middleware). Pass through without chrome.
  if (!session?.user || session.user.role === "GUEST") {
    return <>{children}</>;
  }

  // Fetch the staff member's saved allocation color for the topbar picker.
  // Best-effort: if the DB is unavailable, the chrome still renders.
  let salesColor: string | null = null;
  try {
    if (session.user.id) {
      const dbUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { salesColor: true },
      });
      salesColor = dbUser?.salesColor ?? null;
    }
  } catch {
    salesColor = null;
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <PendingColorSync />
      <AdminSidebar role={session.user.role} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AdminTopbar user={session.user} salesColor={salesColor} />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
