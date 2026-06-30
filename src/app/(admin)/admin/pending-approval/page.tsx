import { redirect } from "next/navigation";
import { Clock } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SignOutButton from "@/components/admin/sign-out-button";

export const dynamic = "force-dynamic";

export default async function PendingApprovalPage() {
  const session = await auth();

  // Not signed in → send to the login screen.
  if (!session?.user) {
    redirect("/admin/login");
  }

  // Read the *fresh* status from the DB. If the account has since been approved
  // (or the user isn't a SALES account at all), let them into the dashboard.
  // NOTE: redirect() throws NEXT_REDIRECT, so it must run OUTSIDE the try/catch.
  let role: string | null = null;
  let status: string | null = null;
  try {
    if (session.user.id) {
      const dbUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true, status: true },
      });
      role = dbUser?.role ?? null;
      status = dbUser?.status ?? null;
    }
  } catch {
    /* DB unavailable — fall through and show the holding page. */
  }

  if (role && (role !== "SALES" || status === "ACTIVE")) {
    redirect("/admin");
  }

  const suspended = status === "SUSPENDED";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1a3a2a] px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="text-center mb-6">
          <h1 className="font-serif text-2xl text-[#1a3a2a] font-semibold">Riverscape</h1>
          <p className="text-sm text-gray-500 mt-1">Admin Portal</p>
        </div>

        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#f5f0e8]">
          <Clock className="text-[#c9a84c]" size={26} />
        </div>

        {suspended ? (
          <>
            <h2 className="text-lg font-semibold text-[#1a3a2a]">Account Access Revoked</h2>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
              Your account is currently inactive. Please contact the administrator
              if you believe this is a mistake.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-[#1a3a2a]">Account Pending Approval</h2>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
              Your account is awaiting approval from the administrator. You&apos;ll
              receive access once approved.
            </p>
          </>
        )}

        <div className="mt-7">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
