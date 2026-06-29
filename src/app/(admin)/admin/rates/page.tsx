import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatINR } from "@/lib/pricing";
import { mealPlanLabel } from "@/lib/badges";
import RateOverrideForm from "@/components/admin/rate-override-form";
import RateOverrideDelete from "@/components/admin/rate-override-delete";
import AddRatePlanPanel from "@/components/admin/add-rate-plan-panel";
import EditRatePlanPanel from "@/components/admin/edit-rate-plan-panel";
import DeactivateRatePlanButton from "@/components/admin/deactivate-rate-plan-button";
import ReactivateRatePlanButton from "@/components/admin/reactivate-rate-plan-button";

export const dynamic = "force-dynamic";

async function getData() {
  const property = await prisma.property.findUniqueOrThrow({
    where: { slug: "riverscape" },
    select: { id: true },
  });

  const [plans, roomTypes] = await Promise.all([
    prisma.ratePlan.findMany({
      where: { propertyId: property.id },
      include: {
        roomType: { select: { id: true, name: true, slug: true } },
        rateOverrides: {
          orderBy: { date: "asc" },
          take: 30,
        },
      },
      orderBy: [{ roomType: { name: "asc" } }, { basePrice: "asc" }],
    }),
    prisma.roomType.findMany({
      where: { propertyId: property.id, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return { plans, roomTypes };
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function RatesPage() {
  const session = await auth();
  const role = session?.user?.role ?? "STAFF";
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";

  let data: Awaited<ReturnType<typeof getData>> | null = null;
  let dbError = false;

  try {
    data = await getData();
  } catch {
    dbError = true;
  }

  if (dbError || !data) {
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

  const { plans, roomTypes } = data;
  const activeCount = plans.filter((p) => p.isActive).length;

  // Group by room type name (null room type = property-wide)
  const grouped: Record<string, typeof plans> = {};
  for (const plan of plans) {
    const key = plan.roomType?.name ?? "Property-wide";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(plan);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Rate Plans</h1>
          <span className="text-sm text-gray-400">
            {activeCount} active · {plans.length} total
          </span>
        </div>
        {isAdmin && <AddRatePlanPanel roomTypes={roomTypes} />}
      </div>

      {Object.entries(grouped).map(([groupName, groupPlans]) => (
        <div key={groupName} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
            <h2 className="font-medium text-gray-700 text-sm">{groupName}</h2>
          </div>

          <div className="divide-y divide-gray-50">
            {groupPlans.map((plan) => (
              <div key={plan.id} className={cn("px-5 py-4", !plan.isActive && "opacity-60")}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={cn(
                          "font-medium text-sm",
                          plan.isActive ? "text-gray-900" : "text-gray-500 line-through"
                        )}
                      >
                        {plan.name}
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                        {mealPlanLabel[plan.mealPlan]}
                      </span>
                      {plan.isPackage && (
                        <span className="text-xs px-2 py-0.5 bg-gold/10 text-yellow-700 rounded-full">
                          Package
                        </span>
                      )}
                      {!plan.isActive && (
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full font-medium">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
                      {plan.minStay > 1 && <span>Min stay: {plan.minStay} nights</span>}
                      {plan.maxStay && <span>Max stay: {plan.maxStay} nights</span>}
                      <span>Extra adult: {formatINR(plan.extraAdultPrice)}/night</span>
                      <span>Extra child (bed): {formatINR(plan.extraChildWithBed)}/night</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-semibold text-gray-900">
                      {formatINR(plan.basePrice)}
                    </div>
                    <div className="text-xs text-gray-400">per night</div>
                  </div>
                </div>

                {/* Admin controls */}
                {isAdmin && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <EditRatePlanPanel
                      plan={{
                        id: plan.id,
                        name: plan.name,
                        roomTypeId: plan.roomTypeId,
                        mealPlan: plan.mealPlan,
                        basePrice: plan.basePrice,
                        extraAdultPrice: plan.extraAdultPrice,
                        extraChildWithBed: plan.extraChildWithBed,
                        extraChildNoBed: plan.extraChildNoBed,
                        minStay: plan.minStay,
                        maxStay: plan.maxStay,
                      }}
                      roomTypes={roomTypes}
                    />
                    {plan.isActive ? (
                      <DeactivateRatePlanButton
                        ratePlanId={plan.id}
                        ratePlanName={plan.name}
                      />
                    ) : (
                      <ReactivateRatePlanButton ratePlanId={plan.id} />
                    )}
                  </div>
                )}

                {/* Date overrides — active plans only */}
                {plan.isActive && plan.rateOverrides.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs font-medium text-gray-500 mb-1.5">
                      Date overrides ({plan.rateOverrides.length})
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left py-1 pr-4 font-medium text-gray-400">Date</th>
                            <th className="text-left py-1 pr-4 font-medium text-gray-400">Type</th>
                            <th className="text-right py-1 pr-4 font-medium text-gray-400">Price</th>
                            <th className="text-center py-1 pr-4 font-medium text-gray-400">Stop Sell</th>
                            <th className="text-center py-1 pr-4 font-medium text-gray-400">CTA</th>
                            <th className="text-center py-1 font-medium text-gray-400">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {plan.rateOverrides.map((o) => (
                            <tr key={o.id}>
                              <td className="py-1 pr-4 text-gray-600">{formatDate(o.date)}</td>
                              <td className="py-1 pr-4 text-gray-500">
                                {o.type === "DATE_RANGE"
                                  ? "Override"
                                  : o.type === "WEEKEND"
                                  ? "Weekend"
                                  : "Seasonal"}
                              </td>
                              <td className="py-1 pr-4 text-right font-medium text-gray-800">
                                {formatINR(o.price)}
                              </td>
                              <td className="py-1 pr-4 text-center">
                                {o.stopSell ? (
                                  <span className="text-red-500">Yes</span>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>
                              <td className="py-1 pr-4 text-center">
                                {o.closedToArrival ? (
                                  <span className="text-amber-500">CTA</span>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>
                              <td className="py-1 text-center">
                                <RateOverrideDelete
                                  ratePlanId={plan.id}
                                  date={o.date.toISOString().slice(0, 10)}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {plan.isActive && <RateOverrideForm ratePlanId={plan.id} />}
              </div>
            ))}
          </div>
        </div>
      ))}

      {plans.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
          No rate plans found.{" "}
          {isAdmin ? "Add a rate plan to get started." : "Seed the database to get started."}
        </div>
      )}
    </div>
  );
}
