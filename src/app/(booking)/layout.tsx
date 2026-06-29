import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

export const metadata: Metadata = {
  title: "Book Your Stay | Riverscape Resort, Kerala",
  description:
    "Reserve your riverside retreat at Riverscape, Kalady Neeleswaram. Choose your room, dates and meal plan, then pay securely online.",
};

export default function BookingGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-cream pt-20">{children}</main>
      <Footer />
    </>
  );
}
