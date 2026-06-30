"use client";

import { useState, useTransition } from "react";
import { Check, X, Loader2 } from "lucide-react";
import { approveUser, rejectUser } from "@/app/(admin)/admin/staff/actions";

interface Props {
  userId: string;
  userName: string;
}

export default function ApprovalButtons({ userId, userName }: Props) {
  const [isPending, startTransition] = useTransition();
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleApprove() {
    setError(null);
    setAction("approve");
    startTransition(async () => {
      try {
        await approveUser(userId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not approve account.");
      } finally {
        setAction(null);
      }
    });
  }

  function handleReject() {
    const confirmed = window.confirm(
      `Reject ${userName}? They will be suspended and unable to sign in.`
    );
    if (!confirmed) return;
    setError(null);
    setAction("reject");
    startTransition(async () => {
      try {
        await rejectUser(userId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not reject account.");
      } finally {
        setAction(null);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleApprove}
          disabled={isPending}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#1a3a2a] text-white hover:bg-[#14301f] disabled:opacity-50 transition-colors"
        >
          {isPending && action === "approve" ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Check size={13} />
          )}
          Approve
        </button>
        <button
          type="button"
          onClick={handleReject}
          disabled={isPending}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200 disabled:opacity-50 transition-colors"
        >
          {isPending && action === "reject" ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <X size={13} />
          )}
          Reject
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
