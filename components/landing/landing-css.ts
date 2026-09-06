// Fasit: design/xpulse-underside-langrenn-design.html («Notat - regler» i bunnen).
// Én mal, elleve sider: alle undersidene deler disse klassene. Prefikset lp- fordi
// forsiden og appen har egne, generiske navn (.pill, .kap, .band …) som ellers ville
// kollidert. Designfilas egne tokens (--bg/--card/--line …) er mappet til appens
// landingstokens her, så lys og mørk følger av seg selv (regel 23).
export const LANDING_CSS = `
.lp{
  --lp-bg:var(--flate-3);
  --lp-surface:var(--flate-1);
  --lp-card:var(--flate-10);
  --lp-line:var(--kant-5);
  --lp-line2:color-mix(in srgb, var(--tekst-1-land) 18%, transparent);
  --lp-paper:var(--tekst-1-land);
  --lp-dim:rgb(var(--tekst-land-rgb) / .62);
  --lp-mute:rgb(var(--tekst-land-rgb) / .42);
  --lp-oransje:#FF4500;
  background:var(--lp-bg);color:var(--lp-paper);
}
.lp *{box-sizing:border-box}

/* ── topplinje ───────────────────────────────────────────── */
.lp-topp{position:sticky;top:0;z-index:40;backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
  background:color-mix(in srgb, var(--flate-3) 72%, transparent);border-bottom:1px solid var(--lp-line)}
.lp-topp-inn{max-width:1400px;margin:0 auto;padding:12px 24px;display:flex;align-items:center;gap:26px}
.lp-merke{display:flex;align-items:center;gap:9px;text-decoration:none;color:var(--lp-paper);flex-shrink:0}
.lp-merke b{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:17px;letter-spacing:.26em}
.lp-lenker{display:flex;gap:22px;margin-left:10px;align-items:center}
.lp-ln{position:relative;display:inline-flex;align-items:center;gap:6px;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:13px;
  letter-spacing:.16em;text-transform:uppercase;color:var(--lp-dim);text-decoration:none;cursor:pointer;padding:6px 0;
  border:0;border-bottom:2px solid transparent;background:none;transition:color .15s,border-color .15s}
.lp-ln:hover{color:var(--lp-paper)}
.lp-ln.on{color:var(--lp-paper);border-bottom-color:var(--lp-oransje)}
.lp-ln i{font-style:normal;opacity:.5;font-size:10px}
.lp-topp-h{margin-left:auto;display:flex;align-items:center;gap:10px}
.lp-pill{display:inline-flex;align-items:center;justify-content:center;padding:9px 18px;border-radius:999px;background:var(--lp-oransje);color:#fff;
  font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12.5px;letter-spacing:.16em;text-transform:uppercase;
  text-decoration:none;border:1px solid var(--lp-oransje);cursor:pointer;white-space:nowrap;
  transition:transform .18s cubic-bezier(.2,.7,.2,1),box-shadow .25s ease,background .25s ease,border-color .25s ease}
.lp-pill:hover{transform:translateY(-2px);box-shadow:0 12px 28px rgba(255,69,0,.35)}
.lp-pill:active{transform:translateY(0) scale(.985)}
.lp-pill.ghost{background:transparent;color:var(--lp-paper);border-color:var(--lp-line2)}
.lp-pill.ghost:hover{box-shadow:0 12px 28px rgba(0,0,0,.28);border-color:var(--lp-paper)}
.lp-burger{display:none;width:38px;height:38px;border-radius:10px;border:1px solid var(--lp-line2);background:transparent;
  flex-direction:column;justify-content:center;align-items:center;gap:5px;cursor:pointer;color:var(--lp-paper)}
.lp-nedtrekk{position:absolute;top:calc(100% + 10px);left:0;min-width:230px;z-index:60;padding:6px;border-radius:14px;
  background:color-mix(in srgb, var(--flate-10) 97%, transparent);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
  border:1px solid var(--lp-line2);box-shadow:0 16px 40px rgba(0,0,0,.35)}
.lp-nedtrekk a{display:flex;align-items:center;gap:8px;padding:9px 12px;border-radius:10px;text-decoration:none;color:var(--lp-paper);
  font-family:'Barlow Condensed',sans-serif;font-weight:600;font-size:14px;letter-spacing:.08em}
.lp-nedtrekk a:hover{background:color-mix(in srgb, var(--tekst-1-land) 8%, transparent)}
.lp-nedtrekk hr{border:0;border-top:1px solid var(--lp-line);margin:6px 8px}
.lp-snart{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;
  color:#E8B93C;border:1px solid rgba(232,185,60,.4);border-radius:999px;padding:1px 7px}
@media(max-width:1100px){
  .lp-lenker{display:none}
  .lp-burger{display:flex}
  .lp-pill.ghost{display:none}
}
@media(max-width:620px){.lp-pill{padding:8px 13px;font-size:11.5px}}

/* mobilpanel */
.lp-panel{position:fixed;inset:0;z-index:200;background:var(--lp-bg);padding:20px;display:flex;flex-direction:column;gap:10px;overflow-y:auto}
.lp-panel-topp{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.lp-panel a,.lp-panel summary{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:15px 16px;border-radius:12px;
  background:var(--lp-card);border:1px solid var(--lp-line);text-decoration:none;color:var(--lp-paper);cursor:pointer;
  font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:14px;letter-spacing:.14em;text-transform:uppercase}
.lp-panel details a{margin-top:6px;background:var(--lp-surface)}
.lp-panel summary{list-style:none}
.lp-panel summary::-webkit-details-marker{display:none}
.lp-panel .lp-pill{margin-top:auto;padding:16px;font-size:13px}
`
