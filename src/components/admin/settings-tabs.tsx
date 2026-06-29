"use client";

import { useState } from "react";
import { Package, Tag, Building2 } from "lucide-react";
import type { Addon, Coupon, Property } from "@prisma/client";
import { addonCategoryLabel } from "@/lib/badges";
import { formatINR } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { toggleAddon, toggleCoupon } from "@/app/(admin)/admin/settings/actions";
import ActiveToggle from "./active-toggle";
import AddonForm from "./addon-form";
import CouponForm from "./coupon-form";
import PropertyForm from "./property-form";

type Tab = "addons" | "coupons" | "property";

interface Props {
  addons: Addon[];
  coupons: Coupon[];
  property: Property;
}

const TABS: Array<{ key: Tab; label: string; icon: typeof Package }> = [
  { key: "addons", label: "Addons", icon: Package },
  { key: "coupons", label: "Coupons", icon: Tag },
  { key: "property", label: "Property", icon: Building2 },
];

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function couponValueLabel(coupon: Coupon): string {
  return coupon.type === "PERCENT"
    ? `${coupon.value}% off`
    : `${formatINR(coupon.value)} off`;
}

export default function SettingsTabs({ addons, coupons, property }: Props) {
  const [tab, setTab] = useState<Tab>("addons");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1 border-b border-gray-200">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                active
                  ? "border-[#1a3a2a] text-[#1a3a2a]"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              )}
            >
              <Icon size={16} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Addons */}
      {tab === "addons" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-gray-400">{addons.length} addons</span>
            <AddonForm />
          </div>

          {addons.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
              No addons yet. Add one to offer extras at booking time.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
              {addons.map((addon) => (
                <div
                  key={addon.id}
                  className="px-5 py-3 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-gray-900">
                        {addon.name}
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                        {addonCategoryLabel[addon.category]}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {formatINR(addon.price)} {addon.unit} · GST {addon.gstRate}%
                    </div>
                  </div>
                  <ActiveToggle
                    id={addon.id}
                    isActive={addon.isActive}
                    onToggle={toggleAddon}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Coupons */}
      {tab === "coupons" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-gray-400">{coupons.length} coupons</span>
            <CouponForm />
          </div>

          {coupons.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
              No coupons yet. Create one to run a promotion.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
              {coupons.map((coupon) => (
                <div
                  key={coupon.id}
                  className="px-5 py-3 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-sm text-gray-900">
                        {coupon.code}
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                        {coupon.type === "PERCENT" ? "Percentage" : "Flat"}
                      </span>
                      <span className="text-xs font-medium text-[#1a3a2a]">
                        {couponValueLabel(coupon)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                      <span>
                        {fmtDate(coupon.validFrom)} – {fmtDate(coupon.validTo)}
                      </span>
                      <span>
                        Used {coupon.usedCount} / {coupon.usageLimit ?? "∞"}
                      </span>
                      {coupon.minBookingAmount > 0 && (
                        <span>Min {formatINR(coupon.minBookingAmount)}</span>
                      )}
                      {coupon.type === "PERCENT" && coupon.maxDiscount !== null && (
                        <span>Cap {formatINR(coupon.maxDiscount)}</span>
                      )}
                    </div>
                  </div>
                  <ActiveToggle
                    id={coupon.id}
                    isActive={coupon.isActive}
                    onToggle={toggleCoupon}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Property */}
      {tab === "property" && <PropertyForm property={property} />}
    </div>
  );
}
