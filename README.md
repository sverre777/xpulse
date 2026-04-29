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
