"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateUserColor } from "@/app/(admin)/admin/allocation/actions";

/**
 * Reads a color the user picked on the login page (stashed in sessionStorage as
 * "pendingColor") and persists it once they land in the authenticated admin app.
 * Renders nothing.
 */
export default function PendingColorSync() {
  const router = useRouter();

  useEffect(() => {
    const color = sessionStorage.getItem("pendingColor");
    if (!color) return;
    sessionStorage.removeItem("pendingColor");
    updateUserColor(color)
      .then(() => router.refresh())
      .catch(() => {
        /* ignore — login color is a best-effort preference */
      });
  }, [router]);

  return null;
}
