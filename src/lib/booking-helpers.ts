// Pure, client-safe helpers shared across the guest booking flow.
// (No server-only imports here so these can run in client components.)

/** Format a YYYY-MM-DD date for display, e.g. "Fri, 12 Jun 2026". */
export function formatStayDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Short form, e.g. "12 Jun 2026". */
export function formatStayDateShort(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Whole nights between two YYYY-MM-DD dates. */
export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(checkIn + "T00:00:00").getTime();
  const b = new Date(checkOut + "T00:00:00").getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/** Tailwind classes for a booking status pill. */
export function statusBadgeClass(status: string): string {
  switch (status) {
    case "CONFIRMED":
      return "bg-forest/10 text-forest ring-1 ring-forest/20";
    case "CHECKED_IN":
      return "bg-gold/15 text-gold-dark ring-1 ring-gold/30";
    case "CHECKED_OUT":
      return "bg-forest/5 text-forest/70 ring-1 ring-forest/10";
    case "PENDING":
      return "bg-amber-100 text-amber-700 ring-1 ring-amber-200";
    case "CANCELLED":
      return "bg-red-100 text-red-700 ring-1 ring-red-200";
    default:
      return "bg-forest/5 text-forest/70 ring-1 ring-forest/10";
  }
}

/** Human label for a booking status. */
export function statusLabel(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
