import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * The standalone allocation chart has been merged into the unified Room Rack.
 * This route is kept only so existing bookmarks / links keep working.
 */
export default async function AllocationRedirect({
  searchParams,
}: {
  searchParams: Promise<{ start?: string }>;
}) {
  const sp = await searchParams;
  redirect(sp.start ? `/admin/room-rack?start=${sp.start}` : "/admin/room-rack");
}
