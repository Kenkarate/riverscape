"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { SALES_COLOR_PALETTE } from "@/lib/sales-colors";

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password required"),
});
type FormData = z.infer<typeof schema>;

export default function AdminLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/admin";
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [color, setColor] = useState<string>(SALES_COLOR_PALETTE[0]);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    setLoading(true);
    setError(null);
    const result = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError("Invalid email or password");
    } else {
      // Persisted by <PendingColorSync /> once the admin app loads.
      try {
        sessionStorage.setItem("pendingColor", color);
      } catch {
        /* sessionStorage may be unavailable — color is optional */
      }
      router.push(callbackUrl);
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1a3a2a]">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="font-serif text-2xl text-[#1a3a2a] font-semibold">Riverscape</h1>
          <p className="text-sm text-gray-500 mt-1">Admin Portal</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              autoComplete="email"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]"
              {...register("email")}
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              autoComplete="current-password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]"
              {...register("password")}
            />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Your color</label>
            <div className="flex flex-wrap items-center gap-2">
              {SALES_COLOR_PALETTE.map((hex) => {
                const active = color.toLowerCase() === hex.toLowerCase();
                return (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setColor(hex)}
                    aria-label={`Select color ${hex}`}
                    title={hex}
                    className={cn(
                      "w-7 h-7 rounded-full inline-flex items-center justify-center transition-transform hover:scale-110",
                      active ? "ring-2 ring-offset-2 ring-gray-800" : "ring-1 ring-black/10"
                    )}
                    style={{ backgroundColor: hex }}
                  >
                    {active && <Check size={14} className="text-white" />}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 mt-1.5">Used to tag your room allocations on the chart.</p>
          </div>

          {error && (
            <p className="text-red-500 text-sm text-center bg-red-50 rounded-lg py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1a3a2a] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#2a5040] transition-colors disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
