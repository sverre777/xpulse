/* #dflyt «DETALJENE SOM AVGJØR.» - scenene. Kilde: <script> i
   design/xpulse-flyt-bolk-design.html (16. sep 2026). Samme motor som #flyt
   (karusell.js), ikonene fra ikoner.js. Sju scener i seks kapitler: Skyting
   x2 · Plan mot faktisk · Prestasjon og belastning · Soner · Maler · Utstyr.
   Gjenbruker ingen scene fra #flyt. Prestasjonskortet nevner aldri eFTP,
   kritisk effekt eller W' - de er ikke bygget. */

/* ═════════════════ DETALJENE SOM AVGJØR - samme motor som flyt-bolken ═════════════════ */
var KAP2=[{n:'Skyting',ik:'skyting'},{n:'Plan mot faktisk',ik:'fullfort'},{n:'Prestasjon og belastning',ik:'laktat'},{n:'Soner',ik:'puls'},{n:'Maler',ik:'standardokt-serie'},{n:'Utstyr',ik:'ski'}];
var SC2=[];
function drStolpe(navn,pct,farge,skudd,lite){return'<div class="dr-m"><span>'+navn+'</span><i><b class="dr-gro" style="--w:'+(lite?0:pct)+'%;background:'+farge+'"></b></i><em>'+(lite?'for lite data · '+skudd:pct.toFixed(1).replace('.',',')+' % <small>· '+skudd+' skudd</small>')+'</em></div>'}
function drSkive(stilling,farge,treff,tekst){var celler='';treff.forEach(function(c,i){celler+='<rect class="dr-hm" style="transition-delay:'+(i*25)+'ms" x="'+(c[0]*10)+'" y="'+(c[1]*10)+'" width="10" height="10" fill="'+farge+'" fill-opacity="'+(.15+.85*c[2])+'"/>'});
 return'<div class="dr-sk"><svg viewBox="0 0 100 100"><rect width="100" height="100" fill="var(--a-flate)"/>'+celler+'<circle cx="50" cy="50" r="42" fill="none" stroke="#8A8A96" stroke-width="1"/>'+(stilling==='L'?'<circle cx="50" cy="50" r="19.3" fill="none" stroke="var(--a-ink)" stroke-width=".8" stroke-dasharray="2 2"/>':'')+'<path d="M50 4V96M4 50H96" stroke="var(--a-kant)" stroke-width=".4"/></svg><small>'+tekst+'</small></div>'}
var HM_L=[[4,4,1],[5,4,.8],[4,5,.9],[5,5,.7],[3,4,.3],[5,3,.35],[4,3,.25],[6,5,.2],[3,5,.2]],HM_S=[[4,4,.6],[5,4,.7],[4,5,.5],[5,5,1],[6,5,.55],[6,4,.4],[3,4,.3],[5,6,.45],[4,6,.25],[6,6,.3],[7,5,.2],[3,3,.15]];
var HM_L30=[[4,4,1],[5,4,.6],[4,5,.7],[5,5,.9],[4,3,.2],[6,4,.2]],HM_S30=[[4,4,.5],[5,4,.8],[5,5,1],[6,5,.7],[6,4,.5],[7,4,.3],[5,6,.3],[6,6,.35]];
function drPil(tekst,kl,stil){return'<span class="dr-pl '+(kl||'')+'" style="'+(stil||'')+'">'+tekst+'</span>'}
function trykk(S,sel){var k=S.q(sel);if(!k)return;k.classList.add('trykk');setTimeout(function(){k.classList.remove('trykk')},220)}

/* ── D1 · PLOTT HVERT SKUDD ── */
SC2.push({kap:0,tittel:'PLOTT HVERT SKUDD.',tekst:'Treff og bom der skuddet satt, per serie, liggende og stående. Vind og sikt føres for hver serie, og pulsen inn leses fra kurven.',
 steg:['Liggende','Stående','Velg vimpel og sikt'],varighet:11500,
 html:function(){return'<div class="app sp dr-plott2">'+'<div class="sp-hd">'+ik('skyting','s')+'<span class="bebas">Skuddplott</span><span class="sum">Sum <b class="sumt">0/10</b> · snitt tid <b>28,4 s</b></span></div>'+
  SERIER.map(function(s,si){return'<div class="sgr" data-s="'+si+'"><div class="sgr-h"><i class="kv" style="background:'+s.gc+'"></i><span style="color:'+s.gc+'">'+s.navn+'</span><span class="pl">· '+(si+1)+'. skyting · '+ik('klokke','s')+s.plass+'</span><span class="s">Treff <b class="st">0/5</b></span></div>'+
   '<div class="blinker">'+s.skudd.map(function(_,i){return'<div class="blink">'+blinkSvg(s,i)+'</div>'}).join('')+'</div>'+
   '<div class="dr-ser"><span class="ls" style="background:'+(s.ls==='L'?'#1A6FD4':'#FF8C00')+'">'+s.ls+'</span><span>Tid <b>'+s.tid+' s</b></span><span class="auto">AUTO '+s.puls+'</span><span class="vimpelk">'+vimpelSvg(null,0,22)+'</span><span class="vs a">'+vimpelSvg(s.vind[0],s.vind[1],22)+s.vind[2]+' '+taakeSvg(s.vind[3])+s.vind[4]+'</span></div></div>'}).join('')+'<div class="vsm"><div class="vsm-h"><span class="vsm-ik">'+vimpelSvg(null,0,22)+'</span><span class="bebas">VIND &amp; SIKT</span><span class="vsm-s">Serie 1 · Liggende</span></div>'+'<p class="vsm-cap">Vimpel - trykk den som ligner</p><div class="vsm-rad">'+[['V',5],['V',4],['V',3],['V',2],['V',1],[null,0],['H',1],['H',2],['H',3],['H',4],['H',5]].map(function(st,i){return'<span class="vsm-st" data-i="'+i+'">'+vimpelSvg(st[0],st[1],38)+'<em>'+(st[1]?st[0]+st[1]:'0')+'</em></span>'}).join('')+'</div>'+'<p class="vsm-val">Ingen vind valgt</p><p class="vsm-cap">Sikt</p><div class="vsm-sikt">'+[['God sikt',0],['Lett tåke',1],['Tåke',2],['Tett tåke',3]].map(function(x,i){return'<span class="vsm-si" data-i="'+i+'">'+taakeSvg(x[1])+x[0]+'</span>'}).join('')+'</div>'+'<div class="vsm-kn"><span class="dr-pl sm">Avbryt</span><span class="dr-pl sm vsm-lagre" style="background:#FF4500;border-color:#FF4500;color:#fff">Lagre</span></div></div>'+'</div>'},
 spill:function(S){var tot=0;SERIER.forEach(function(s,si){var t0=300+si*2600;S.steg(si,t0);S.t(t0,function(){S.qa('[data-s="'+si+'"] .skive').forEach(function(k){k.style.fill='var(--a-card)'})});
   s.skudd.forEach(function(p,i){var at=t0+250+i*400;S.til(S.qa?'[data-s="'+si+'"] .blink:nth-child('+(i+1)+') svg':'',at-300);S.t(at+120,function(){S.qa('[data-s="'+si+'"] .skudd')[i].classList.add('inn');
    var n=S.qa('[data-s="'+si+'"] .skudd.inn').filter(function(x,j){var q=s.skudd[j];return Math.hypot(q[0],q[1])<=(s.ls==='L'?.23:.5)}).length;S.q('[data-s="'+si+'"] .st').textContent=n+'/5';S.q('.sumt').textContent=(si===0?n:5+n)+'/10'})})});
  S.steg(2,5700);S.til('[data-s="0"] .vimpelk',5700,true,400);S.t(6100,function(){S.q('.vsm').classList.add('inn')});
  S.til('.vsm-st[data-i="7"]',6600,true,400);S.t(7000,function(){S.q('.vsm-st[data-i="7"]').classList.add('on');S.q('.vsm-val').innerHTML='Vimpel <b style="color:#E23A5A">H2</b> · fra høyre';S.q('.vsm-ik').innerHTML=vimpelSvg('H',2,22)});
  S.til('.vsm-si[data-i="0"]',7500,true,400);S.t(7900,function(){S.q('.vsm-si[data-i="0"]').classList.add('on')});
  S.til('.vsm-lagre',8400,true,400);S.t(8800,function(){S.q('.vsm').classList.remove('inn');S.q('[data-s="0"] .vimpelk').style.display='none';S.q('[data-s="0"] .vs').classList.add('inn')});
  S.til('[data-s="1"] .vimpelk',9200,true,350);S.t(9550,function(){S.q('[data-s="1"] .vimpelk').style.display='none';S.q('[data-s="1"] .vs').classList.add('inn')});
  S.bort(9800);S.steg(3,10000)}
});

/* ── D2 · SKYTEANALYSE ── */
SC2.push({kap:0,tittel:'SE HVA VINDEN GJØR MED TREFFET.',tekst:'Treff % i vind og sikt, liggende og stående side om side. Og hvor på skiva du treffer - hele perioden, siste 30 dager eller i konkurranse.',
 steg:['Treff % i vind','Hvor du treffer','Siste 30 dager'],varighet:9000,
 html:function(){return'<div class="dr-to"><div class="app dr-app2"><div class="dr-kt">Treff% i vind og sikt</div><div class="dr-ku">Under 20 førte skudd står det «for lite data»</div>'+
  '<div class="dr-chips"><span class="dr-chip on">Sider hver for seg</span><span class="dr-chip">Slått sammen</span></div>'+
  '<div class="dr-rad"><b>V3 ← venstre</b>'+drStolpe('Liggende',84.0,'#38BDF8',132)+drStolpe('Stående',71.3,'#FF4500',128)+'</div>'+
  '<div class="dr-rad"><b>Vindstille</b>'+drStolpe('Liggende',93.8,'#38BDF8',210)+drStolpe('Stående',86.1,'#FF4500',206)+'</div>'+
  '<div class="dr-rad"><b>H2 → høyre</b>'+drStolpe('Liggende',88.2,'#38BDF8',94)+drStolpe('Stående',76.0,'#FF4500',96)+'</div>'+
  '<div class="dr-rad"><b>H4 → høyre</b>'+drStolpe('Liggende',0,'#38BDF8',12,1)+drStolpe('Stående',0,'#FF4500',10,1)+'</div></div>'+
  '<div class="app dr-app2"><div class="dr-kt">Skuddplott - hvor treffer du</div><div class="dr-ku">Tetthet per stilling · stiplet ring = liggende-sonen</div>'+
  '<div class="dr-chips"><span class="dr-chip on" data-p="hele">Hele perioden</span><span class="dr-chip" data-p="30">Siste 30 d</span><span class="dr-chip skjul-m">Konkurranse</span></div>'+
  '<div class="dr-sks hm-hele">'+drSkive('L','#38BDF8',HM_L,'Liggende · 48 skudd · 44 treff')+drSkive('S','#FF4500',HM_S,'Stående · 48 skudd · 39 treff')+'</div>'+
  '<div class="dr-sks hm-30" style="display:none">'+drSkive('L','#38BDF8',HM_L30,'Liggende · 20 skudd · 19 treff')+drSkive('S','#FF4500',HM_S30,'Stående · 20 skudd · 17 treff')+'</div></div></div>'},
 spill:function(S){S.steg(0,0);S.t(300,function(){S.qa('.dr-gro').forEach(function(g,i){g.style.transitionDelay=(i*70)+'ms';g.classList.add('inn')})});
  S.steg(1,2800);S.t(2900,function(){S.qa('.hm-hele .dr-hm').forEach(function(g){g.classList.add('inn')})});
  S.steg(2,5200);S.til('.dr-chip[data-p="30"]',5200,true,450);S.t(5650,function(){S.q('.dr-chip[data-p="hele"]').classList.remove('on');S.q('.dr-chip[data-p="30"]').classList.add('on');S.q('.hm-hele').style.display='none';var h=S.q('.hm-30');h.style.display='';requestAnimationFrame(function(){requestAnimationFrame(function(){h.querySelectorAll('.dr-hm').forEach(function(g){g.classList.add('inn')})})});if(S.still)h.querySelectorAll('.dr-hm').forEach(function(g){g.classList.add('inn')})});
  S.bort(6200);S.steg(3,7600)}
});

/* ── D3 · PLAN MOT GJENNOMFØRT ── */
var D3_SPLIT=[['#28A86E','Oppvarming','20:12 · 5,1 km · 128 bpm'],['#E8B93C','Drag 1','10:04 · 3,2 km · 163 bpm'],['#43434B','Skyting L','5/5 · 27,9 s'],['#E8B93C','Drag 2','10:11 · 3,2 km · 165 bpm'],['#43434B','Skyting S','4/5 · 29,0 s'],['#FF8C00','Drag 3','5:02 · 1,7 km · 174 bpm'],['#FF8C00','Drag 4','4:58 · 1,7 km · 176 bpm'],['#FF8C00','Drag 5','5:04 · 1,7 km · 178 bpm'],['#28A86E','Nedjogg','17:40 · 3,9 km · 131 bpm']];
var D3_SAM=[['','Oppvarming','0:20:12 · 5,1 km · 128 bpm','#28A86E'],['2 × 10 min I3 · 3 min pause','Drag','0:26:15 · 6,4 km · 164 bpm · 9/10 treff','#E8B93C'],['3 × 5 min I4 · 2 min pause','Drag','0:19:04 · 5,1 km · 176 bpm · 9/10 treff','#FF8C00'],['','Nedjogg','0:17:40 · 3,9 km · 131 bpm','#28A86E']];
SC2.push({kap:1,tittel:'PLANEN STÅR. SANNHETEN VED SIDEN AV.',tekst:'Marker planen som gjennomført med ett trykk - eller flett klokkeøkta inn. Plan og faktisk leses rad for rad, og aktivitetene vises splittet eller samlet.',
 steg:['Marker som gjennomført','Plan mot faktisk','Splittet og samlet'],varighet:11500,
 html:function(){return'<div class="app dr-app2" style="max-width:520px">'+
  '<div class="dr-ph"><span class="bebas">Terskel komb</span><span class="dr-status">Planlagt</span></div><p class="dr-hj" style="margin:0 0 10px">Tir 15. sep · Skiskyting · 1:20</p>'+
  '<div class="dr-mk"><span class="dr-mgj">'+ik('fullfort','s')+'Marker som gjennomført</span><span class="dr-live">Start live</span></div>'+
  '<span class="dr-sefullfort" style="display:none">'+ik('fullfort','s')+'Se fullført økt</span>'+
  '<div class="dr-pvf"><div class="dr-pvfh"><span class="strek" style="width:16px;height:2px"></span>Plan vs faktisk</div><div class="dr-pvfk"><span>Planlagt</span><span>Faktisk</span></div>'+
  [['Oppvarming','20:00','20:12','g'],['2 × 10 min I3','23:00','23:15','g'],['3 × 5 min I4','19:00','19:04','g'],['Nedjogg','15:00','17:40','o']].map(function(r){return'<div class="dr-pvfr dr-a"><div><b>'+r[0]+'</b><em>'+r[1]+'</em></div><div><b>'+r[0]+'</b><em class="'+r[3]+'">'+r[2]+'</em></div></div>'}).join('')+
  '<div class="dr-leg"><span><i style="background:#28A86E"></i>innenfor 10%</span><span><i style="background:#FF9500"></i>&gt;10% avvik</span></div></div>'+
  '<div class="d3-akt" style="display:none"><div class="d3-akth"><span class="strek" style="width:16px;height:2px"></span>Aktiviteter<em class="d3-modus">Kronologisk</em></div>'+
  '<div class="dr-sam"><span class="dr-pl on" data-m="split">Splittet</span><span class="dr-pl" data-m="sam">Samlet</span><span class="dr-pl skjul-m">Samle alt</span></div><p class="dr-hj dr-hjt">Hver rad for seg.</p>'+
  '<div class="d3-split">'+D3_SPLIT.map(function(r){return'<div class="d3-r dr-a"><i style="background:'+r[0]+'"></i><b>'+r[1]+'</b><span>'+r[2]+'</span></div>'}).join('')+'</div>'+
  '<div class="d3-sam" style="display:none">'+D3_SAM.map(function(r){return'<div class="d3-g dr-a">'+(r[0]?'<span class="d3-pill">'+r[0]+'</span>':'')+'<div class="d3-gl"><b>'+r[1]+'</b><i style="background:'+r[3]+'"></i></div><span>'+r[2]+'</span></div>'}).join('')+'</div></div></div>'},
 spill:function(S){function vis(el){el.style.display='';var run=function(){el.querySelectorAll('.dr-a').forEach(function(r,i){r.style.transitionDelay=(i*70)+'ms';r.classList.add('inn')})};if(S.still)run();else requestAnimationFrame(function(){requestAnimationFrame(run)})}
  S.steg(0,0);S.til('.dr-mgj',400,true,450);S.t(850,function(){trykk(S,'.dr-mgj')});
  S.t(1150,function(){S.q('.dr-mk').style.display='none';S.q('.dr-sefullfort').style.display='';var s=S.q('.dr-status');s.textContent='Gjennomført';s.classList.add('ok')});S.bort(1300);
  S.steg(1,1700);S.t(1800,function(){S.qa('.dr-pvfr').forEach(function(r,i){r.style.transitionDelay=(i*140)+'ms';r.classList.add('inn')})});
  S.steg(2,4300);S.t(4300,function(){S.q('.dr-pvf').style.display='none';vis(S.q('.d3-akt'));vis(S.q('.d3-split'))});
  S.til('.dr-pl[data-m="sam"]',6600,true,450);S.t(7050,function(){S.q('.dr-pl[data-m="split"]').classList.remove('on');S.q('.dr-pl[data-m="sam"]').classList.add('on');S.q('.dr-hjt').textContent='Like rader vises som én - dataene er fortsatt splittet.';S.q('.d3-modus').textContent='Samlet';
   var sp=S.q('.d3-split');sp.querySelectorAll('.dr-a').forEach(function(r){r.classList.remove('inn')});setTimeout(function(){sp.style.display='none';vis(S.q('.d3-sam'))},S.still?0:260);if(S.still){sp.style.display='none';vis(S.q('.d3-sam'))}});
  S.bort(7400);S.steg(3,9500)}
});

/* ── D4 · PRESTASJON OG BELASTNING ── */
var LAK=[[1.2,128],[1.5,134],[1.9,141],[2.1,146],[2.6,152],[2.9,156],[3.3,161],[3.8,167],[4.2,172],[4.6,175],[5.4,181],[6.1,186]];
function drLakGraf(){var W=300,H=160;function x(v){return 26+v/7*(W-36)}function y(v){return H-18-(v-120)/75*(H-30)}
 var s='<svg viewBox="0 0 '+W+' '+H+'">';[130,150,170,190].forEach(function(v){s+='<line x1="26" x2="'+(W-10)+'" y1="'+y(v)+'" y2="'+y(v)+'" stroke="var(--a-line)"/><text x="22" y="'+(y(v)+3)+'" text-anchor="end" font-size="8" fill="var(--a-mute)" font-family="Barlow">'+v+'</text>'});
 [1,2,3,4,5,6].forEach(function(v){s+='<text x="'+x(v)+'" y="'+(H-5)+'" text-anchor="middle" font-size="8" fill="var(--a-mute)" font-family="Barlow">'+v+'</text>'});
 s+='<line x1="'+x(2)+'" x2="'+x(2)+'" y1="8" y2="'+(H-18)+'" stroke="#28A86E" stroke-dasharray="3 3"/><text x="'+x(2)+'" y="8" text-anchor="middle" font-size="9" font-weight="700" fill="#28A86E" font-family="Barlow Condensed">LT1</text>';
 s+='<line x1="'+x(4)+'" x2="'+x(4)+'" y1="8" y2="'+(H-18)+'" stroke="#E23A5A" stroke-dasharray="3 3"/><text x="'+x(4)+'" y="8" text-anchor="middle" font-size="9" font-weight="700" fill="#E23A5A" font-family="Barlow Condensed">LT2</text>';
 s+='<line class="dr-reg" x1="'+x(.5)+'" y1="'+y(122)+'" x2="'+x(6.5)+'" y2="'+y(191)+'" stroke="#38BDF8" stroke-width="2" pathLength="1"/>';
 LAK.forEach(function(p,i){s+='<circle class="dr-pk" style="transition-delay:'+(i*60)+'ms" cx="'+x(p[0])+'" cy="'+y(p[1])+'" r="3.4" fill="#FF4500"/>'});return s+'</svg>'}
function drBelGraf(){var W=300,H=150,n=20,bw=(W-10)/n;var c=46,a=50,C=[],A=[],T=[],TSS=[];for(var i=0;i<n;i++){var t=380+i*14+((i%4===3)?-160:40)+(i%2?30:-10);TSS.push(t);c+=(t/7-c)*.22;a+=(t/7-a)*.55;C.push(c);A.push(a);T.push(c-a+50)}
 function y(v){return H-14-(v/110)*(H-24)}function sti(arr){return arr.map(function(v,i){return(i?'L':'M')+(5+(i+.5)*bw).toFixed(1)+' '+y(v).toFixed(1)}).join('')}
 var s='<svg viewBox="0 0 '+W+' '+H+'">'+TSS.map(function(t,i){var h=(t/7)/190*(H-24);return'<rect class="dr-bar2" style="transition-delay:'+(i*30)+'ms" x="'+(5+i*bw+bw*.2)+'" y="'+(H-14-h)+'" width="'+(bw*.6)+'" height="'+h+'" fill="#E8B93C" opacity=".35"/>'}).join('')+
  '<line x1="5" x2="'+(W-5)+'" y1="'+y(50)+'" y2="'+y(50)+'" stroke="#555560" stroke-dasharray="2 2"/>';
 [[C,'#38BDF8',2],[A,'#E23A5A',1.5],[T,'#28A86E',2]].forEach(function(l,i){s+='<path class="dr-reg" style="transition-delay:'+(i*.25)+'s" d="'+sti(l[0])+'" fill="none" stroke="'+l[1]+'" stroke-width="'+l[2]+'" pathLength="1"/>'});
 return s+'</svg>'}
SC2.push({kap:2,tittel:'LAKTAT, TERSKEL OG BELASTNING.',tekst:'Laktat mot puls regner ut terskelen for hver økt og følger den over tid. Belastningsmodellen viser form, tretthet og overskudd - og FTP-estimat, NP/IF og frakobling ligger under.',
 steg:['Laktatprofil og terskel','Form, tretthet og overskudd','Watt og aerob form'],varighet:11000,
 html:function(){return'<div class="app dr-app2" style="max-width:520px"><div class="dr-tabs"><span class="on" data-t="lak">Terskel</span><span data-t="bel">Belastning</span><span data-t="pre">Prestasjon</span></div>'+
  '<div class="p-lak"><div class="dr-kt">Laktatprofil - mmol/L vs puls</div><div class="dr-ku">Hver måling er ett punkt · blå linje = regresjon</div>'+drLakGraf()+
  '<div class="dr-mc"><div style="--c:#28A86E"><small>LT1 (2 mmol)</small><b class="d4-lt1">0</b><em>aerob terskel</em></div><div style="--c:#E23A5A"><small>LT2 (4 mmol)</small><b class="d4-lt2">0</b><em>anaerob terskel</em></div><div style="--c:#38BDF8"><small>Datapunkter</small><b>12</b><em>R² = 97%</em></div></div></div>'+
  '<div class="p-bel" style="display:none"><div class="dr-kt">Custom belastningsgraf</div><div class="dr-ku">TSS per uke · CTL form · ATL tretthet · TSB overskudd</div>'+
  '<div class="dr-chips"><span class="dr-chip2" style="--c:#E8B93C">TSS</span><span class="dr-chip2" style="--c:#38BDF8">CTL</span><span class="dr-chip2" style="--c:#E23A5A">ATL</span><span class="dr-chip2" style="--c:#28A86E">TSB</span></div>'+drBelGraf()+
  '<div class="dr-mc"><div style="--c:#38BDF8"><small>CTL nå</small><b>78</b><em>form</em></div><div style="--c:#E23A5A"><small>ATL</small><b>66</b><em>tretthet</em></div><div style="--c:#28A86E"><small>TSB</small><b>+12</b><em>overskudd</em></div></div></div>'+
  '<div class="p-pre" style="display:none"><div class="dr-kt">Watt og aerob form</div><div class="dr-ku">Beregnet fra øktene - estimater skrives aldri automatisk</div>'+
  '<div class="dr-mc" style="grid-template-columns:1fr 1fr"><div style="--c:#E8B93C"><small>FTP-estimat</small><b>312 W</b><em>beste 20 min × 0,95</em></div><div style="--c:#1A6FD4"><small>Watt per kg</small><b>4,21</b><em>FTP 310 W · 73,6 kg</em></div><div style="--c:#FF4500"><small>NP · IF</small><b>286 · 0,92</b><em>siste terskeløkt</em></div><div style="--c:#28A86E"><small>Frakobling</small><b>3,1 %</b><em>god (&lt; 5 %)</em></div><div style="--c:#3DD68C"><small>Effektivitet (EF)</small><b>1,62 ↑</b><em>rolige økter</em></div><div style="--c:#1F8F5C"><small>GAP-tempo</small><b>4:12</b><em>stigningsjustert</em></div></div></div></div>'},
 spill:function(S){function fane(t){S.qa('.dr-tabs span').forEach(function(x){x.classList.toggle('on',x.dataset.t===t)});['lak','bel','pre'].forEach(function(k){S.q('.p-'+k).style.display=k===t?'':'none'})}
  S.steg(0,0);S.t(300,function(){S.qa('.p-lak .dr-pk').forEach(function(g){g.classList.add('inn')})});S.t(900,function(){S.q('.p-lak .dr-reg').classList.add('inn')});
  S.tell('.d4-lt1',100,146,900,1800);S.tell('.d4-lt2',100,171,900,1800);
  S.steg(1,4000);S.til('.dr-tabs [data-t="bel"]',4000,true,450);S.t(4450,function(){fane('bel');var run=function(){S.qa('.p-bel .dr-bar2,.p-bel .dr-reg').forEach(function(g){g.classList.add('inn')});S.qa('.p-bel .dr-chip2').forEach(function(g){g.classList.add('on')})};if(S.still)run();else requestAnimationFrame(function(){requestAnimationFrame(run)})});
  S.steg(2,7600);S.til('.dr-tabs [data-t="pre"]',7600,true,450);S.t(8050,function(){fane('pre');S.qa('.p-pre .dr-mc>div').forEach(function(d,i){d.style.transitionDelay=(i*90)+'ms';d.classList.add('inn')})});S.bort(8300);S.steg(3,10000)}
});

/* ── D5 · TERSKLER OG SONER ── */
var SONER=[['I1','#28A86E','106','136'],['I2','#1A6FD4','136','155'],['I3','#E8B93C','155','164'],['I4','#FF8C00','164','174'],['I5','#E23A5A','174','184']];
SC2.push({kap:3,tittel:'DINE SONER. PER BEVEGELSESFORM.',tekst:'Terskelpuls, terskelfart og FTP per bevegelsesform og underkategori, versjonert per dato. Egne soner der du vil - Olympiatoppens standard ellers.',
 steg:['Terskel per bevegelsesform','Egne soner','Utvidet skala I6-I8'],varighet:9000,
 html:function(){return'<div class="app dr-app2" style="max-width:500px"><div class="dr-tr"><div><b>Langrenn · Skøyting</b><small>underkategori av langrenn</small></div><span class="dr-egne" style="opacity:0">Egne soner</span></div>'+
  '<div class="dr-tv"><div><small>Terskelpuls</small><b class="d5-tp">168</b></div><div><small>Terskelfart</small><b>-</b></div><div><small>FTP</small><b>-</b></div><div><small>Gjelder fra</small><b class="d5-gf">3. mar</b></div></div>'+
  '<p class="dr-hist">Historikk: 168 ▲ 3. mar - terskelen overskrives aldri, den versjoneres.</p>'+
  '<div class="dr-bryter"><i class="d5-b1"></i>Egne soner for denne bevegelsesformen</div>'+
  SONER.map(function(z){return'<div class="dr-sone dr-a"><span style="background:'+z[1]+'">'+z[0]+'</span><em>'+z[2]+'</em>-<em>'+z[3]+'</em><small>bpm</small></div>'}).join('')+
  '<div class="dr-i68"><i class="dr-bryt2 d5-b2"></i><span>Utvidet skala</span><b style="background:#7C3AED">I6</b><b style="background:#E879F9">I7</b><b style="background:#881337">I8</b></div></div>'},
 spill:function(S){S.steg(0,0);S.til('.d5-tp',400,true,450);S.t(850,function(){var e=S.q('.d5-tp');e.textContent='172';e.parentNode.classList.add('glod2');S.q('.d5-gf').textContent='1. sep';S.q('.dr-hist').textContent='Historikk: 168 → 172 ▲ 1. sep - terskelen overskrives aldri, den versjoneres.'});
  S.steg(1,2600);S.til('.d5-b1',2600,true,450);S.t(3050,function(){S.q('.d5-b1').classList.add('on');S.q('.dr-egne').style.opacity=1;S.qa('.dr-sone').forEach(function(r,i){r.style.transitionDelay=(i*110)+'ms';r.classList.add('inn')})});
  S.steg(2,5400);S.til('.d5-b2',5400,true,450);S.t(5850,function(){S.q('.d5-b2').classList.add('on');S.q('.dr-i68').classList.add('on')});S.bort(6100);S.steg(3,7600)}
});

/* ── D6 · MALER ── */
SC2.push({kap:4,tittel:'BYGG ÉN GANG. BRUK HELE SESONGEN.',tekst:'Øktmaler, testmaler og planmaler du legger rett inn på en dato - og standardøkter du følger over tid. 58 økter på Olympiatoppens skala ligger klare i øktskjemaet.',
 steg:['Økt- og testmaler','Bruk på dato','Planmaler'],varighet:9500,
 html:function(){return'<div class="app dr-app2" style="max-width:520px;position:relative"><div class="dr-tabs"><span class="on" data-t="okt">Økt-maler</span><span data-t="plan">Plan-maler</span><span data-t="std">'+ik('standardokt-serie','s')+'Standardøkter</span></div>'+
  '<div class="d6-okt">'+[['Terskel komb 2×10 I3 + 3×5 I4','Terskel · Skiskyting · Brukt 8× · Sist: 15. sep','',1],['Terskeltest 3 × 10 min','Test · Test-mal · Løping · Brukt 3×','laktat',0],['Hard komb 5 × 4 min','Intervall · Skiskyting · Brukt 5×','',0]].map(function(m,i){return'<div class="dr-mal dr-a" data-i="'+i+'"><div><b>'+(m[2]?ik(m[2],'s','width:14px;height:14px;color:#D4A017'):'')+(m[3]?ik('standardokt-serie','s','width:14px;height:14px;color:#FF8A5C'):'')+m[0]+'</b><small>'+m[1]+'</small></div><span class="dr-pl sm">Bruk på dato</span></div>'}).join('')+'</div>'+
  '<div class="d6-plan" style="display:none">'+[['Grunnuke - 12 t','Plan-mal · 7 dager · 9 økter'],['Høydesamling 10 dager','Plan-mal · 10 dager · 16 økter'],['Konkurranseuke A','Plan-mal · 7 dager · 6 økter']].map(function(m){return'<div class="dr-mal dr-a"><div><b>'+m[0]+'</b><small>'+m[1]+'</small></div><span class="dr-pl sm">Bruk på dato</span></div>'}).join('')+'</div>'+
  '<div class="dr-fra"><small>Fra mal i øktskjemaet</small><div>'+['6 × 6 min / 2 min','Hard komb 5 × 4 min','30/15 × 3 serier'].map(function(x){return'<span>'+ik('bibliotek','s')+x+'</span>'}).join('')+'</div><em>58 økter på Olympiatoppens skala - alt kan endres etter valg</em></div>'+
  '<div class="d6-dlg"><div class="dr-pvfh" style="margin-bottom:6px"><span class="strek" style="width:16px;height:2px"></span>Bruk mal på dato</div><p class="dr-hj" style="margin:0 0 8px">Sett inn <b>Terskel komb</b> som planlagt økt på valgt dato i din Plan-kalender.</p><div class="felt" style="justify-content:flex-start;padding:0 10px;height:34px;font-size:14px">Tor 24. sep</div><div style="display:flex;gap:6px;justify-content:flex-end;margin-top:8px"><span class="dr-pl sm">Avbryt</span><span class="dr-pl sm d6-bekreft" style="background:#FF4500;border-color:#FF4500;color:#fff">Bekreft</span></div></div>'+
  '<div class="toast">'+ik('fullfort','s')+'Lagt inn tor 24. sep</div></div>'},
 spill:function(S){S.steg(0,0);S.t(250,function(){S.qa('.d6-okt .dr-mal').forEach(function(m,i){m.style.transitionDelay=(i*110)+'ms';m.classList.add('inn')})});
  S.steg(1,2000);S.til('.d6-okt .dr-mal[data-i="0"] .dr-pl',2000,true,450);S.t(2450,function(){S.q('.d6-dlg').classList.add('inn')});
  S.til('.d6-bekreft',3300,true,450);S.t(3750,function(){S.q('.d6-dlg').classList.remove('inn');S.q('.toast').classList.add('inn')});S.t(5200,function(){S.q('.toast').classList.remove('inn')});
  S.steg(2,5600);S.til('.dr-tabs [data-t="plan"]',5600,true,450);S.t(6050,function(){S.qa('.dr-tabs span').forEach(function(x){x.classList.toggle('on',x.dataset.t==='plan')});S.q('.d6-okt').style.display='none';var p=S.q('.d6-plan');p.style.display='';var run=function(){p.querySelectorAll('.dr-mal').forEach(function(m,i){m.style.transitionDelay=(i*110)+'ms';m.classList.add('inn')})};if(S.still)run();else requestAnimationFrame(function(){requestAnimationFrame(run)})});
  S.bort(6300);S.steg(3,8200)}
});

/* ── D7 · SKITEST OG SKIPARK ── */
SC2.push({kap:5,tittel:'VIT HVILKE SKI SOM GÅR.',tekst:'Skiparken med km, slip og smøring per par. Tidtaker-, lengde- og parallelltester med forholdene registrert - og alt annet utstyr, fra sko til båt.',
 steg:['Skiparken','Parallelltesten','Rangeringen'],varighet:9500,
 html:function(){return'<div class="dr-to"><div class="app dr-app2"><div class="dr-ski"><div class="dr-skit"><b>Redline 3.0 #2</b><span class="dr-tag g">'+ik('konkurranse','s')+'KONK</span><span class="dr-tag b">SKØYTING</span></div><small>Madshus Redline · 187 cm · Slip: S1-7 kald (2026)</small>'+
  '<div class="dr-skikm"><b class="d7-km">0</b><span>KM</span><em>Smøring: HF7</em></div><i class="dr-bar"><b class="dr-gro" style="--w:78%"></b></i><small>312 KM SIDEN SISTE SLIP · 42 ØKTER</small></div>'+
  '<div class="dr-ski" style="margin-top:8px"><div class="dr-skit"><b>Speedmax #1</b><span class="dr-tag g">'+ik('konkurranse','s')+'KONK</span><span class="dr-tag b">SKØYTING</span></div><small>Fischer Speedmax · 187 cm · Slip: P5-1 (2025)</small>'+
  '<div class="dr-skikm"><b class="d7-km2">0</b><span>KM</span><em>Smøring: HF7</em></div><i class="dr-bar"><b class="dr-gro" style="--w:52%"></b></i><small>188 KM SIDEN SISTE SLIP · 29 ØKTER</small></div></div>'+
  '<div class="app dr-app2"><div class="dr-kt">Parallelltesten - to og to · vinneren videre</div><p class="dr-hj" style="margin:2px 0 6px">Sjusjøen · klart · hardpakket · luft -8° · snø -10°</p><div class="dr-brak">'+
  '<div><small>Runde 1</small><span class="p1a">#2 Redline</span><span class="p1b">#4 Redline</span><span class="p2a">#1 Speedmax</span><span class="p2b">#3 Speedmax</span></div>'+
  '<div><small>Finale</small><span class="f1 dr-a">#2 Redline</span><span class="f2 dr-a">#1 Speedmax</span></div></div>'+
  '<div class="dr-rang dr-a"><small>Rangering</small><div><b>1</b>Redline 3.0 #2 '+ik('favoritt','f','width:12px;height:12px;color:#D4A017')+'</div><div><b>2</b>Speedmax #1</div><div><b>3</b>Redline #4</div><div><b>4</b>Speedmax #3</div></div></div></div>'},
 spill:function(S){S.steg(0,0);S.tell('.d7-km',0,812,1000,300);S.tell('.d7-km2',0,540,1000,300);S.t(300,function(){S.qa('.dr-gro').forEach(function(g){g.classList.add('inn')})});
  S.steg(1,2600);S.til('.p1a',2600,true,400);S.t(3000,function(){S.q('.p1a').classList.add('w')});S.til('.p2a',3700,true,400);S.t(4100,function(){S.q('.p2a').classList.add('w')});
  S.t(4600,function(){S.q('.f1').classList.add('inn');S.q('.f2').classList.add('inn')});
  S.steg(2,5600);S.til('.f1',5600,true,400);S.t(6000,function(){S.q('.f1').classList.add('w')});S.inn('.dr-rang',6700);S.bort(6900);S.steg(3,8200)}
});
var MER2=[
 ['Skuddplott per serie: hvert skudd der det satt, nummerert og farget per serie','Liggende og stående, L/S-bryter per serie','Vind (vimpel, 11 tilstander) og sikt ført per serie - forrige series verdi foreslås','Puls inn merket AUTO er lest fra pulskurven - manuelt ført (M) vinner alltid','Samme serier som skyting-kortene og statistikken - endringer slår gjennom overalt'],
 ['Treff % i vind og sikt - under 20 førte skudd står det «for lite data», ikke et tall','Vindretning: sider hver for seg, slått sammen, fra venstre eller fra høyre','Skuddplott-heatmap per stilling: hele perioden, siste 30 eller 90 dager, konkurranse','Bom-retning over tid - høyre, venstre, over og under per måned','Treff mot puls inn og mot skytetid, treff % per stilling over tid'],
 ['«Marker som gjennomført» - planen står urørt, dagboka får sannheten','«Se fullført økt» og «Se planen» - bytt mellom de to','Flett klokkeøkta: bytt ut aktivitetene med klokkas runder, eller legg klokka bak','Plan vs faktisk rad for rad - grønt innenfor 10 %, oransje over','Splittet, Samlet eller Samle alt - og angre flett når som helst'],
 ['Laktatkrysning per økt: puls ved 4 mmol fra minst tre målinger, plottet over tid mot terskelen som gjaldt den dagen','Laktatprofil med LT1 og LT2, laktat ved samme fart eller watt, laktat-respons per mal','Belastningsmodell: TSS, CTL (form), ATL (tretthet) og TSB (overskudd) - mot følelse, HRV, hvilepuls, søvn eller laktat','Terskel over tid per bevegelsesform - estimater foreslås, men skrives aldri automatisk','FTP-estimat fra beste 20 min × 0,95, watt per kg, watt-soner per uke, NP og IF per økt','Aerob frakobling, effektivitetsfaktor, GAP-tempo, fart eller watt ved terskelpuls og sesong mot sesong'],
 ['Terskler per bevegelsesform og underkategori - arves fra globalt nivå når ikke annet er satt','Terskelen versjoneres: en økt bruker terskelen som gjaldt på øktas dato','Egne I1-I5 per bevegelsesform, eller Olympiatoppens standard fra terskel og makspuls','Utvidet skala I6-I8 for planlegging og føring - treneren ser samme skala','FTP for NP og IF'],
 ['Øktmaler og planmaler med «Bruk på dato» rett inn i planen','Testmaler - merket for tester, med eget hurtigfilter','58 ferdige økter på Olympiatoppens skala i øktskjemaet («Fra mal»)','«Lagre som mal» nederst i enhver økt','Standardøkt-serier: koble økter til serien og sammenlign gjennomføringene i analysen'],
 ['Min skipark: km, tid og økter per par, km siden siste slip, sliphistorikk','Skitester: tidtaker-glid, lengde-glid, parallelltest og egen test - med forholdene registrert','Rangering og beste forhold per par','Utstyr: ski, rulleski, sko, staver, sykkel, båt og klokke','Km og tid telles først når økta er markert gjennomført']];
SC2.forEach(function(s,i){s.mer=MER2[i]});
var MER1={
 'MAL SESONGEN.':['Mal belastning Rolig, Medium eller Hard med pensel over uker - eller dag for dag','Periodene får eget navn og fokus, og fokuset vises i Plan','Samlinger og høydeopphold som egne bånd, med sted og moh','Nøkkeldatoer: A-, B- og C-konkurranser, testløp, test og peak (formtopp-mål med gull-glød)','Månedsvolum og planlagt årstotal','Planen står urørt når dagboka fylles'],
 'BYGG ØKTA PÅ SEKUNDER.':['Hurtigoppsett: antall × dragtid eller km × sone / pause, flere rader stables','Kortintervaller 50/10, 45/15 og 20/10, og fartsspenn per drag','Skiskyttere velger skyting i pausene (L-S-L-S og flere mønstre)','Plan-grafen: blokker per sone, klammer, etiketter og skyting','Nøkkeltall: varighet, hovedsone, sonetid, belastning og forventet 1-10','Etter klokkesynk kuttes den samme økta opp i segmentbåndet'],
 'LAGRE DEN SOM MAL.':['«Lagre som mal» fra skjemaet på enhver økt','Maler er struktur - aldri datoer, puls eller resultater','«Bruk på dato» legger malen rett inn i planen','58 ferdige økter på Olympiatoppens skala under «Fra mal»','Plan-maler for hele uker og samlinger'],
 'LØFT MED ÉN HÅND.':['Store trinnknapper for reps og kilo - ingen tastatur','Forrige økt i grått, beste og plan som chips','Hvilen teller ned mellom settene','«Stopp» fryser klokka, «Fortsett» tar deg tilbake','Nye rekorder og tonnasje når økta er ferdig, rett i dagboka','NB: dette er designutkastet for live styrke v2 - ikke bygget ennå'],
 'FORMEN KOMMER INN OM NATTA.':['Hvilepuls, HRV, søvn og følelse på helsekortet','Søvnstadier: dyp, lett, REM og våken','HRV og hvilepuls mot 30-dagers snitt, med hardøktene merket','Manuelt ført vinner alltid over klokka (M)','Helsedata deles med treneren bare hvis du har sagt ja'],
 'ØKTA KOMMER INN AV SEG SELV.':['Garmin, COROS, Wahoo og Zepp (beta), Polar og Strava','.fit-filer fra alle merker kan lastes opp','Flett klokkeøkta med planen: bytt ut aktivitetene eller legg klokka bak','Klokkas originale runder beholdes alltid','Synk automatisk, eller trykk Synk når du vil'],
 'FØR DET KLOKKA IKKE VET.':['Puls, tempo, watt, kadens og høyde på én tidsakse','Planen som spøkelse bak kurven','Skyting, laktat, ernæring og notater som punkter der det skjedde','Zoom og segmentbånd med klammer per bolk','Treneren svarer i kommentarfeltet på økta','Stillestand kan gjøres om til pause automatisk'],
 'SE HELE FORMEN PÅ ÉN AKSE.':['Sonetid per dag, form (CTL), tretthet (ATL) og overskudd (TSB)','Restitusjon: HRV og hvilepuls som avvik fra ditt eget grunnivå','Følelse og dagstatus (hviledag, sykdom, konkurranse) på samme akse','Les én dag, eller se 30, 60 og 180 dager','NB: formkartet er designutkast - ikke bygget ennå'],
 'SAMME ØKT. ÅTTE GANGER.':['Merk en økt som standardøkt, så følges hver gjennomføring','Velg variabel: snittpuls, laktat maks, treff %, skytetid, opplevd og mer','Per drag - én linje per drag-indeks','Beste gjennomføring markert, og hver verdi mot forrige og mot beste','Vær og føre i tabellen'],
 'ALT SAMLET PÅ HJEM.':['I dag: dagens økt og neste økt','Ukens totaler mot planen, med soner og skudd','Nedtelling til neste A-konkurranse','Helse, siste hardøkt, hovedmål og periode','Alt hentes i én samlet henting - ingen kort som laster etter']};
/* «Les mer»-tekstene til to flyt-scener - bare når flyt-fila er lastet (undersidene laster detaljene alene). */
if(typeof SC!=='undefined')SC.forEach(function(s){if(MER1[s.tittel])s.mer=MER1[s.tittel]});
karusell(SC2, KAP2, 'd');
