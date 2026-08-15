# X-PULSE

Treningsdagbok og planlegger for utholdenhet, bygget med Next.js + Supabase.

## Getting Started

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Netlify Functions](https://docs.netlify.com/functions/overview/)

## Deploy on Netlify

App-en hostes på Netlify. Scheduled Functions i `netlify/functions/`
håndterer cron-jobs (auto-synk fra Strava). Se `netlify.toml` for
build-config.

Påkrevde env-variabler i Netlify:
- `URL` (autofylles av Netlify til site-URL)
- `NEXT_PUBLIC_BASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (cron-jobs som bypasser RLS)
- `CRON_SECRET` (matcher Authorization-header på `/api/cron/*`-ruter)
- `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_REDIRECT_URI`
- `POLAR_CLIENT_ID`, `POLAR_CLIENT_SECRET`, `POLAR_REDIRECT_URI`,
  `POLAR_WEBHOOK_SECRET` (AccessLink — klient opprettes på
  admin.polaraccesslink.com). Registrert redirect-URL:
  `https://x-pulse.no/auth/polar/callback` — `POLAR_REDIRECT_URI` må matche
  den eksakt. `POLAR_WEBHOOK_SECRET` er `signature_secret_key` fra
  webhook-opprettelsen og brukes til HMAC-SHA256-verifisering.
