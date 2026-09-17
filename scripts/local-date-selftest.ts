// lib/local-date: addDaysISO må gi samme svar uansett runtime-sone.
// Kjør: npm run local-date  (kjører seg selv i tre soner)
import { execFileSync } from 'node:child_process'
import { addDaysISO } from '../lib/local-date.ts'

let ok = 0, feil = 0
const sjekk = (navn: string, b: boolean, detalj = '') => { if (b) { ok++; console.log(`  ok   ${navn}`) } else { feil++; console.log(`  FEIL ${navn}${detalj ? `\n       ${detalj}` : ''}`) } }

if (process.env.LOCAL_DATE_INDRE) {
  const tz = process.env.TZ ?? '(ingen)'
  sjekk(`[${tz}] +1 dag gir NESTE dag (fella: samme dato tilbake)`, addDaysISO('2026-09-16', 1) === '2026-09-17', addDaysISO('2026-09-16', 1))
  sjekk(`[${tz}] -1 dag`, addDaysISO('2026-09-16', -1) === '2026-09-15')
  sjekk(`[${tz}] over sommertid-start (29. mars 2026)`, addDaysISO('2026-03-28', 2) === '2026-03-30')
  sjekk(`[${tz}] over sommertid-slutt (25. okt 2026)`, addDaysISO('2026-10-24', 2) === '2026-10-26')
  sjekk(`[${tz}] over årsskiftet`, addDaysISO('2025-12-31', 1) === '2026-01-01' && addDaysISO('2026-01-01', -1) === '2025-12-31')
  sjekk(`[${tz}] skuddår`, addDaysISO('2028-02-28', 1) === '2028-02-29')
  sjekk(`[${tz}] 0 dager er identitet`, addDaysISO('2026-06-01', 0) === '2026-06-01')
  console.log(`${ok} OK · ${feil} FEIL`)
  if (feil > 0) process.exitCode = 1
} else {
  console.log('\nLOCAL-DATE - addDaysISO i tre soner\n')
  let alleOk = true
  for (const tz of ['Europe/Oslo', 'UTC', 'Pacific/Kiritimati', 'America/Los_Angeles']) {
    try {
      const ut = execFileSync(process.execPath, [...process.execArgv, process.argv[1]], { env: { ...process.env, TZ: tz, LOCAL_DATE_INDRE: '1' }, encoding: 'utf8' })
      process.stdout.write(ut)
    } catch (e) { alleOk = false; process.stdout.write(String((e as { stdout?: string }).stdout ?? e)) }
  }
  console.log(alleOk ? '\nALT OK' : '\nFEIL')
  if (!alleOk) process.exitCode = 1
}
