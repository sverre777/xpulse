# X-PULSE — Oppsett og kjøring lokalt

## 1. Opprett Supabase-prosjekt

1. Gå til [supabase.com](https://supabase.com) og logg inn
2. Klikk **New project**
3. Gi prosjektet navn: `x-pulse`
4. Velg et sterkt databasepassord og region (f.eks. Frankfurt - eu-central-1)
5. Vent til prosjektet er klart (ca. 1-2 min)

## 2. Kjør database-skjema

1. I Supabase-dashboardet: gå til **SQL Editor**
2. Klikk **New query**
3. Kopier innholdet fra `supabase/schema.sql` og lim inn
4. Klikk **Run**

Dette oppretter:
- `profiles` — brukerprofiler med roller
- `workouts` — treningsøkter
- `coach_athlete_relations` — trener/utøver-koblinger
- Row Level Security på alle tabeller
- Trigger som auto-oppretter profil ved registrering

## 3. Hent API-nøkler

1. I Supabase: gå til **Settings → API**
2. Kopier:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 4. Konfigurer miljøvariabler

Åpne filen `.env.local` og fyll inn verdiene:

```
NEXT_PUBLIC_SUPABASE_URL=https://DITT-PROSJEKT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

## 5. Start appen lokalt

```bash
npm run dev
```

Åpne [http://localhost:3000](http://localhost:3000)

## 6. Konfigurer Auth (valgfritt men anbefalt)

I Supabase: **Authentication → URL Configuration**

- **Site URL**: `http://localhost:3000`
- **Redirect URLs**: legg til `http://localhost:3000/auth/callback`

---

## Mappestruktur

```
x-pulse/
├── app/
│   ├── page.tsx              # Landingsside
│   ├── layout.tsx            # Root layout
│   ├── globals.css           # Global CSS + fonter
│   ├── login/page.tsx        # Innlogging
│   ├── register/page.tsx     # Registrering med rolleval
│   ├── athlete/page.tsx      # Utøver-dashboard
│   ├── coach/page.tsx        # Trener-panel
│   ├── auth/callback/        # Supabase auth callback
│   └── actions/auth.ts       # Server Actions for auth
├── components/
│   ├── AuthCard.tsx
│   ├── FormField.tsx
│   ├── SubmitButton.tsx
│   └── dashboard/
│       ├── NavBar.tsx
│       ├── StatCard.tsx
│       └── PlaceholderPanel.tsx
├── lib/
│   ├── types.ts              # TypeScript-typer
│   └── supabase/
│       ├── client.ts         # Browser-klient
│       ├── server.ts         # Server-klient
│       └── middleware.ts     # Auth-middleware
├── middleware.ts             # Next.js middleware (ruting)
└── supabase/
    └── schema.sql            # Database-skjema
```

## Roller

| Rolle    | Rutes til    | Aksent  |
|----------|-------------|---------|
| Utøver   | `/athlete`  | Oransje |
| Trener   | `/coach`    | Blå     |

## Neste fase (Fase 2)

- Treningsdagbok med CRUD
- Pulsgrafer (Recharts)
- Trener-utøver koblingssystem
- Treningsplanlegger
```
