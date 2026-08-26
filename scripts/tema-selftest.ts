/**
 * Selvtest for tema-bryteren. Kjør: npx tsx scripts/tema-selftest.ts
 *
 * Tester sømmen mot den ekte modulen, ikke en gjenskrevet kopi av reglene:
 * localStorage og matchMedia stubbes, resten er lib/tema.ts.
 */
type Store = Record<string, string>

function medNettleser(lagret: Store, osLys: boolean, kastVedSkriving = false) {
  const store: Store = { ...lagret }
  const g = globalThis as Record<string, unknown>
  g.window = {
    localStorage: {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => {
        if (kastVedSkriving) throw new Error('blokkert')
        store[k] = v
      },
      removeItem: (k: string) => {
        if (kastVedSkriving) throw new Error('blokkert')
        delete store[k]
      },
    },
    matchMedia: (q: string) => ({ matches: q.includes('light') ? osLys : !osLys }),
  }
  const metaer: { name: string; content: string }[] = []
  g.document = {
    documentElement: { dataset: {} as Record<string, string> },
    head: { appendChild: (m: { name: string; content: string }) => metaer.push(m) },
    querySelector: (sel: string) =>
      sel.includes('theme-color') ? metaer.find(m => m.name === 'theme-color') ?? null : null,
    createElement: () => {
      const m = { name: '', content: '', setAttribute(k: string, v: string) {
        if (k === 'name') m.name = v; else if (k === 'content') m.content = v
      }, getAttribute: (k: string) => (k === 'name' ? m.name : m.content) }
      return m
    },
  }
  g.__metaer = metaer
  return store
}

let feil = 0
function sjekk(navn: string, faktisk: unknown, ventet: unknown) {
  const ok = faktisk === ventet
  if (!ok) feil++
  console.log(`${ok ? 'OK  ' : 'FEIL'}  ${navn}: ${String(faktisk)}${ok ? '' : ` (ventet ${String(ventet)})`}`)
}

async function main() {
  const tema = await import('../lib/tema')

  medNettleser({}, false)
  sjekk('uten valg, mørkt OS', tema.gjeldendeTema(), 'mork')

  medNettleser({}, true)
  sjekk('uten valg, lyst OS — flagget av, så standard vinner', tema.gjeldendeTema(), 'mork')
  sjekk('osTema ser fortsatt sannheten', tema.osTema(), 'lys')

  medNettleser({ [tema.TEMA_NOKKEL]: 'lys' }, false)
  sjekk('eget valg lys slår mørkt OS', tema.gjeldendeTema(), 'lys')

  medNettleser({ [tema.TEMA_NOKKEL]: 'mork' }, true)
  sjekk('eget valg mørk slår lyst OS', tema.gjeldendeTema(), 'mork')

  medNettleser({ [tema.TEMA_NOKKEL]: 'tullball' }, false)
  sjekk('ugyldig lagret verdi ignoreres', tema.gjeldendeTema(), 'mork')

  const s = medNettleser({}, false)
  sjekk('settTema returnerer valget', tema.settTema('lys'), 'lys')
  sjekk('settTema husker valget', s[tema.TEMA_NOKKEL], 'lys')
  sjekk('settTema skriver attributtet',
    (globalThis as { document: { documentElement: { dataset: Record<string, string> } } })
      .document.documentElement.dataset.tema, 'lys')
  tema.settTema(null)
  sjekk('settTema(null) glemmer valget', tema.TEMA_NOKKEL in s, false)

  medNettleser({}, false, true)
  sjekk('blokkert localStorage kaster ikke', tema.settTema('lys'), 'lys')

  // Inline-skriptet må gjenspeile flagget, ellers blinker flata i feil tema.
  sjekk('inline-skriptet bærer flagget',
    tema.TEMA_INLINE_SKRIPT.includes(String(tema.TEMA_FOLG_OS)), true)
  sjekk('inline-skriptet bærer nøkkelen',
    tema.TEMA_INLINE_SKRIPT.includes(tema.TEMA_NOKKEL), true)

  // Bryter-regelen: ikonet og etiketten viser hva du BYTTER TIL.
  sjekk('mork -> neste er lys', tema.nesteTema('mork'), 'lys')
  sjekk('lys -> neste er mork', tema.nesteTema('lys'), 'mork')
  sjekk('umontert (null) -> neste er lys', tema.nesteTema(null), 'lys')
  sjekk('etikett sier hva knappen gjor', tema.temaEtikett('lys'), 'Bytt til lys modus')
  sjekk('etikett andre vei', tema.temaEtikett('mork'), 'Bytt til mørk modus')

  // Statuslinja ma folge temaet, ellers far man mork statuslinje over lys app.
  medNettleser({}, false)
  tema.settTema('lys')
  const metaLys = (globalThis as unknown as { __metaer: { name: string; content: string }[] }).__metaer
  sjekk('statuslinja blir lys', metaLys.find(m => m.name === 'theme-color')?.content,
    tema.TEMA_STATUSLINJE.lys)
  tema.settTema('mork')
  sjekk('statuslinja blir mork igjen', metaLys.find(m => m.name === 'theme-color')?.content,
    tema.TEMA_STATUSLINJE.mork)
  sjekk('kun EN theme-color-tagg lages',
    metaLys.filter(m => m.name === 'theme-color').length, 1)

  // Inline-skriptet ma sette statuslinja for forste maling.
  sjekk('inline-skriptet setter theme-color',
    tema.TEMA_INLINE_SKRIPT.includes('theme-color'), true)
  sjekk('inline-skriptet baerer begge fargene',
    tema.TEMA_INLINE_SKRIPT.includes(tema.TEMA_STATUSLINJE.lys) &&
    tema.TEMA_INLINE_SKRIPT.includes(tema.TEMA_STATUSLINJE.mork), true)

  console.log(feil === 0 ? '\nAlle tester grønne.' : `\n${feil} feil.`)
  process.exit(feil === 0 ? 0 : 1)
}
void main()
