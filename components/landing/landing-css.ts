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
/* Gjennomsiktig topplinje, som på forsiden: merket skal ligge OPPÅ bildet,
   ikke bak en plate. Toningen holder lenkene lesbare uten en synlig kant. */
.lp-topp{position:sticky;top:0;z-index:40;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
  background:linear-gradient(to bottom, color-mix(in srgb, var(--flate-3) 62%, transparent), transparent);
  border-bottom:0}
.lp-topp-inn{max-width:1400px;margin:0 auto;padding:12px 24px;display:flex;align-items:center;gap:26px}
.lp-merke{display:flex;align-items:center;gap:9px;text-decoration:none;color:var(--lp-paper);flex-shrink:0}
.lp-merke b{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:17px;letter-spacing:.26em;
  background-image:linear-gradient(100deg, #A5516C, #4B62AC);
  -webkit-background-clip:text;background-clip:text;color:transparent}
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
  /* KUN topplinjas ghost-pille - heroens «Se hvordan det virker» skal bli staaende. */
  .lp-topp .lp-pill.ghost{display:none}
}
@media(max-width:620px){
  .lp-pill{padding:8px 13px;font-size:11.5px}
  /* 390 px: ordmerket viker for pilla og hamburgeren, som i appen. */
  /* Merket står øverst til venstre på ALLE undersider, også på mobil. */
  .lp-merke b{font-size:14px;letter-spacing:.2em}
  .lp-topp-inn{padding:10px 14px;gap:10px}
  .lp-topp-h{gap:8px}
}

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

/* ── hero ────────────────────────────────────────────────── */
.lp-uhero{position:relative;min-height:min(78vh,620px);display:flex;align-items:flex-end;overflow:hidden;border-bottom:1px solid var(--lp-line)}
.lp-uhero img.lp-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 62%}
.lp-uhero .lp-sk{position:absolute;inset:0;
  background:linear-gradient(to top,rgba(8,8,10,.96) 4%,rgba(8,8,10,.72) 38%,rgba(8,8,10,.28) 72%),
             linear-gradient(100deg,rgba(255,69,0,.14),rgba(26,111,212,.14))}
.lp-uhero .lp-inn{position:relative;max-width:1400px;margin:0 auto;padding:0 24px 46px;width:100%}
.lp-smul{font-family:'Barlow',sans-serif;font-size:12.5px;color:rgba(255,255,255,.6);margin-bottom:16px}
.lp-smul a{color:rgba(255,255,255,.75);text-decoration:none}
.lp-smul a:hover{color:#fff}
.lp-smul{text-shadow:0 2px 12px rgba(0,0,0,.75)}
.lp-smul span{margin:0 7px;opacity:.5}
.lp-kap{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:var(--lp-oransje)}
.lp-uhero .lp-kap{color:#fff;background:rgba(255,69,0,.92);display:inline-block;padding:4px 10px;border-radius:6px}
.lp-uhero h1{font-family:'Bebas Neue','Arial Narrow',system-ui,sans-serif;font-size:clamp(40px,6vw,80px);line-height:.95;letter-spacing:.02em;color:#fff;margin:8px 0 12px;max-width:16ch}
.lp-uhero h1 em{font-style:normal;color:var(--lp-oransje)}
.lp-uhero p{font-family:'Barlow',sans-serif;font-size:clamp(15px,1.5vw,18px);color:rgba(255,255,255,.82);max-width:62ch;line-height:1.6}
.lp-uhero .lp-cta{display:flex;gap:10px;flex-wrap:wrap;margin-top:22px}
.lp-uhero .lp-cta .lp-pill{padding:13px 24px;font-size:13px}
.lp-uhero .lp-pill.ghost{color:#fff;border-color:rgba(255,255,255,.4)}
.lp-bevis{display:flex;flex-wrap:wrap;gap:8px;margin-top:22px}
.lp-bevis span{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:11.5px;letter-spacing:.13em;text-transform:uppercase;
  color:rgba(255,255,255,.82);border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.06);padding:6px 11px;border-radius:999px}

/* ── snarveisrad ─────────────────────────────────────────── */
.lp-snar{position:sticky;top:61px;z-index:30;background:color-mix(in srgb, var(--flate-3) 90%, transparent);
  backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-bottom:1px solid var(--lp-line);overflow-x:auto;scrollbar-width:none}
.lp-snar::-webkit-scrollbar{display:none}
.lp-snar-inn{max-width:1400px;margin:0 auto;padding:10px 24px;display:flex;gap:8px;white-space:nowrap}
.lp-snar a{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12px;letter-spacing:.14em;text-transform:uppercase;
  color:var(--lp-dim);text-decoration:none;border:1px solid var(--lp-line2);border-radius:999px;padding:6px 13px;transition:color .15s,border-color .15s}
.lp-snar a:hover,.lp-snar a.on{color:var(--lp-paper);border-color:var(--lp-oransje)}
/* Ankrene må ikke havne bak topplinja + snarveisraden. */
.lp [id]{scroll-margin-top:118px}

/* ── seksjoner (bolk B4) ─────────────────────────────────── */
.lp-us{padding:66px 0;border-bottom:1px solid var(--lp-line)}
.lp-us-inn{max-width:1400px;margin:0 auto;padding:0 24px;display:grid;grid-template-columns:1fr 1.08fr;gap:52px;align-items:center}
.lp-us-inn.rev .lp-us-tekst{order:2}
.lp-us-inn.full{grid-template-columns:minmax(0,900px)}
.lp-us h2{font-family:'Bebas Neue','Arial Narrow',system-ui,sans-serif;font-size:clamp(30px,3.4vw,46px);line-height:1.02;letter-spacing:.02em;margin:8px 0 14px}
.lp-ing{font-family:'Barlow',sans-serif;font-size:16px;line-height:1.68;color:var(--lp-dim);max-width:56ch}
.lp-pkg{display:grid;gap:10px;margin-top:22px}
.lp-pk{background:var(--lp-card);border:1px solid var(--lp-line);border-left:3px solid var(--lp-oransje);border-radius:12px;padding:13px 16px}
.lp-pk.blaa{border-left-color:#1A6FD4}
.lp-pk b{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:14px;letter-spacing:.1em;text-transform:uppercase;display:block;margin-bottom:3px}
.lp-pk p{font-family:'Barlow',sans-serif;font-size:14px;color:var(--lp-dim);line-height:1.55}
.lp-us-media{min-width:0}
.lp-foto{position:relative;width:100%;aspect-ratio:4/3;border-radius:16px;overflow:hidden;border:1px solid var(--lp-line2)}
.lp-foto img{width:100%;height:100%;object-fit:cover;display:block}
/* Trener-flatene er blå (fasit): et blått lag over fotoet, ikke et eget bilde. */
.lp-foto.blaa::after{content:'';position:absolute;inset:0;background:linear-gradient(140deg,rgba(26,111,212,.42),rgba(26,111,212,.12) 62%,transparent)}
.lp-skjerm{background:var(--lp-card);border:1px solid var(--lp-line2);border-radius:16px;padding:16px 18px;box-shadow:0 24px 60px rgba(0,0,0,.35);overflow:hidden}
.lp-sk-topp{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}
.lp-sk-kap{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--lp-dim)}
.lp-eks{min-height:var(--lp-eks-h,180px);font-family:'Inter',sans-serif;font-size:14px;line-height:1.4;color:var(--tekst-1-app);min-width:0;overflow-x:auto;overflow-y:visible}
.lp-eks [data-oktkurve]{width:auto!important;max-width:100%!important}
.lp-eks [data-oktkurve] svg{width:100%!important}
.lp-eks [data-chip-rader]{flex-wrap:wrap!important;overflow:visible!important;min-width:0!important;max-width:100%!important}
.lp-eks [data-chip-rader]>div{flex-wrap:wrap!important;flex:0 1 auto!important;min-width:0!important;max-width:100%!important}
.lp-klokker{display:flex;flex-wrap:wrap;gap:8px}
.lp-mrk{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:var(--lp-paper);
  border:1px solid var(--lp-line2);border-radius:10px;padding:12px 16px;flex:1 1 30%;text-align:center;background:var(--lp-card)}
.lp-mrk em{display:block;font-style:normal;font-size:10.5px;letter-spacing:.14em;color:var(--lp-dim);margin-top:3px}
.lp-mrk.pavei{color:var(--lp-dim)}
@media(max-width:1000px){
  .lp-us-inn{grid-template-columns:1fr;gap:28px}
  .lp-us-inn.rev .lp-us-tekst{order:0}
  .lp-us{padding:44px 0}
}

/* ── FAQ (bolk B5) ───────────────────────────────────────── */
.lp-faq{max-width:900px;margin:0 auto;padding:66px 24px}
.lp-faq h2{font-family:'Bebas Neue','Arial Narrow',system-ui,sans-serif;font-size:clamp(28px,3vw,42px);letter-spacing:.02em;margin:8px 0 20px}
.lp-sp{border-top:1px solid var(--lp-line)}
.lp-sp:last-of-type{border-bottom:1px solid var(--lp-line)}
.lp-sp summary{display:flex;align-items:center;justify-content:space-between;gap:14px;list-style:none;cursor:pointer;
  font-family:'Barlow',sans-serif;font-weight:600;font-size:16.5px;padding:17px 0;color:var(--lp-paper)}
.lp-sp summary::-webkit-details-marker{display:none}
.lp-sp summary i{font-style:normal;color:var(--lp-oransje);font-size:19px;flex:none}
.lp-sp[open] summary i{transform:rotate(45deg)}
.lp-sp p{font-family:'Barlow',sans-serif;font-size:14.5px;color:var(--lp-dim);line-height:1.65;padding:0 0 17px;max-width:74ch}

/* ── andre idretter ──────────────────────────────────────── */
.lp-andre{max-width:1400px;margin:0 auto;padding:56px 24px 10px}
.lp-andre h2{font-family:'Bebas Neue','Arial Narrow',system-ui,sans-serif;font-size:clamp(26px,2.6vw,36px);letter-spacing:.02em;margin:8px 0 18px}
.lp-idrettsrad{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}
.lp-ip{position:relative;display:block;height:clamp(180px,17vw,240px);border-radius:14px;overflow:hidden;border:1px solid var(--lp-line2);
  text-decoration:none;transition:transform .25s cubic-bezier(.2,.7,.2,1),box-shadow .25s ease}
.lp-ip img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.lp-ip::after{content:'';position:absolute;inset:0;background:linear-gradient(to top,rgba(8,8,10,.92) 12%,rgba(8,8,10,.35) 60%,transparent)}
.lp-ip:hover,.lp-ip:focus-visible{transform:translateY(-3px);box-shadow:0 18px 40px rgba(0,0,0,.45);outline:none;border-color:var(--lp-oransje)}
.lp-ip span{position:absolute;left:12px;right:12px;bottom:12px;z-index:1;font-family:'Barlow Condensed',sans-serif;font-weight:700;
  font-size:14px;letter-spacing:.14em;text-transform:uppercase;color:#fff;text-shadow:0 2px 14px rgba(0,0,0,.8)}
.lp-ip small{display:block;font-family:'Barlow',sans-serif;font-weight:400;font-size:11.5px;letter-spacing:.02em;text-transform:none;
  color:rgba(255,255,255,.78);margin-top:3px}
@media(max-width:1000px){.lp-idrettsrad{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:620px){.lp-idrettsrad{grid-template-columns:repeat(2,minmax(0,1fr))}}

/* ── CTA-bånd ────────────────────────────────────────────── */
.lp-band{background:linear-gradient(115deg,#F04A10 0%,#9A4A55 35%,#2268BE 78%,#1E5FAF 100%);padding:60px 24px;text-align:center}
.lp-band h2{font-family:'Bebas Neue','Arial Narrow',system-ui,sans-serif;font-size:clamp(30px,3.6vw,50px);letter-spacing:.02em;color:#fff;margin-bottom:10px}
.lp-band p{font-family:'Barlow',sans-serif;font-size:16px;color:rgba(255,255,255,.9);margin-bottom:22px}
.lp-band .lp-kn{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.lp-band .lp-pill{background:#fff;color:#111;border-color:#fff;padding:14px 26px;font-size:13px}
.lp-band .lp-pill.ghost{background:transparent;color:#fff;border-color:rgba(255,255,255,.6)}
`
