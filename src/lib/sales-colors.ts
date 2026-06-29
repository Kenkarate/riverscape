/**
 * Predefined palette of personal "sales colors" staff can pick for their
 * allocation chips on the allocation grid. Shared by the allocation grid,
 * the admin topbar picker, and the login page picker.
 */
export const SALES_COLOR_PALETTE = [
  "#0d9488", // teal
  "#2563eb", // blue
  "#7c3aed", // violet
  "#c026d3", // fuchsia
  "#e11d48", // rose
  "#ea580c", // orange
  "#ca8a04", // amber
  "#65a30d", // lime
  "#0891b2", // cyan
  "#4f46e5", // indigo
] as const;

/** Fallback chip color when a staff member has not chosen one. */
export const SALES_COLOR_DEFAULT = "#6b7280"; // gray-500
