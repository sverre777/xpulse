// Y-aksen i øktgrafene (beslutning 17. sep) - ren logikk. npm run puls-akse
import { pulsAkseSpenn, sonespenn } from '../lib/puls-akse'
let ok = 0, feil = 0
const sjekk = (navn: string, v: boolean, info = '') => { if (v) ok++; else feil++; console.log(`  ${v ? 'ok  ' : 'FEIL'} ${navn}${!v && info ? ' - ' + info : ''}`) }
const S = [{ min_bpm: 110, max_bpm: 130 }, { min_bpm: 131, max_bpm: 150 }, { min_bpm: 151, max_bpm: 165 }, { min_bpm: 166, max_bpm: 175 }, { min_bpm: 176, max_bpm: 195 }]
const j = (s: unknown) => JSON.stringify(s)
console.log('\nPULSAKSEN - ren logikk\n')
sjekk('sonespenn = I1-bunn 110 til I5-topp 195', j(sonespenn(S)) === j({ lo: 110, hi: 195 }))
sjekk('rolig økt 121-129 med soner: aksen 110-195 (ser rolig ut)', j(pulsAkseSpenn('soner', { lo: 121, hi: 129 }, S)) === j({ lo: 110, hi: 195 }))
sjekk('hard økt med maks 203: utvides oppover til 203, bunnen står på 110', j(pulsAkseSpenn('soner', { lo: 140, hi: 203 }, S)) === j({ lo: 110, hi: 203 }))
sjekk('måling under I1 (98): utvides nedover, krymper aldri', j(pulsAkseSpenn('soner', { lo: 98, hi: 150 }, S)) === j({ lo: 98, hi: 195 }))
sjekk('uten målinger: sonene alene', j(pulsAkseSpenn('soner', null, S)) === j({ lo: 110, hi: 195 }))
sjekk('uten soner: aldri smalere enn 60 slag (121-129 -> 95-155)', j(pulsAkseSpenn('soner', { lo: 121, hi: 129 }, [])) === j({ lo: 95, hi: 155 }))
sjekk('uten soner, bredt nok fra før (100-180): uendret', j(pulsAkseSpenn('soner', { lo: 100, hi: 180 }, null)) === j({ lo: 100, hi: 180 }))
sjekk('uten soner, lavt: bunnen stopper på 30', pulsAkseSpenn('soner', { lo: 40, hi: 45 }, [])!.lo === 30)
sjekk('uten soner og uten målinger: null (ingen akse å tegne)', pulsAkseSpenn('soner', null, []) === null)
sjekk('auto-tett: målingene som de er', j(pulsAkseSpenn('auto', { lo: 121, hi: 129 }, S)) === j({ lo: 121, hi: 129 }))
sjekk('fast: 40-200, utvides bare når målingene går utenfor', j(pulsAkseSpenn('fast', { lo: 121, hi: 129 }, S)) === j({ lo: 40, hi: 200 }) && j(pulsAkseSpenn('fast', { lo: 35, hi: 210 }, S)) === j({ lo: 35, hi: 210 }))
console.log(`\n${ok} OK · ${feil} FEIL\n`); if (feil) process.exitCode = 1
