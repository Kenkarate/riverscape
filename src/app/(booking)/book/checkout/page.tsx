"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Script from "next/script";
import {
  User,
  Mail,
  Phone,
  MessageSquare,
  Tag,
  Check,
  Loader2,
  ShieldCheck,
  ChevronLeft,
  AlertCircle,
  MessageCircle,
  CalendarDays,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { calculatePrice, formatINR } from "@/lib/pricing";
import { formatStayDate, nightsBetween } from "@/lib/booking-helpers";
import { waLink } from "@/lib/data";
import {
  MEAL_PLANS,
  mealPlanLabel,
  type AddonItem,
  type AvailabilityResponse,
  type AvailableRoom,
  type CouponResult,
  type CreateOrderResponse,
  type MealPlan,
  type RazorpayInstance,
  type RazorpayOptions,
} from "@/types/booking";

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

const RZP_SCRIPT_ID = "razorpay-checkout-js";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const BASE_OCCUPANCY = 2; // matches server (roomType.baseOccupancy ?? 2)

/** Inject the Razorpay checkout script if not already present, resolve when ready. */
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);

    const existing = document.getElementById(RZP_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }

    const script = document.createElement("script");
    script.id = RZP_SCRIPT_ID;
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function isValidDate(s: string | null): s is string {
  if (!s || !DATE_RE.test(s)) return false;
  return !Number.isNaN(new Date(s + "T00:00:00").getTime());
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<CenteredSpinner label="Loading your booking…" />}>
      <CheckoutFlow />
    </Suspense>
  );
}

function CheckoutFlow() {
  const router = useRouter();
  const sp = useSearchParams();

  // --- Parse + validate query params ---
  const checkIn = sp.get("checkIn");
  const checkOut = sp.get("checkOut");
  const roomTypeSlug = sp.get("roomTypeSlug");
  const adults = Math.max(1, Number(sp.get("adults")) || 2);
  const children = Math.max(0, Number(sp.get("children")) || 0);
  const mealPlanParam = (sp.get("mealPlan") as MealPlan) || "ROOM_ONLY";
  const mealPlan: MealPlan = MEAL_PLANS.some((m) => m.value === mealPlanParam)
    ? mealPlanParam
    : "ROOM_ONLY";

  const paramsValid =
    isValidDate(checkIn) &&
    isValidDate(checkOut) &&
    (checkOut as string) > (checkIn as string) &&
    !!roomTypeSlug;

  // --- Data state ---
  const [room, setRoom] = useState<AvailableRoom | null>(null);
  const [addons, setAddons] = useState<AddonItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // --- Flow state ---
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 — guest
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [guestErrors, setGuestErrors] = useState<Record<string, string>>({});

  // Step 2 — extras
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<CouponResult | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);

  // Step 3 — payment
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const nights = isValidDate(checkIn) && isValidDate(checkOut) ? nightsBetween(checkIn, checkOut) : 0;

  // Redirect home on malformed params.
  useEffect(() => {
    if (!paramsValid) router.replace("/");
  }, [paramsValid, router]);

  // Load room + addons.
  useEffect(() => {
    if (!paramsValid) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const qs = new URLSearchParams({
          checkIn: checkIn as string,
          checkOut: checkOut as string,
          adults: String(adults),
          children: String(children),
        });
        const [availRes, addonRes] = await Promise.all([
          fetch(`/api/availability?${qs.toString()}`, { cache: "no-store" }),
          fetch(`/api/addons`, { cache: "no-store" }),
        ]);

        if (!availRes.ok) throw new Error("Could not load availability");
        const availData = (await availRes.json()) as AvailabilityResponse;
        const found = availData.rooms.find((r) => r.slug === roomTypeSlug) ?? null;

        const addonData = addonRes.ok ? await addonRes.json() : { addons: [] };

        if (cancelled) return;
        setRoom(found);
        setAddons((addonData.addons as AddonItem[]) ?? []);
        if (!found) {
          setLoadError(
            "This room is no longer available for your selected dates. Please choose another room."
          );
        }
      } catch {
        if (!cancelled) setLoadError("Something went wrong loading your booking. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsValid, checkIn, checkOut, adults, children, roomTypeSlug]);

  const extraAdults = Math.max(0, adults - BASE_OCCUPANCY);

  // --- Price quote (mirrors the server's calculatePrice exactly) ---
  const selectedAddons = useMemo(
    () => addons.filter((a) => selectedAddonIds.includes(a.id)),
    [addons, selectedAddonIds]
  );

  const quote = useMemo(() => {
    if (!room || nights < 1) return null;
    return calculatePrice({
      checkIn: new Date((checkIn as string) + "T00:00:00"),
      checkOut: new Date((checkOut as string) + "T00:00:00"),
      ratePerNight: room.ratePlan.basePrice,
      extraAdults,
      extraAdultPrice: room.ratePlan.extraAdultPrice,
      extraChildrenWithBed: 0,
      extraChildWithBedPrice: room.ratePlan.extraChildWithBed,
      extraChildrenNoBed: children,
      extraChildNoBedPrice: room.ratePlan.extraChildNoBed,
      addons: selectedAddons.map((a) => ({ price: a.price, quantity: 1, gstRate: a.gstRate })),
      couponDiscount: coupon?.valid ? coupon.discount ?? 0 : 0,
    });
  }, [room, nights, checkIn, checkOut, extraAdults, children, selectedAddons, coupon]);

  // Display breakdown pieces.
  const extraAdultCharges = room ? extraAdults * room.ratePlan.extraAdultPrice * nights : 0;
  const extraChildCharges = room ? children * room.ratePlan.extraChildNoBed * nights : 0;
  const addonBase = selectedAddons.reduce((s, a) => s + a.price, 0);
  // Coupon is computed by the server on room + extra-adult subtotal only.
  const couponBase = (quote?.roomSubtotal ?? 0) + extraAdultCharges;

  const toggleAddon = useCallback((id: string) => {
    setSelectedAddonIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  function validateGuest(): boolean {
    const errs: Record<string, string> = {};
    if (name.trim().length < 2) errs.name = "Please enter your full name";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = "Enter a valid email address";
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) errs.phone = "Enter a valid phone number (10+ digits)";
    setGuestErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleContinueFromGuest() {
    if (validateGuest()) setStep(2);
  }

  async function handleApplyCoupon() {
    const code = couponInput.trim().toUpperCase();
    if (!code || !quote) return;
    setCouponLoading(true);
    setCouponMessage(null);
    try {
      const res = await fetch(`/api/coupons/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, amount: couponBase }),
      });
      const data = (await res.json()) as CouponResult;
      if (data.valid) {
        setCoupon({ ...data, code });
        setCouponMessage(`Coupon "${code}" applied — you save ${formatINR(data.discount ?? 0)}.`);
      } else {
        setCoupon(null);
        setCouponMessage(data.message ?? "This coupon is not valid.");
      }
    } catch {
      setCoupon(null);
      setCouponMessage("Could not validate the coupon. Please try again.");
    } finally {
      setCouponLoading(false);
    }
  }

  function removeCoupon() {
    setCoupon(null);
    setCouponInput("");
    setCouponMessage(null);
  }

  async function handlePay() {
    if (!room || !quote) return;
    setPaying(true);
    setPayError(null);

    try {
      const orderRes = await fetch(`/api/payments/razorpay/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkIn,
          checkOut,
          adults,
          children,
          roomTypeSlug,
          mealPlan,
          addonIds: selectedAddonIds,
          couponCode: coupon?.valid ? coupon.code : undefined,
          guestName: name.trim(),
          guestEmail: email.trim(),
          guestPhone: phone.trim(),
          specialRequests: specialRequests.trim() || undefined,
        }),
      });

      const order = (await orderRes.json()) as CreateOrderResponse & { error?: unknown };
      if (!orderRes.ok) {
        const msg =
          typeof order.error === "string"
            ? order.error
            : "We couldn't start your payment. Please try again.";
        setPayError(msg);
        setPaying(false);
        return;
      }

      // Server has no Razorpay keys configured — fall back to WhatsApp.
      if (!order.razorpayOrderId || !order.keyId) {
        setPayError(
          `Online payment is currently unavailable. Your booking reference is ${order.bookingRef} — please complete it with us on WhatsApp.`
        );
        setPaying(false);
        return;
      }

      const ready = await loadRazorpayScript();
      if (!ready || !window.Razorpay) {
        setPayError("Could not load the payment gateway. Check your connection and try again.");
        setPaying(false);
        return;
      }

      const options: RazorpayOptions = {
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "Riverscape Resort",
        description: "Room Booking",
        order_id: order.razorpayOrderId,
        prefill: {
          name: order.guestName,
          email: order.guestEmail,
          contact: order.guestPhone,
        },
        theme: { color: "#1a3a2a" },
        handler: async (response) => {
          try {
            const verifyRes = await fetch(`/api/payments/razorpay/verify`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                bookingRef: order.bookingRef,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              }),
            });
            const verifyData = await verifyRes.json();
            if (verifyRes.ok && verifyData.success) {
              router.push(`/book/confirmation?ref=${order.bookingRef}`);
            } else {
              setPayError(
                `Payment received but verification failed. Please contact us with reference ${order.bookingRef}.`
              );
              setPaying(false);
            }
          } catch {
            setPayError(
              `We couldn't confirm your payment. Please contact us with reference ${order.bookingRef}.`
            );
            setPaying(false);
          }
        },
        modal: {
          ondismiss: () => setPaying(false),
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (resp) => {
        setPayError(resp?.error?.description ?? "Your payment could not be completed.");
        setPaying(false);
      });
      rzp.open();
    } catch {
      setPayError("Something went wrong starting your payment. Please try again.");
      setPaying(false);
    }
  }

  // --- Render guards ---
  if (!paramsValid) return <CenteredSpinner label="Redirecting…" />;
  if (loading) return <CenteredSpinner label="Loading your booking…" />;

  if (loadError || !room) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20">
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-forest/20 bg-white px-6 py-16 text-center">
          <AlertCircle size={30} className="text-gold-dark" />
          <h1 className="mt-4 font-serif text-2xl text-forest">We hit a snag</h1>
          <p className="mt-2 max-w-md text-sm text-forest/65">
            {loadError ?? "This room could not be loaded."}
          </p>
          <Link
            href={`/book/rooms?${new URLSearchParams({
              checkIn: checkIn as string,
              checkOut: checkOut as string,
              adults: String(adults),
              children: String(children),
            }).toString()}`}
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-forest px-7 py-3 text-sm font-medium text-cream transition-colors hover:bg-forest-light"
          >
            <ChevronLeft size={16} />
            Choose another room
          </Link>
        </div>
      </div>
    );
  }

  const waMessage = `Hi, I'd like to book the ${room.name} at Riverscape.
Check-in: ${formatStayDate(checkIn as string)}
Check-out: ${formatStayDate(checkOut as string)}
Guests: ${adults} adult${adults > 1 ? "s" : ""}${children > 0 ? `, ${children} child${children > 1 ? "ren" : ""}` : ""}
Meal plan: ${mealPlanLabel(mealPlan)}`;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 lg:px-10 lg:py-14">
      <Script id={RZP_SCRIPT_ID} src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      <Link
        href={`/book/rooms?${new URLSearchParams({
          checkIn: checkIn as string,
          checkOut: checkOut as string,
          adults: String(adults),
          children: String(children),
        }).toString()}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-forest/60 transition-colors hover:text-forest"
      >
        <ChevronLeft size={16} />
        Back to rooms
      </Link>

      <Stepper step={step} />

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
        {/* --- Left: step content --- */}
        <div>
          {step === 1 && (
            <GuestStep
              name={name}
              email={email}
              phone={phone}
              specialRequests={specialRequests}
              errors={guestErrors}
              onName={setName}
              onEmail={setEmail}
              onPhone={setPhone}
              onSpecialRequests={setSpecialRequests}
              onContinue={handleContinueFromGuest}
            />
          )}

          {step === 2 && (
            <ExtrasStep
              addons={addons}
              selectedAddonIds={selectedAddonIds}
              toggleAddon={toggleAddon}
              couponInput={couponInput}
              setCouponInput={setCouponInput}
              coupon={coupon}
              couponLoading={couponLoading}
              couponMessage={couponMessage}
              onApplyCoupon={handleApplyCoupon}
              onRemoveCoupon={removeCoupon}
              onBack={() => setStep(1)}
              onContinue={() => setStep(3)}
            />
          )}

          {step === 3 && (
            <PaymentStep
              room={room}
              checkIn={checkIn as string}
              checkOut={checkOut as string}
              adults={adults}
              childrenCount={children}
              nights={nights}
              mealPlan={mealPlan}
              guestName={name}
              total={quote?.totalAmount ?? 0}
              paying={paying}
              payError={payError}
              onBack={() => setStep(2)}
              onPay={handlePay}
              waMessage={waMessage}
            />
          )}
        </div>

        {/* --- Right: sticky price summary --- */}
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <PriceSummary
            room={room}
            checkIn={checkIn as string}
            checkOut={checkOut as string}
            adults={adults}
            childrenCount={children}
            nights={nights}
            mealPlan={mealPlan}
            roomSubtotal={quote?.roomSubtotal ?? 0}
            extraAdultCharges={extraAdultCharges}
            extraChildCharges={extraChildCharges}
            addonBase={addonBase}
            selectedAddons={selectedAddons}
            tax={(quote?.roomTax ?? 0) + (quote?.addonTax ?? 0)}
            discount={quote?.discountAmount ?? 0}
            total={quote?.totalAmount ?? 0}
            couponCode={coupon?.valid ? coupon.code : undefined}
          />
        </aside>
      </div>
    </div>
  );
}

/* ---------------------------------- Stepper --------------------------------- */

function Stepper({ step }: { step: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: "Your details" },
    { n: 2, label: "Extras" },
    { n: 3, label: "Payment" },
  ];
  return (
    <div className="mt-6 flex items-center gap-2 sm:gap-4">
      {steps.map((s, i) => {
        const active = step === s.n;
        const done = step > s.n;
        return (
          <div key={s.n} className="flex flex-1 items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                  active && "bg-forest text-cream",
                  done && "bg-gold text-forest-dark",
                  !active && !done && "bg-forest/10 text-forest/50"
                )}
              >
                {done ? <Check size={15} strokeWidth={3} /> : s.n}
              </span>
              <span
                className={cn(
                  "hidden text-sm font-medium sm:inline",
                  active ? "text-forest" : "text-forest/50"
                )}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span className={cn("h-px flex-1", done ? "bg-gold" : "bg-forest/15")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------- Step 1: Guest ------------------------------ */

function GuestStep({
  name,
  email,
  phone,
  specialRequests,
  errors,
  onName,
  onEmail,
  onPhone,
  onSpecialRequests,
  onContinue,
}: {
  name: string;
  email: string;
  phone: string;
  specialRequests: string;
  errors: Record<string, string>;
  onName: (v: string) => void;
  onEmail: (v: string) => void;
  onPhone: (v: string) => void;
  onSpecialRequests: (v: string) => void;
  onContinue: () => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onContinue();
      }}
      className="rounded-2xl border border-forest/10 bg-white p-6 sm:p-8"
    >
      <h2 className="font-serif text-2xl text-forest">Who&apos;s checking in?</h2>
      <p className="mt-1 text-sm text-forest/60">
        We&apos;ll send your confirmation and booking reference to this email.
      </p>

      <div className="mt-6 space-y-5">
        <Field label="Full name" icon={<User size={15} />} error={errors.name}>
          <input
            type="text"
            value={name}
            onChange={(e) => onName(e.target.value)}
            placeholder="e.g. Ananya Mehta"
            autoComplete="name"
            className={inputClass(!!errors.name)}
          />
        </Field>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Email" icon={<Mail size={15} />} error={errors.email}>
            <input
              type="email"
              value={email}
              onChange={(e) => onEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className={inputClass(!!errors.email)}
            />
          </Field>

          <Field label="Phone" icon={<Phone size={15} />} error={errors.phone}>
            <input
              type="tel"
              value={phone}
              onChange={(e) => onPhone(e.target.value)}
              placeholder="+91 98470 00000"
              autoComplete="tel"
              className={inputClass(!!errors.phone)}
            />
          </Field>
        </div>

        <Field label="Special requests (optional)" icon={<MessageSquare size={15} />}>
          <textarea
            value={specialRequests}
            onChange={(e) => onSpecialRequests(e.target.value)}
            placeholder="Early check-in, dietary needs, anniversary…"
            rows={3}
            className={cn(inputClass(false), "resize-none")}
          />
        </Field>
      </div>

      <button
        type="submit"
        className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full bg-forest px-7 py-3.5 text-sm font-medium text-cream transition-all duration-300 hover:bg-forest-light sm:w-auto"
      >
        Continue
      </button>
    </form>
  );
}

/* ------------------------------ Step 2: Extras ----------------------------- */

function ExtrasStep({
  addons,
  selectedAddonIds,
  toggleAddon,
  couponInput,
  setCouponInput,
  coupon,
  couponLoading,
  couponMessage,
  onApplyCoupon,
  onRemoveCoupon,
  onBack,
  onContinue,
}: {
  addons: AddonItem[];
  selectedAddonIds: string[];
  toggleAddon: (id: string) => void;
  couponInput: string;
  setCouponInput: (v: string) => void;
  coupon: CouponResult | null;
  couponLoading: boolean;
  couponMessage: string | null;
  onApplyCoupon: () => void;
  onRemoveCoupon: () => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const applied = coupon?.valid ?? false;

  return (
    <div className="space-y-6">
      {/* Add-ons */}
      <div className="rounded-2xl border border-forest/10 bg-white p-6 sm:p-8">
        <h2 className="font-serif text-2xl text-forest">Enhance your stay</h2>
        <p className="mt-1 text-sm text-forest/60">
          Optional add-ons. Add as many as you like — or skip and continue.
        </p>

        {addons.length === 0 ? (
          <p className="mt-6 rounded-xl bg-cream px-4 py-5 text-sm text-forest/55">
            No add-ons are available right now. You can continue to payment.
          </p>
        ) : (
          <div className="mt-6 space-y-3">
            {addons.map((a) => {
              const checked = selectedAddonIds.includes(a.id);
              return (
                <label
                  key={a.id}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-4 rounded-xl border px-4 py-3.5 transition-colors",
                    checked
                      ? "border-forest bg-forest/5"
                      : "border-forest/12 hover:border-forest/30"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                        checked ? "border-forest bg-forest" : "border-forest/30"
                      )}
                    >
                      {checked && <Check size={13} className="text-cream" strokeWidth={3} />}
                    </span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAddon(a.id)}
                      className="sr-only"
                    />
                    <div>
                      <p className="text-sm font-medium text-forest">{a.name}</p>
                      <p className="text-xs text-forest/50">
                        {a.unit} · GST {a.gstRate}%
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-forest">
                    {formatINR(a.price)}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Coupon */}
      <div className="rounded-2xl border border-forest/10 bg-white p-6 sm:p-8">
        <h3 className="flex items-center gap-2 font-serif text-xl text-forest">
          <Tag size={18} className="text-gold-dark" />
          Have a coupon?
        </h3>

        {applied ? (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-forest/15 bg-forest/5 px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-medium text-forest">
              <Check size={16} className="text-forest" />
              {coupon?.code} applied
            </span>
            <button
              type="button"
              onClick={onRemoveCoupon}
              className="text-sm font-medium text-forest/60 underline-offset-2 hover:text-forest hover:underline"
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
              placeholder="Enter code"
              className={cn(inputClass(false), "uppercase")}
            />
            <button
              type="button"
              onClick={onApplyCoupon}
              disabled={couponLoading || !couponInput.trim()}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-forest/30 px-7 py-3 text-sm font-medium text-forest transition-colors hover:bg-forest hover:text-cream disabled:opacity-50"
            >
              {couponLoading ? <Loader2 size={16} className="animate-spin" /> : "Apply"}
            </button>
          </div>
        )}

        {couponMessage && (
          <p
            className={cn(
              "mt-3 text-sm",
              applied ? "text-forest" : "text-red-600"
            )}
          >
            {couponMessage}
          </p>
        )}
      </div>

      {/* Nav */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-forest/25 px-7 py-3.5 text-sm font-medium text-forest transition-colors hover:bg-forest/5"
        >
          <ChevronLeft size={16} />
          Back
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-forest px-7 py-3.5 text-sm font-medium text-cream transition-all duration-300 hover:bg-forest-light"
        >
          Continue to payment
        </button>
      </div>
    </div>
  );
}

/* ----------------------------- Step 3: Payment ----------------------------- */

function PaymentStep({
  room,
  checkIn,
  checkOut,
  adults,
  childrenCount,
  nights,
  mealPlan,
  guestName,
  total,
  paying,
  payError,
  onBack,
  onPay,
  waMessage,
}: {
  room: AvailableRoom;
  checkIn: string;
  checkOut: string;
  adults: number;
  childrenCount: number;
  nights: number;
  mealPlan: MealPlan;
  guestName: string;
  total: number;
  paying: boolean;
  payError: string | null;
  onBack: () => void;
  onPay: () => void;
  waMessage: string;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-forest/10 bg-white p-6 sm:p-8">
        <h2 className="font-serif text-2xl text-forest">Review &amp; pay</h2>
        <p className="mt-1 text-sm text-forest/60">
          Please confirm the details below, then pay securely to lock in your stay.
        </p>

        <dl className="mt-6 divide-y divide-forest/8 rounded-xl bg-cream/50">
          <SummaryRow icon={<CalendarDays size={15} className="text-gold-dark" />} label="Dates">
            {formatStayDate(checkIn)} → {formatStayDate(checkOut)}{" "}
            <span className="text-forest/50">({nights} night{nights > 1 ? "s" : ""})</span>
          </SummaryRow>
          <SummaryRow icon={<Users size={15} className="text-gold-dark" />} label="Guests">
            {adults} adult{adults > 1 ? "s" : ""}
            {childrenCount > 0
              ? `, ${childrenCount} child${childrenCount > 1 ? "ren" : ""}`
              : ""}
          </SummaryRow>
          <SummaryRow label="Room">{room.name}</SummaryRow>
          <SummaryRow label="Meal plan">{mealPlanLabel(mealPlan)}</SummaryRow>
          {guestName.trim() && <SummaryRow label="Guest">{guestName.trim()}</SummaryRow>}
        </dl>

        {payError && (
          <div className="mt-5 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{payError}</span>
          </div>
        )}

        <button
          type="button"
          onClick={onPay}
          disabled={paying}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gold px-7 py-4 text-base font-semibold tracking-wide text-forest-dark shadow-lg shadow-gold/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-60"
        >
          {paying ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Processing…
            </>
          ) : (
            <>
              <ShieldCheck size={18} />
              Pay {formatINR(total)}
            </>
          )}
        </button>

        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-forest/45">
          <ShieldCheck size={13} />
          Secured by Razorpay · 256-bit encryption
        </p>

        {/* WhatsApp fallback */}
        <div className="mt-6 border-t border-forest/8 pt-5 text-center">
          <p className="text-xs text-forest/55">Prefer to book over chat?</p>
          <a
            href={waLink(waMessage)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-2 rounded-full border border-forest/25 px-6 py-2.5 text-sm font-medium text-forest transition-colors hover:bg-forest hover:text-cream"
          >
            <MessageCircle size={16} />
            Book on WhatsApp instead
          </a>
        </div>
      </div>

      <button
        type="button"
        onClick={onBack}
        disabled={paying}
        className="inline-flex items-center justify-center gap-2 rounded-full border border-forest/25 px-7 py-3.5 text-sm font-medium text-forest transition-colors hover:bg-forest/5 disabled:opacity-50"
      >
        <ChevronLeft size={16} />
        Back
      </button>
    </div>
  );
}

function SummaryRow({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
      <dt className="flex items-center gap-2 text-forest/55">
        {icon}
        {label}
      </dt>
      <dd className="text-right font-medium text-forest">{children}</dd>
    </div>
  );
}

/* --------------------------- Price summary card ---------------------------- */

function PriceSummary({
  room,
  checkIn,
  checkOut,
  adults,
  childrenCount,
  nights,
  mealPlan,
  roomSubtotal,
  extraAdultCharges,
  extraChildCharges,
  addonBase,
  selectedAddons,
  tax,
  discount,
  total,
  couponCode,
}: {
  room: AvailableRoom;
  checkIn: string;
  checkOut: string;
  adults: number;
  childrenCount: number;
  nights: number;
  mealPlan: MealPlan;
  roomSubtotal: number;
  extraAdultCharges: number;
  extraChildCharges: number;
  addonBase: number;
  selectedAddons: AddonItem[];
  tax: number;
  discount: number;
  total: number;
  couponCode?: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-forest/10 bg-white shadow-sm">
      {/* Room header */}
      <div className="relative h-32 w-full">
        <Image
          src={room.images[0] || "/images/landscape/1.jpg"}
          alt={room.name}
          fill
          sizes="380px"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-forest-dark/70 to-transparent" />
        <div className="absolute bottom-3 left-4 right-4">
          <p className="font-serif text-lg text-cream">{room.name}</p>
          <p className="text-xs text-cream/80">{mealPlanLabel(mealPlan)}</p>
        </div>
      </div>

      <div className="p-5">
        <div className="flex items-center justify-between text-xs text-forest/55">
          <span>{formatStayDate(checkIn)} → {formatStayDate(checkOut)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-xs text-forest/55">
          <span>
            {nights} night{nights > 1 ? "s" : ""} · {adults} adult{adults > 1 ? "s" : ""}
            {childrenCount > 0
              ? `, ${childrenCount} child${childrenCount > 1 ? "ren" : ""}`
              : ""}
          </span>
        </div>

        <dl className="mt-4 space-y-2.5 border-t border-forest/8 pt-4 text-sm">
          <Line label={`Room (${nights} night${nights > 1 ? "s" : ""})`} value={formatINR(roomSubtotal)} />
          {extraAdultCharges > 0 && (
            <Line label="Extra adult charges" value={formatINR(extraAdultCharges)} />
          )}
          {extraChildCharges > 0 && (
            <Line label="Child charges" value={formatINR(extraChildCharges)} />
          )}
          {selectedAddons.length > 0 && (
            <Line label={`Add-ons (${selectedAddons.length})`} value={formatINR(addonBase)} />
          )}
          <Line label="Taxes & GST" value={formatINR(tax)} />
          {discount > 0 && (
            <Line
              label={couponCode ? `Discount (${couponCode})` : "Discount"}
              value={`− ${formatINR(discount)}`}
              accent
            />
          )}
        </dl>

        <div className="mt-4 flex items-end justify-between border-t border-forest/10 pt-4">
          <span className="text-sm font-semibold text-forest">Total</span>
          <span className="font-serif text-2xl text-forest">{formatINR(total)}</span>
        </div>
        <p className="mt-1 text-right text-[11px] text-forest/45">Incl. all taxes</p>
      </div>
    </div>
  );
}

function Line({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-forest/60">{label}</dt>
      <dd className={cn("font-medium", accent ? "text-gold-dark" : "text-forest")}>{value}</dd>
    </div>
  );
}

/* --------------------------------- Shared ---------------------------------- */

function Field({
  label,
  icon,
  error,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.15em] text-forest/50">
        {icon}
        {label}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

function inputClass(hasError: boolean): string {
  return cn(
    "w-full rounded-xl border bg-cream/40 px-4 py-3 text-sm text-forest placeholder:text-forest/35 outline-none transition-colors focus:border-forest focus:bg-white",
    hasError ? "border-red-400" : "border-forest/15"
  );
}

function CenteredSpinner({ label }: { label: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-forest/60">
      <Loader2 size={28} className="animate-spin text-gold-dark" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
