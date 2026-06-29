export const GST_THRESHOLD = 750000; // paise — ₹7,500
export const GST_LOW = 12;
export const GST_HIGH = 18;
export const ADDON_GST = 5;

export function getGstRate(ratePerNightPaise: number): 12 | 18 {
  return ratePerNightPaise <= GST_THRESHOLD ? GST_LOW : GST_HIGH;
}

export interface NightLine {
  date: string;      // YYYY-MM-DD
  rate: number;      // paise
  gstRate: number;
  taxAmount: number; // paise
}

export function buildNightLines(
  checkIn: Date,
  checkOut: Date,
  ratePerNight: number
): NightLine[] {
  const lines: NightLine[] = [];
  const current = new Date(checkIn);
  current.setHours(0, 0, 0, 0);
  const end = new Date(checkOut);
  end.setHours(0, 0, 0, 0);

  while (current < end) {
    const gstRate = getGstRate(ratePerNight);
    const taxAmount = Math.round((ratePerNight * gstRate) / 100);
    lines.push({
      date: current.toISOString().slice(0, 10),
      rate: ratePerNight,
      gstRate,
      taxAmount,
    });
    current.setDate(current.getDate() + 1);
  }

  return lines;
}

export interface PriceSummary {
  nights: NightLine[];
  roomSubtotal: number;
  roomTax: number;
  addonSubtotal: number;
  addonTax: number;
  discountAmount: number;
  totalAmount: number;
}

export interface PriceInput {
  checkIn: Date;
  checkOut: Date;
  ratePerNight: number;
  extraAdults: number;
  extraAdultPrice: number;
  extraChildrenWithBed: number;
  extraChildWithBedPrice: number;
  extraChildrenNoBed: number;
  extraChildNoBedPrice: number;
  addons: Array<{ price: number; quantity: number; gstRate?: number }>;
  couponDiscount?: number;
}

export function calculatePrice(input: PriceInput): PriceSummary {
  const nightLines = buildNightLines(input.checkIn, input.checkOut, input.ratePerNight);
  const numNights = nightLines.length;

  const roomSubtotal = nightLines.reduce((s, n) => s + n.rate, 0);
  const roomTax = nightLines.reduce((s, n) => s + n.taxAmount, 0);

  // Extra guest charges are per-night
  const extraCharges =
    input.extraAdults * input.extraAdultPrice * numNights +
    input.extraChildrenWithBed * input.extraChildWithBedPrice * numNights +
    input.extraChildrenNoBed * input.extraChildNoBedPrice * numNights;

  const addonBase = input.addons.reduce((s, a) => s + a.price * a.quantity, 0);
  const addonSubtotal = addonBase + extraCharges;

  const addonTax = input.addons.reduce((s, a) => {
    const rate = a.gstRate ?? ADDON_GST;
    return s + Math.round((a.price * a.quantity * rate) / 100);
  }, 0);

  const discountAmount = input.couponDiscount ?? 0;

  const totalAmount =
    roomSubtotal + roomTax + addonSubtotal + addonTax - discountAmount;

  return {
    nights: nightLines,
    roomSubtotal,
    roomTax,
    addonSubtotal,
    addonTax,
    discountAmount,
    totalAmount,
  };
}

export function formatINR(paiseAmount: number): string {
  const rupees = paiseAmount / 100;
  return `₹${rupees.toLocaleString("en-IN")}`;
}
