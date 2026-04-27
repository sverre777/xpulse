import type { Metadata } from "next";
import "./globals.css";
import { CookieConsentBanner } from "@/components/legal/CookieConsentBanner";

export const metadata: Metadata = {
  title: "X-PULSE — Treningsapp for seriøse utøvere",
  description: "Avansert treningsapp for utholdenhetsidretter. Løping, langrenn, skiskyting, triatlon.",
  icons: {
    icon: [
      { url: "/x-pulse-icon.svg", type: "image/svg+xml" },
      { url: "/x-pulse-icon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/x-pulse-icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/x-pulse-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/x-pulse-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/x-pulse-icon-180.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="no" className="h-full">
      <body className="min-h-full flex flex-col" style={{ backgroundColor: '#0A0A0B' }}>
        {children}
        <CookieConsentBanner />
      </body>
    </html>
  );
}
