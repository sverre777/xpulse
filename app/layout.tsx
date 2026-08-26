import type { Metadata, Viewport } from "next";
import "./globals.css";
import { CookieConsentBanner } from "@/components/legal/CookieConsentBanner";
import { DialogHost } from "@/components/ui/ConfirmDialog";
import { TEMA_INLINE_SKRIPT } from "@/lib/tema";

export const viewport: Viewport = {
  themeColor: "#0A0A0B",
};

export const metadata: Metadata = {
  // Absolutt base for canonical/OG-URLer på alle sider (Metadata API).
  metadataBase: new URL("https://x-pulse.no"),
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
    <html lang="no" className="h-full" suppressHydrationWarning>
      <head>
        {/* Setter data-tema før første maling, ellers blinker flata i feil
            tema. Fasiten for reglene er lib/tema.ts. Lysmodus er opt-in til
            steg 2 er ferdig — se design/lysmodus-tvil.md. */}
        <script dangerouslySetInnerHTML={{ __html: TEMA_INLINE_SKRIPT }} />
        {/* Preload av de to mest brukte fontfilene — resten hentes ved behov
            via @font-face i globals.css (self-hostet, samme familienavn). */}
        <link rel="preload" href="/fonts/barlow-condensed-normal-400-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/bebas-neue-normal-400-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body className="min-h-full flex flex-col" style={{ backgroundColor: '#0A0A0B' }}>
        {children}
        <CookieConsentBanner />
        <DialogHost />
      </body>
    </html>
  );
}
