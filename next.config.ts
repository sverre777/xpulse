import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // FEIL-1: default er 1 MB, og en ekte .fit (GPS + puls) er 1–5 MB —
      // hver ekte fil døde i rammeverket før uploadFitFile kjørte.
      // 4 MB er valgt mot Netlifys ~4,5 MB effektive binærtak; høyere tall
      // hadde bare flyttet den stille feilen ut til Netlify.
      // HOLD I TAKT med FIT_MAX_BYTES i lib/fit-limits.ts (kan ikke dele
      // konstant — denne fila leses før appkoden bygges).
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
