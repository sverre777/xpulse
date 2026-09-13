import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
const ROT = '/Users/sveco/Desktop/Claude x-pulse/x-pulse/'
const ik = JSON.parse(readFileSync('/private/tmp/claude-501/-Users-sveco/d659923d-1971-4ec7-b0a5-5c8b465ea454/scratchpad/ikonsett/ikoner.json', 'utf8'))
const navn = Object.keys(ik).sort()
const q = s => `'${s}'`
let tsx = `// ═══ X-PULSE-ikonene - ÉN fil, ett sett (Sverre 13. sep 2026) ═══
// Formen er sporet fra Sverres 15 ikonark i design/ikoner (fasit for FORM).
// Farge, størrelse og strektykkelse styres HER, aldri av arkene:
//   - fill/stroke = currentColor: ikonet arver tekstfargen der det står
//     (grå i topplinja, oransje i menyene, gull/sølv/bronse for A/B/C-renn).
//   - strek: strokeWidth 1.7, round cap/join. Fyll: fylte flater.
//   - størrelser: 14 / 18 / 22 / 26 px. Ingen andre.
// Generert av scripts/ikoner/generer.mjs fra sporingen (scripts/ikoner/spor.mjs) -
// rediger ikke path-dataene for hånd; spor arket på nytt.
import type { CSSProperties } from 'react'

export type IkonNavn =
${navn.map(n => '  | ' + q(n)).join('\n')}

export type IkonVariant = 'fyll' | 'strek'
export type IkonStorrelse = 14 | 18 | 22 | 26

interface StrekDef { linjer: string; fyll?: string }
interface IkonDef { ark: string[]; fyll?: string; strek?: StrekDef }

export const IKON_NAVN: IkonNavn[] = [
${navn.map(n => '  ' + q(n) + ',').join('\n')}
]

const IKONER: Record<IkonNavn, IkonDef> = {
`
for (const n of navn) {
  const d = ik[n]
  tsx += `  ${q(n)}: {\n    ark: [${d.ark.map(a => q(a.slice(0, 2))).join(', ')}],\n`
  if (d.fyll) tsx += `    fyll: ${q(d.fyll)},\n`
  if (d.strek && d.strek.linjer) tsx += `    strek: { linjer: ${q(d.strek.linjer)}${d.strek.fyll ? `, fyll: ${q(d.strek.fyll)}` : ''} },\n`
  else if (d.strek && d.strek.fyll) tsx += `    strek: { linjer: '', fyll: ${q(d.strek.fyll)} },\n`
  tsx += `  },\n`
}
tsx += `}

export interface IkonProps {
  navn: IkonNavn
  /** strek (tynn) i menyer, topplinje, knapper, innstillinger; fyll for markeringer i plan/dagbok/graf. */
  variant?: IkonVariant
  storrelse?: IkonStorrelse
  className?: string
  style?: CSSProperties
  /** Settes bare når ikonet står ALENE og bærer mening (ellers er det dekor for skjermleseren). */
  tittel?: string
}

/** Hvilken variant som faktisk finnes: faller stille tilbake til den andre. */
export function ikonVariant(navn: IkonNavn, onsket: IkonVariant = 'strek'): IkonVariant {
  const d = IKONER[navn]
  if (onsket === 'fyll') return d.fyll ? 'fyll' : 'strek'
  return d.strek ? 'strek' : 'fyll'
}

export function Ikon({ navn, variant = 'strek', storrelse = 18, className, style, tittel }: IkonProps) {
  const d = IKONER[navn]
  const bruk = ikonVariant(navn, variant)
  return (
    <svg viewBox="0 0 24 24" width={storrelse} height={storrelse}
      aria-hidden={tittel ? undefined : true} role={tittel ? 'img' : undefined}
      className={className} data-ikon={navn} data-variant={bruk}
      style={{ display: 'inline-block', flexShrink: 0, verticalAlign: 'middle', ...style }}>
      {tittel && <title>{tittel}</title>}
      {bruk === 'fyll'
        ? <path d={d.fyll} fill="currentColor" fillRule="evenodd" />
        : <>
            {d.strek?.linjer && <path d={d.strek.linjer} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />}
            {d.strek?.fyll && <path d={d.strek.fyll} fill="currentColor" fillRule="evenodd" />}
          </>}
    </svg>
  )
}
`
mkdirSync(ROT + 'components/ui', { recursive: true })
writeFileSync(ROT + 'components/ui/ikoner.tsx', tsx)
// README-tabell
const arkNavn = { '01': '01 handlinger fyll', '02': '02 handlinger strek', '03': '03 meny fyll', '04': '04 meny strek', '05': '05 idrett', '06': '06 kalender', '07': '07 varmetrening', '08': '08 trening og ernæring', '09': '09 treningsverdier', '10': '10 utstyr', '11': '11 verktøy', '12': '12 øktbygger', '13': '13 kalender og økt', '14': '14 bibliotek og innstillinger', '15': '15 oppdaterte ikoner' }
let md = `# Ikonsettet\n\nSverres 15 ikonark er FASIT FOR FORM. Sporingen (scripts/ikoner/spor.mjs) lager\n\`components/ui/ikoner.tsx\`: fyll via potrace, strek via midtlinje (skjelett), 24x24-boks.\nFarge (currentColor), størrelse (14/18/22/26) og strektykkelse (1.7) styres av komponenten\n\`<Ikon navn=... variant=... storrelse=... />\`, ikke av arkene.\n\n${navn.length} ikoner. Navn på norsk i kebab-case etter teksten på arkene.\n\n| navn | ark | varianter |\n|---|---|---|\n`
for (const n of navn) { const d = ik[n]; md += `| ${n} | ${d.ark.map(a => arkNavn[a.slice(0, 2)] ?? a).join(', ')} | ${[d.fyll ? 'fyll' : null, d.strek ? 'strek' : null].filter(Boolean).join(' + ')} |\n` }
md += `\nMerknader:\n- \`skyting\` står på ark 01/02 (Handlinger) og ark 05 (Idrett) med samme form; ark 05 er brukt.\n- Ark 09 sitt lyn («Watt») er erstattet av ark 15: lynet heter \`aktivitet\` (aktivitet/drag), \`watt\` er måleren med full sirkel.\n- Ark 13 sitt termometer («Sykdom») er erstattet av ark 15 sitt kors (\`sykdom\`); termometeret lever som \`termometer\` for temperatur/vær.\n- \`tempo\` = måler med halvbue (ark 09); \`watt\` = full sirkel (ark 15). Skilles også av farge i konteksten.\n- \`mer\` (fire ruter) og \`multisport\` (tre ruter + pluss) skal aldri stå i samme rad/meny.\n`
writeFileSync(ROT + 'design/ikoner/README.md', md)
console.log('skrev ikoner.tsx (', (tsx.length / 1024).toFixed(0), 'KB ) + README', navn.length)
