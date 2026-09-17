/* ØKT-GRAFEN - EN TEGNER FOR HVER ENESTE OKTGRAF PA FORSIDEN (regel 11).
   Sverre 16. sep: «Ma ha riktig design pa hver eneste okt graf slik det skal
   vaere» - og settets ikoner, aldri emojier. Designet er fasitens scene 7 i
   flyt-bolken (WorkoutDetailChart.tsx + OktKurve.tsx): planblokkene som
   spokelse bak, pulsen tegnet over, standplass som vindu, pillene med ikon
   og VERDI (laktat 2,8 · L 5/5 · 40 g · notat) med stiplet leder ned til
   punktet pa kurven, segmentbandet under, og kurvevalget som chips.

   Brukes av: scene 7 i #flyt (animert), dagpopupen og ukekortet i #inside
   (stille sluttilstand), trener-scene 2 i #tflyt. Endres utseendet, endres
   det her - ett sted.

   cfg:
     blokker  [{t:'oppv'|'drag'|'ned'|'sky'|'pause', z:'I1'..'I5', s, e, ls:'L'|'S'}]  minutter
     tot      total minutter
     pulsVed  function(m) -> bpm
     punkter  [{m, k:'laktat'|'skyting'|'ernaering'|'for-okt', c, tx, ctx, niv, grp:'lak'|'sky'|'ern'|'not'}]
     hoyde    [] valgfri serie (samme tidsakse som pulsVed, steg .25 min)   tempo [] valgfri
     mob      kompakt oppstilling · PH/TOPP hoyde og topplass · tittel · kilde
     chips    kurvevalget · knapper knapperaden · kom HTML for kommentarer
     still    sluttilstand: alt synlig, ingen animasjon (popup, ukekort)
     akse     antall akse-etiketter (standard 5) */
var OKTGRAF_HOYDE = { I1: .36, I2: .5, I3: .62, I4: .74, I5: .86 };
function oktgrafBlokkH(b) { return (b.t === 'sky' || b.t === 'pause') ? .18 : (OKTGRAF_HOYDE[b.z] || .5); }
function oktgrafBlokkFarge(b) { return (b.t === 'sky' || b.t === 'pause') ? '#43434B' : (Z[b.z] || '#8A8A96'); }
function oktgrafTid(m) { m = Math.round(m); var h = Math.floor(m / 60), mm = m % 60; return h ? h + ':' + (mm < 10 ? '0' : '') + mm + ':00' : mm + ':00'; }

var OKTGRAF_SONER = { I1: [108, 138], I5: [176, 190] };   /* forside-utøverens soner: I1-bunn og I5-topp */
function oktgrafPulsSpenn(pulsVed, TOT) {
  var lo = Infinity, hi = -Infinity;
  for (var m = 0; m <= TOT; m += .25) { var v = pulsVed(m); if (v < lo) lo = v; if (v > hi) hi = v; }
  if (!isFinite(lo)) { lo = OKTGRAF_SONER.I1[0]; hi = OKTGRAF_SONER.I5[1]; }
  return { lo: Math.min(OKTGRAF_SONER.I1[0], Math.floor(lo)), hi: Math.max(OKTGRAF_SONER.I5[1], Math.ceil(hi)) };
}
/* Tre jevne merker inni spennet (30-steg), aldri på kanten. */
function oktgrafYmerker(lo, hi) { var ut = []; for (var v = Math.ceil((lo + 5) / 30) * 30; v < hi - 5; v += 30) ut.push(v); return ut.reverse().slice(0, 4); }
function tegnOktgraf(cfg) {
  var still = !!cfg.still, mob = !!cfg.mob, PH = cfg.PH || (mob ? 140 : 150), TOPP = cfg.TOPP != null ? cfg.TOPP : (mob ? 52 : 84), W = 1000;
  var BL = cfg.blokker, TOT = cfg.tot, pulsVed = cfg.pulsVed, PUNKT = cfg.punkter || [];
  var A = still ? 'a inn' : 'a', PIL = still ? 'pille inn' : 'pille';
  function sti(fn, min, max, inv) { var out = ''; for (var m = 0, i = 0; m <= TOT; m += .25, i++) { var f = (fn(m, i) - min) / (max - min); if (inv) f = 1 - f; out += (i ? 'L' : 'M') + (m / TOT * W).toFixed(1) + ' ' + (PH - f * PH).toFixed(1); } return out; }
  /* Y-AKSEN (beslutning 17. sep, samme regel som appens lib/puls-akse): aksen spenner alltid
     minst I1-bunn til I5-topp fra sonene (forside-utøveren: 108-190), utvides når målingene
     går utenfor, krymper aldri. Før sto den fast på 90-190. */
  var SP = oktgrafPulsSpenn(pulsVed, TOT), LO = SP.lo, HI = SP.hi;
  function yAv(v) { return TOPP + PH - (v - LO) / (HI - LO) * PH; }
  var kurve = sti(function (m) { return pulsVed(m); }, LO, HI);
  var ghost = BL.map(function (b) { return '<rect x="' + (b.s / TOT * W + 1) + '" y="' + (PH - PH * oktgrafBlokkH(b)) + '" width="' + ((b.e - b.s) / TOT * W - 2) + '" height="' + (PH * oktgrafBlokkH(b)) + '" fill="' + oktgrafBlokkFarge(b) + '" opacity="' + (b.t === 'sky' ? .4 : .2) + '" stroke="' + oktgrafBlokkFarge(b) + '" stroke-opacity=".7" stroke-dasharray="4 3" vector-effect="non-scaling-stroke"/>'; }).join('');
  var vind = BL.filter(function (b) { return b.t === 'sky'; }).map(function (b) { return '<div class="' + A + ' skyv" style="position:absolute;top:' + TOPP + 'px;height:' + PH + 'px;left:' + (b.s / TOT * 100) + '%;width:' + ((b.e - b.s) / TOT * 100) + '%;background:#43434B24;border:1.5px solid #43434B;border-radius:6px"></div>'; }).join('');
  var pil = PUNKT.map(function (p, i) {
    if (mob && p.grp === 'sky' && i === 4) return '';
    var y = yAv(pulsVed(p.m)), ly = ((mob && !still) ? [0, 1, 0, 1, 0, 1, 0, 1][i % 8] : (p.niv || 0)) * (mob ? 24 : 28);
    var ikon = p.k === 'skyting' ? ik('skyting', 'f', 'width:13px;height:13px;color:var(--a-mut)') : ik(p.k, 'f', 'width:13px;height:13px;color:' + p.c);
    var tx = (mob && p.grp === 'not') ? 'Notat' : p.tx, off = mob ? 20 : 34;
    return '<div class="' + PIL + '" data-g="' + p.grp + '" style="position:absolute;left:' + (p.m / TOT * 100) + '%;top:0;width:0;height:100%;pointer-events:none">' +
      '<div style="position:absolute;top:' + ly + 'px;left:0;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;white-space:nowrap"><span style="display:inline-flex;align-items:center;gap:4px;background:var(--a-graf);border:1px solid ' + (p.k === 'skyting' ? 'var(--a-line2)' : p.c) + ';border-radius:999px;padding:2px 8px;font:700 11px/1.3 Barlow Condensed,sans-serif;color:var(--a-ink)">' + ikon + tx + '</span>' + (mob || !p.ctx ? '' : '<span style="font-size:10px;color:var(--a-mute);line-height:1.2">' + p.ctx + '</span>') + '</div>' +
      (p.k === 'skyting' ? '' : '<div style="position:absolute;left:0;top:' + (ly + off) + 'px;height:' + Math.max(0, y - ly - off) + 'px;border-left:1px dashed ' + p.c + ';opacity:.7"></div><div style="position:absolute;left:-4.5px;top:' + (y - 4.5) + 'px;width:9px;height:9px;background:' + p.c + ';border:1.5px solid #0A0A0B;' + (p.k === 'laktat' ? 'border-radius:50%' : p.k === 'for-okt' ? 'border-radius:2px' : 'transform:rotate(45deg)') + '"></div>') +
      '</div>';
  }).join('');
  var seg = BL.map(function (b) {
    var f = b.t === 'oppv' ? '#BBAA55' : b.t === 'ned' ? '#64748B' : (b.t === 'sky' || b.t === 'pause') ? '#43434B' : '#1E2AA8';
    var tx = b.t === 'sky' ? (mob ? b.ls : ik('skyting', 'f', 'width:10px;height:10px;margin-right:2px') + b.ls) : b.t === 'pause' ? '' : (b.t === 'drag' ? (mob ? '' : (b.e - b.s) + ' MIN') : (mob ? '' : (b.t === 'oppv' ? 'OPPV' : 'NEDJ')));
    return '<i style="flex:' + (b.e - b.s) + ';background:' + f + '">' + tx + '</i>';
  }).join('');
  var ymerk = oktgrafYmerker(LO, HI).map(function (v) { var y = yAv(v); return '<div style="position:absolute;left:0;right:0;top:' + y + 'px;border-top:1px solid var(--a-kant);opacity:.5"></div><span style="position:absolute;left:2px;top:' + (y - 7) + 'px;font-size:10.5px;color:var(--a-mute);background:var(--a-graf);padding:0 2px;line-height:1;z-index:2">' + v + '</span>'; }).join('');
  function chip(kl, c, ikn, navn, on, skj) { return '<span class="chip ' + kl + (on ? ' on' : '') + (skj ? ' skjul-m' : '') + '" style="--c:' + c + '"><i class="r"></i>' + (ikn ? ik(ikn, 's') : '') + navn + '</span>'; }
  var har = function (g) { return PUNKT.some(function (p) { return p.grp === g; }); };
  var chips = cfg.chips === false ? '' : '<div class="chiprad"><span class="cap skjul-m" style="font-size:10px">Kurver</span>' +
    chip('c-puls fokus', '#E23A5A', 'puls', 'Puls', 1) + chip('c-tem', '#28A86E', 'tempo', 'Tempo', still && cfg.tempo) + chip('c-watt', '#E8B93C', 'watt', 'Watt', 0, 1) + chip('c-kad', '#1A6FD4', 'kadens', 'Kadens', 0, 1) + chip('c-hoy', '#8A8A96', 'hoyde', 'Høyde', still && cfg.hoyde) +
    '<span class="cap skjul-m" style="font-size:10px;margin-left:6px">På grafen</span>' + chip('', '#FF4500', '', 'Plan', 1, 1) + chip('c-sky', '#38BDF8', 'skyting', 'Skyting', still && har('sky')) + chip('c-lak', '#E23A5A', 'laktat', 'Laktat', still && har('lak')) + chip('c-ern', '#28A86E', 'ernaering', 'Ernæring', still && har('ern'), 1) + chip('c-not', '#A6A6AF', 'for-okt', 'Notat', still && har('not'), 1) + '</div>';
  var n = cfg.akse || 5, akse = '';
  for (var i = 0; i < n; i++) akse += '<span>' + oktgrafTid(TOT * i / (n - 1)) + '</span>';
  var hoy = cfg.hoyde ? '<svg class="hoy" viewBox="0 0 ' + W + ' ' + PH + '" preserveAspectRatio="none" style="position:absolute;left:0;top:' + TOPP + 'px;width:100%;height:' + PH + 'px;opacity:' + (still ? 1 : 0) + ';transition:opacity .6s"><path d="' + sti(function (m, i) { return cfg.hoyde[i]; }, 560, 700) + 'L' + W + ' ' + PH + 'L0 ' + PH + 'Z" fill="#8A8A96" opacity=".3"/><path d="' + sti(function (m, i) { return cfg.hoyde[i]; }, 560, 700) + '" fill="none" stroke="#A6A6AF" stroke-width="1.5" opacity=".8" vector-effect="non-scaling-stroke"/></svg>' : '';
  var tem = cfg.tempo ? '<svg class="tem" viewBox="0 0 ' + W + ' ' + PH + '" preserveAspectRatio="none" style="position:absolute;left:0;top:' + TOPP + 'px;width:100%;height:' + PH + 'px;opacity:' + (still ? 1 : 0) + ';transition:opacity .6s"><path d="' + sti(function (m, i) { return cfg.tempo[i]; }, 2.6, 10, 1) + '" fill="none" stroke="#28A86E" stroke-width="1.3" opacity=".32" vector-effect="non-scaling-stroke"/></svg>' : '';
  var knapper = cfg.knapper === false ? '' : '<div class="knrad"><span class="kn skjul-m" style="--c:var(--a-ink)">' + (typeof oktbyggerIkon === 'function' ? oktbyggerIkon() : '') + 'ØKTBYGGER</span><span class="kn k-plott" style="--c:#E23A5A">' + ik('skyting', 's') + 'PLOTT TREFF</span><span class="kn k-lak" style="--c:#8A8A96">' + ik('laktat', 's') + 'SETT LAKTAT</span><span class="kn k-not" style="--c:#8A8A96">' + ik('for-okt', 's') + 'NOTAT</span></div>';
  return '<div class="app og' + (cfg.klasse ? ' ' + cfg.klasse : '') + '"><div class="og-t">' + (cfg.tittel || 'ØKT-GRAF') + (cfg.kilde ? '<span style="margin-left:auto;font-weight:500;letter-spacing:.02em;font-size:12px;color:var(--a-mute)">' + cfg.kilde + '</span>' : '') + '</div>' + chips +
    '<div style="position:relative;height:' + (TOPP + PH + 18) + 'px">' + ymerk + hoy +
    '<svg class="ghost ' + A + '" viewBox="0 0 ' + W + ' ' + PH + '" preserveAspectRatio="none" style="position:absolute;left:0;top:' + TOPP + 'px;width:100%;height:' + PH + 'px">' + ghost + '</svg>' + vind + tem +
    '<div class="klipp" style="position:absolute;left:0;right:0;top:' + TOPP + 'px;height:' + PH + 'px;clip-path:inset(0 ' + (still ? '0' : '100%') + ' 0 0);transition:clip-path 1.8s cubic-bezier(.45,.05,.25,1)"><svg viewBox="0 0 ' + W + ' ' + PH + '" preserveAspectRatio="none" style="width:100%;height:100%;overflow:visible"><path d="' + kurve + '" fill="none" stroke="#E23A5A" stroke-width="2.8" vector-effect="non-scaling-stroke" stroke-linejoin="round" style="filter:drop-shadow(0 0 4px rgba(226,58,90,.45))"/></svg></div>' + pil +
    '<div style="position:absolute;left:0;right:0;bottom:0;display:flex;justify-content:space-between;font-size:11px;color:var(--a-mute)">' + akse + '</div></div>' +
    '<div class="segb ' + A + '">' + seg + '</div>' + knapper + (cfg.kom || '') + '</div>';
}
