// «Inni appen»-mockupene fra forsiden (Hero V2), portert til React for
// /funksjoner/dagbok-og-plan. Samme markup og CSS som public/xpulse.html —
// endres mockupen der, oppdater her (klassene har xm-prefiks så de ikke
// kolliderer med noe annet). Ekte flater, fiktive data.

const CSS = `
.xm-grid{display:grid;grid-template-columns:minmax(0,1.6fr) 240px;gap:20px;align-items:start;max-width:1240px;margin:0 auto}
@media(max-width:900px){.xm-grid{grid-template-columns:1fr}.xm-cal-card{display:none}.xm-phone{width:100%;max-width:320px;margin:0 auto}}
.xm-app{border:1px solid #2A2A33;background:#101014;border-radius:18px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.5)}
.xm-app-h{display:flex;align-items:center;gap:10px;padding:13px 18px;border-bottom:1px solid #1F1F26}
.xm-app-h .xm-beam{width:22px;height:4px;border-radius:2px;background:#FF4500}
.xm-app-h h4{font:400 17px/1 'Bebas Neue',sans-serif;letter-spacing:.14em;color:#8B8B95;margin:0}
.xm-app-h .xm-aux{margin-left:auto;font:600 12px/1 'Barlow Condensed',sans-serif;letter-spacing:.1em;color:#55555F}
.xm-app-b{padding:18px}
.xm-cal{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px}
.xm-cal .xm-dh{font:600 11px/1 'Barlow Condensed',sans-serif;letter-spacing:.12em;color:#55555F;text-align:center;padding-bottom:4px}
.xm-day{position:relative;min-height:118px;border:1px solid #1F1F26;border-radius:9px;background:#0B0B0F;padding:4px;display:flex;flex-direction:column;gap:4px;min-width:0}
.xm-okt{border-radius:6px;padding:5px 6px;font:600 11px/1.25 'Barlow Condensed',sans-serif;letter-spacing:.02em;min-width:0}
.xm-okt .xm-t{display:block;color:#F2F2F0;font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.xm-okt .xm-m{display:block;color:#55555F;font-size:10.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.xm-okt.xm-done{background:#14141A;border-left:3px solid #28A86E}
.xm-okt.xm-done.xm-i3{border-left-color:#E8B93C}
.xm-okt.xm-done.xm-i5{border-left-color:#E23A5A}
.xm-okt.xm-plan{border:1.5px dashed #34343E;background:transparent}
.xm-okt.xm-komp{background:rgba(212,160,23,.10);border-left:3px solid #D4A017}
.xm-okt.xm-komp .xm-t{color:#E8B93C}
.xm-zstrip{display:flex;height:4px;border-radius:2px;overflow:hidden;margin-top:4px}
.xm-note{margin-top:12px;font-size:12.5px;color:#55555F}
.xm-note i{font-style:normal;color:#8B8B95}
.xm-pbar{height:4px;border-radius:2px;margin-bottom:2px}
.xm-pchip{display:inline-block;font:700 9px/1.3 'Barlow Condensed',sans-serif;letter-spacing:.07em;text-transform:uppercase;border:1px solid;border-radius:5px;padding:0 4px;margin-bottom:2px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.xm-pedge{position:absolute;top:5px;bottom:5px;width:2.5px;border-radius:2px;z-index:1}
.xm-pper{font:600 10px/1 'Barlow Condensed',sans-serif;letter-spacing:.12em;text-transform:uppercase;padding:9px 6px 3px}
.xm-phone{border:1px solid #2A2A33;border-radius:26px;background:#0A0A0D;padding:10px 10px 14px;box-shadow:0 30px 80px rgba(0,0,0,.5)}
.xm-phone .xm-notch{width:74px;height:5px;border-radius:3px;background:#1E1E26;margin:4px auto 10px}
.xm-phone .xm-ph-h{font:400 14px 'Bebas Neue',sans-serif;letter-spacing:.12em;color:#8B8B95;padding:0 6px 8px;display:flex;justify-content:space-between}
.xm-phone .xm-ph-h span{color:#55555F;font:600 10px 'Barlow Condensed',sans-serif;letter-spacing:.1em}
.xm-pday{border-bottom:1px solid #14141A;padding:7px 6px}
.xm-pday .xm-d{font:600 9.5px 'Barlow Condensed',sans-serif;letter-spacing:.14em;color:#55555F}
.xm-pokt{margin-top:4px;border-left:3px solid #28A86E;background:#12121A;border-radius:5px;padding:5px 7px;font:600 10.5px/1.3 'Barlow Condensed',sans-serif}
.xm-pokt.xm-plan{border:1.2px dashed #34343E;border-left:1.2px dashed #34343E;background:transparent}
.xm-pokt.xm-komp{border-left-color:#D4A017;background:rgba(212,160,23,.09);color:#E8B93C}
.xm-pokt .xm-pm{display:block;color:#55555F;font-size:9.5px;font-weight:400}
`

export function InsideMockups() {
  return (
    <div className="px-6" style={{ paddingTop: 8, paddingBottom: 8 }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="xm-grid">
        <div className="xm-app xm-cal-card">
          <div className="xm-app-h"><span className="xm-beam" /><h4>DAGBOK · UKE 34</h4><span className="xm-aux">9:20 t · 6 økter</span></div>
          <div className="xm-app-b">
            <div className="xm-cal">
              <div className="xm-dh">MA</div><div className="xm-dh">TI</div><div className="xm-dh">ON</div><div className="xm-dh">TO</div><div className="xm-dh">FR</div><div className="xm-dh">LØ</div><div className="xm-dh">SØ</div>
              <div className="xm-pbar" style={{ gridColumn: '1/6', background: '#28A86E' }} />
              <div className="xm-pbar" style={{ gridColumn: '6/8', background: '#D4A017' }} />
              <div className="xm-day">
                <span className="xm-pedge" style={{ left: -1, background: '#28A86E' }} />
                <span className="xm-pchip" style={{ color: '#28A86E', borderColor: 'rgba(40,168,110,.35)' }}>GRUNNPERIODE</span>
                <div className="xm-okt xm-done"><span className="xm-t">Rolig 60 min</span><span className="xm-m">Løping</span><span className="xm-zstrip"><i style={{ flex: 1, background: '#28A86E' }} /></span></div>
              </div>
              <div className="xm-day">
                <div className="xm-okt xm-done xm-i3"><span className="xm-t">6 × 6 min I3</span><span className="xm-m">Rulleski · 1:26</span><span className="xm-zstrip"><i style={{ flex: 5, background: '#28A86E' }} /><i style={{ flex: 3.6, background: '#E8B93C' }} /></span></div>
                <div className="xm-okt xm-done"><span className="xm-t">Styrke basis</span><span className="xm-m">45 min</span></div>
              </div>
              <div className="xm-day"><div className="xm-okt xm-plan"><span className="xm-t">Hvile</span></div></div>
              <div className="xm-day">
                <div className="xm-okt xm-done xm-i5"><span className="xm-t">Hard komb 5×4</span><span className="xm-m">Skiskyting · 4 serier</span><span className="xm-zstrip"><i style={{ flex: 4, background: '#28A86E' }} /><i style={{ flex: 2, background: '#FF8C00' }} /></span></div>
              </div>
              <div className="xm-day">
                <span className="xm-pedge" style={{ right: -1, background: '#28A86E' }} />
                <div className="xm-okt xm-plan"><span className="xm-t">Rolig 90 min</span><span className="xm-m">Planlagt</span></div>
              </div>
              <div className="xm-day">
                <span className="xm-pedge" style={{ left: -1, background: '#D4A017' }} />
                <span className="xm-pchip" style={{ color: '#E8B93C', borderColor: 'rgba(212,160,23,.35)' }}>KONK.HELG</span>
                <div className="xm-okt xm-plan"><span className="xm-t">Lett + 4 spurter</span><span className="xm-m">Planlagt</span></div>
              </div>
              <div className="xm-day">
                <span className="xm-pedge" style={{ right: -1, background: '#D4A017' }} />
                <div className="xm-okt xm-komp"><span className="xm-t">🏁 NC Simostranda</span><span className="xm-m">Jaktstart · A-løp</span></div>
              </div>
            </div>
            <p className="xm-note"><i>Stiplet = planlagt · fylt = gjennomført · gull = konkurranse fra årsplanen.</i> Stripa over uka er perioden fra årsplanen. Du huker av, noterer avvik — og planen forblir planen.</p>
          </div>
        </div>

        <div className="xm-phone">
          <div className="xm-notch" />
          <div className="xm-ph-h">DAGBOK <span>UKE 34</span></div>
          <div className="xm-pper" style={{ color: '#28A86E' }}>● Grunnperiode · 17.–21. aug</div>
          <div className="xm-pday"><div className="xm-d">MANDAG 17.</div><div className="xm-pokt">Rolig 60 min<span className="xm-pm">Løping · ✓ som planlagt</span></div></div>
          <div className="xm-pday"><div className="xm-d">TIRSDAG 18.</div><div className="xm-pokt" style={{ borderLeftColor: '#E8B93C' }}>6 × 6 min I3<span className="xm-pm">Rulleski · 1:26 · RPE 7</span></div><div className="xm-pokt">Styrke basis<span className="xm-pm">45 min · 4 350 kg</span></div></div>
          <div className="xm-pday"><div className="xm-d">ONSDAG 19.</div><div className="xm-pokt xm-plan">Hvile<span className="xm-pm">Søvn 7:42 · hvilepuls 44</span></div></div>
          <div className="xm-pday"><div className="xm-d">TORSDAG 20.</div><div className="xm-pokt" style={{ borderLeftColor: '#E23A5A' }}>Hard komb 5×4<span className="xm-pm">Skiskyting · 18/20 treff</span></div></div>
          <div className="xm-pper" style={{ color: '#E8B93C' }}>● Konk.helg · 22.–23. aug</div>
          <div className="xm-pday"><div className="xm-d">SØNDAG 23.</div><div className="xm-pokt xm-komp">🏁 NC Simostranda<span className="xm-pm">Jaktstart · A-løp</span></div></div>
        </div>
      </div>
    </div>
  )
}
