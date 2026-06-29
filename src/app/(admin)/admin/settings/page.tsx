import { prisma } from "@/lib/prisma";
import { AlertCircle } from "lucide-react";
import SettingsTabs from "@/components/admin/settings-tabs";

export const dynamic = "force-dynamic";

async function getData() {
  const property = await prisma.property.findUnique({
    where: { slug: "riverscape" },
  });
  if (!property) return { property: null, addons: [], coupons: [] };

  const [addons, coupons] = await Promise.all([
    prisma.addon.findMany({
      where: { propertyId: property.id },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    prisma.coupon.findMany({ orderBy: { code: "asc" } }),
  ]);

  return { property, addons, coupons };
}

export default async function SettingsPage() {
  let data: Awaited<ReturnType<typeof getData>> | null = null;
  let dbError = false;

  try {
    data = await getData();
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

  if (!data?.property) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-gray-500">
          <AlertCircle className="mx-auto mb-2 text-amber-500" size={32} />
          <p className="font-medium">Property not found</p>
          <p className="text-sm mt-1">Seed the database to create the property record.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
      <SettingsTabs
        addons={data.addons}
        coupons={data.coupons}
        property={data.property}
      />
    </div>
  );
}
