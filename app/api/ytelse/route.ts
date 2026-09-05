// YTELSE bolk 0 (Sverre 5. sep 2026): en liten måleflate uten data — svarer
// med regionen serverfunksjonen kjører i (AWS_REGION i Netlify-funksjonen)
// og tidsstempel, så avstanden Netlify ↔ Supabase kan leses utenfra med
// curl. Ingen auth, ingen databasekall, ingen personopplysninger.
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    region: process.env.AWS_REGION ?? process.env.NETLIFY_REGION ?? null,
    node: process.version,
    naa: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'no-store', 'Server-Timing': 'fn;dur=0' } })
}
