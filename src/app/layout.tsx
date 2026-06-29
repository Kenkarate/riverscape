import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-cormorant",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://riverscape.in"),
  title: "Riverscape | Luxury Riverside Resort in Kalady Neeleswaram, Kerala",
  description:
    "Riverscape is a luxury riverside resort in Kalady Neeleswaram, Kerala — just 10 km from Cochin International Airport. Pool villas, water-facing suites, spa, dining and river adventures. Where Nature Meets Luxury.",
  keywords: [
    "Riverscape resort",
    "Kerala resort",
    "Kalady Neeleswaram",
    "Cochin airport resort",
    "pool villa Kerala",
    "luxury riverside resort",
  ],
  openGraph: {
    title: "Riverscape | Luxury Riverside Resort in Kerala",
    description:
      "A luxury riverside resort in Kalady Neeleswaram, 10 km from Cochin International Airport. Where Nature Meets Luxury.",
    type: "website",
    images: ["/images/landscape/1.jpg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#1a3a2a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${cormorant.variable} ${inter.variable}`}>
      <head>
        <link rel="preload" as="image" href="/images/landscape/1.jpg" fetchPriority="high" />
      </head>
      <body className="antialiased">
        <Navbar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
