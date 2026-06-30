import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { AlertCircle, ShieldAlert, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@prisma/client";
import { SALES_COLOR_DEFAULT } from "@/lib/sales-colors";
import CreateStaffForm from "@/components/admin/create-staff-form";
import StaffRoleSelect from "@/components/admin/staff-role-select";
import DeactivateStaffButton from "@/components/admin/deactivate-staff-button";
import ApprovalButtons from "@/components/admin/approval-buttons";
import ResetColorButton from "@/components/admin/reset-color-button";

export const dynamic = "force-dynamic";

const roleBadge: Record<string, { label: string; className: string }> = {
  SALES: { label: "Sales", className: "bg-teal-100 text-teal-700" },
  STAFF: { label: "Staff", className: "bg-gray-100 text-gray-600" },
  ADMIN: { label: "Admin", className: "bg-blue-100 text-blue-700" },
  SUPER_ADMIN: { label: "Super Admin", className: "bg-purple-100 text-purple-700" },
};

async function getStaff() {
  return prisma.user.findMany({
    where: { role: { in: ["SALES", "STAFF", "ADMIN", "SUPER_ADMIN"] } },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      salesColor: true,
      createdAt: true,
    },
    orderBy: { name: "asc" },
  });
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function StaffPage() {
  const session = await auth();
  const role = session?.user?.role ?? "STAFF";
  const currentUserId = session?.user?.id ?? "";

  if (role !== "SUPER_ADMIN") {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-gray-500">
          <ShieldAlert className="mx-auto mb-2 text-amber-500" size={32} />
          <p className="font-medium text-gray-900">Access denied</p>
          <p className="text-sm mt-1">Only Super Admins can manage staff accounts.</p>
        </div>
      </div>
    );
  }

  let staff: Awaited<ReturnType<typeof getStaff>> = [];
  let dbError = false;

  try {
    staff = await getStaff();
  } catch {
    dbError = true;
  }

  if (dbError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-gray-500">
          <AlertCircle className="mx-auto mb-2 text-amber-500" size={32} />
          <p className="font-medium">Database not connected</p>
          <p className="text-sm mt-1">Add your DATABASE_URL to .env.local and run migrations.</p>
        </div>
      </div>
    );
  }

  const pending = staff.filter(
    (u) => u.role === "SALES" && u.status === "PENDING_APPROVAL"
  );
  const others = staff.filter(
    (u) => !(u.role === "SALES" && u.status === "PENDING_APPROVAL")
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Staff</h1>
          <span className="text-sm text-gray-400">{staff.length} accounts</span>
        </div>
        <CreateStaffForm />
      </div>

      {/* ─── Pending approvals ──────────────────────────────────────────────── */}
      {pending.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-amber-100 bg-amber-50/60 flex items-center gap-2">
            <Clock size={16} className="text-amber-600" />
            <h2 className="text-sm font-semibold text-gray-900">Pending Approvals</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 font-medium">
              {pending.length}
            </span>
          </div>
          <ul className="divide-y divide-gray-50">
            {pending.map((u) => (
              <li
                key={u.id}
                className="px-5 py-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{u.name ?? "—"}</p>
                  <p className="text-sm text-gray-500 truncate">{u.email}</p>
                </div>
                <ApprovalButtons userId={u.id} userName={u.name ?? u.email} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ─── All staff ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-3 text-left font-medium text-gray-400 text-xs">Name</th>
                <th className="px-5 py-3 text-left font-medium text-gray-400 text-xs">Email</th>
                <th className="px-5 py-3 text-left font-medium text-gray-400 text-xs">Phone</th>
                <th className="px-5 py-3 text-left font-medium text-gray-400 text-xs">Role</th>
                <th className="px-5 py-3 text-left font-medium text-gray-400 text-xs">Status</th>
                <th className="px-5 py-3 text-left font-medium text-gray-400 text-xs">Created</th>
                <th className="px-5 py-3 text-right font-medium text-gray-400 text-xs">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {others.map((u) => {
                const isSelf = u.id === currentUserId;
                const isSales = u.role === "SALES";
                const badge = roleBadge[u.role] ?? roleBadge.STAFF;
                const suspended = u.status === "SUSPENDED";
                return (
                  <tr key={u.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-2">
                        {isSales && (
                          <span
                            className="w-2.5 h-2.5 rounded-full inline-block ring-1 ring-black/5 shrink-0"
                            style={{ backgroundColor: u.salesColor ?? SALES_COLOR_DEFAULT }}
                            title={u.salesColor ? `Color ${u.salesColor}` : "No color picked yet"}
                          />
                        )}
                        <span className="font-medium text-gray-900">{u.name ?? "—"}</span>
                        {isSelf && <span className="ml-1 text-xs text-gray-400">(you)</span>}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{u.email}</td>
                    <td className="px-5 py-3 text-gray-600">{u.phone ?? "—"}</td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          "text-xs px-2 py-0.5 rounded-full font-medium",
                          badge.className
                        )}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          "text-xs px-2 py-0.5 rounded-full font-medium",
                          suspended
                            ? "bg-red-100 text-red-700"
                            : "bg-green-100 text-green-700"
                        )}
                      >
                        {suspended ? "Suspended" : "Active"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs">
                      {formatDate(u.createdAt)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-3">
                        {isSales && (
                          <ResetColorButton userId={u.id} userName={u.name ?? u.email} />
                        )}
                        <StaffRoleSelect
                          userId={u.id}
                          current={u.role as Role}
                          disabled={isSelf}
                        />
                        <DeactivateStaffButton
                          userId={u.id}
                          userName={u.name ?? u.email}
                          disabled={isSelf}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {others.length === 0 && (
          <div className="px-5 py-12 text-center text-sm text-gray-400">
            No staff accounts found.
          </div>
        )}
      </div>
    </div>
  );
}
