import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "X-PULSE — Treningsapp for seriøse utøvere",
  description: "Avansert treningsapp for utholdenhetsidretter. Løping, langrenn, skiskyting, triatlon.",
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
      </body>
    </html>
  );
}
