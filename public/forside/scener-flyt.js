/* #flyt «FRA ÅRSPLAN TIL INNSIKT.» - scenene. Kilde: <script> i
   design/xpulse-flyt-bolk-design.html (16. sep 2026). Motoren ligger i
   karusell.js, ikonene i ikoner.js (generert). Tekstene er sjekket mot
   appkoden og skal ikke skrives om.

   ÉN SCENE ER UTKAST og ikke bygget i appen: «Formkartet» (Analyser).
   «Live styrke v2» (Tren) er bygget 17. sep (bolk 8) - scene 4 følger
   LiveSessionView.tsx, ikke designfila. De ligger her ferdig, men filtreres ut av SC for
   karusell() kalles nar VIS_UTKAST_SCENER er false (Sverre slo dem PA 16. sep). Forsiden skal aldri
   vise noe som ikke finnes i appen. Kapittel «Tren» beholder helse-scenen. */
var VIS_UTKAST_SCENER = true; /* Sverre 16. sep: vis dem na - live styrke v2 og formkartet er pa vei inn i appen */
var UTKAST_TITLER = ['SE HELE FORMEN PÅ ÉN AKSE.']; /* «Løft med én hånd» er bygget (bolk 8, 17. sep) og er ikke utkast lenger */

function oktbyggerIkon(){var farger=['#1A6FD4','#E23A5A','#28A86E','#FF4500'];var d=IK.oktbygger.f.split(/(?=M)/);
  return '<svg viewBox="0 0 24 24" aria-hidden="true">'+d.map(function(x,i){return'<path d="'+x+'" fill="'+farger[Math.min(i,3)]+'"/>'}).join('')+'</svg>';}

/* ═════════════════ SCENENE ═════════════════ */
var KAP=[{n:'Planlegg',ik:'planlegg'},{n:'Tren',ik:'live-styrke'},{n:'Synk klokka',ik:'synk'},{n:'Før detaljer',ik:'for-okt'},{n:'Analyser',ik:'analyse'},{n:'Hjem',ik:'hjem'}];
var SC=[];

/* ── 1 · ÅRSPLAN ── */
var MND=[['SEP',[36,37,38,39]],['OKT',[40,41,42,43,44]],['NOV',[45,46,47,48]],['DES',[49,50,51,52]],['JAN',[1,2,3,4,5]],['FEB',[6,7,8,9]]];
var BEL={rolig:'#28A86E',medium:'#D4A017',hard:'#E11D48'};
/* [belastning, navn, uker, timer per uke] */
var PER=[['rolig','Grunntrening',[36,37,38,39,40,41,42,43,44],12],['medium','Oppbygging',[45,46,47,48],14],['hard','Toppform 1',[49,50,51],10],['rolig','Overgang',[52,1],8],['medium','Spesifikk',[2,3,4,5],14],['hard','Toppform 2',[6,7,8,9],10]];
function ukeMnd(u){for(var i=0;i<MND.length;i++)if(MND[i][1].indexOf(u)>=0)return i;return -1}
SC.push({kap:0,tittel:'MAL SESONGEN.',tekst:'Mal periodene med pensel - rødt er hard. Legg inn samlinger i høyden, sett konkurransene og formtoppen, og se de planlagte timene per måned vokse mens du maler.',
 steg:['Mal periodene','Samling i høyden','Konkurranser og peak'],
 mer:['Pensel med tre belastninger - rolig, medium, hard - malt uke for uke på et lerret for hele sesongen.','Nøkkeldatoer: A-, B- og C-konkurranser, testløp, samlinger og høydesamlinger med moh. Peak settes sammen med A-rennet.','Planlagte timer per måned står ved hver månedsrad og summeres nederst mens du maler.','Periodene og samlingene vises igjen som stripe over uka i plan og dagbok, og treneren kan pushe en hel årsplan-mal til utøveren.'],varighet:9000,fart:1,
 html:function(){var rader=MND.map(function(r,mi){return'<div class="mnd"><span>'+r[0]+'</span><div class="uker">'+r[1].map(function(u){return'<div class="uke" data-u="'+u+'">U'+u+'</div>'}).join('')+'</div><div class="mtim"><b data-m="'+mi+'">0</b><small>t plan</small></div></div>'}).join('');
  return'<div class="app ars"><div class="ars-hd"><span class="strek"></span><span class="bebas">Mal sesongen</span><span class="cap" style="margin-left:auto">2026/27</span></div>'+
  '<div class="vlinje"><div class="vgr"><span class="cap">Belastning</span>'+['rolig','medium','hard'].map(function(b){return'<span class="vk" data-b="'+b+'"><i class="rute" style="background:'+BEL[b]+'"></i>'+b[0].toUpperCase()+b.slice(1)+'</span>'}).join('')+'</div>'+
  '<div class="vgr"><span class="cap">Markering</span><span class="vk" data-b="samling">'+ik('treningssamling','f')+ik('hoydesamling','f')+'<span>Samling/høyde</span></span></div>'+
  '<div class="vgr"><span class="cap">Nøkkeldato</span><span class="vk" data-b="A">'+ik('a-konkurranse','f')+'A</span><span class="vk" data-b="B">'+ik('b-konkurranse','f')+'B</span><span class="vk skjul-m" data-b="C">'+ik('c-konkurranse','f')+'C</span><span class="vk skjul-m" data-b="peak">'+ik('peak','f')+'<span>Peak</span></span></div></div>'+
  rader+'<div class="ars-fot"><span>Planlagt · 6 mnd</span><b class="ars-sum">0</b><small>t</small></div></div>'},
 spill:function(S){var mtim=[0,0,0,0,0,0],STEG=230,t0=350;
  function verktoy(b){S.qa('.vk[data-b]').forEach(function(v){v.classList.remove('on');v.style.background=''});var v=S.q('.vk[data-b="'+b+'"]');if(v){v.classList.add('on');v.style.background=BEL[b]||'var(--a-card2)'}}
  function bump(u,h){var mi=ukeMnd(u);mtim[mi]+=h;var e=S.q('.mtim b[data-m="'+mi+'"]');e.textContent=mtim[mi];e.parentNode.classList.remove('puls');void e.offsetWidth;e.parentNode.classList.add('puls');S.q('.ars-sum').textContent=mtim.reduce(function(a,b){return a+b},0)}
  function leggTil(sel,cls,html,stil){var c=S.q(sel);var e=document.createElement('span');e.className=cls+' pop';e.innerHTML=html;if(stil)e.setAttribute('style',stil);c.appendChild(e);requestAnimationFrame(function(){e.classList.add('inn')});return e}
  var KONK={47:['B','b-konkurranse','#1A6FD4','Beitostølen'],50:['A','a-konkurranse','#D4A017','Simostranda'],3:['B','b-konkurranse','#1A6FD4','NC'],8:['A','a-konkurranse','#D4A017','NM']};
  var uker=[];MND.forEach(function(r){r[1].forEach(function(u){uker.push(u)})});
  S.steg(0,0);S.t(t0-300,function(){verktoy('rolig')});
  uker.forEach(function(u,n){var at=t0+n*STEG,p=PER.filter(function(x){return x[2].indexOf(u)>=0})[0],f=BEL[p[0]];
   S.til('.uke[data-u="'+u+'"]',at-STEG);
   S.t(at,function(){var c=S.q('.uke[data-u="'+u+'"]');c.style.background=f+'42';c.style.borderColor=f+'8C';bump(u,p[3]);
    var k=KONK[u];verktoy(u===41||u===42?'samling':(k?k[0]:p[0]));
    if(p[2][0]===u)leggTil('.uke[data-u="'+u+'"]','etk',p[1],'border-color:'+f+'80;color:'+f);
    if(u===41)leggTil('.uke[data-u="41"]','band start',ik('treningssamling','f')+ik('hoydesamling','f')+'<span>Livigno · 10 dager</span>','left:calc(3/7*100% + 2px)');
    if(u===42)leggTil('.uke[data-u="42"]','band slutt','','right:calc(1/7*100% + 2px)');
    if(k){leggTil('.uke[data-u="'+u+'"]','nd',ik(k[1],'f')+'<span>'+k[3]+'</span>','border-color:'+k[2]+';color:'+k[2]);if(k[0]==='A'){c.classList.add('peak');leggTil('.uke[data-u="'+u+'"]','pk',ik('peak','f'))}}});
   if(u===41)S.steg(1,at);if(u===47)S.steg(2,at)});
  var slutt=t0+uker.length*STEG+250;S.bort(slutt);S.t(slutt,function(){S.qa('.vk[data-b]').forEach(function(v){v.classList.remove('on');v.style.background=''})});S.steg(3,slutt+150)}
});

/* ── 2 · ØKTBYGGER ── */
function planGraf(W){var B=196,P=120,x0=6,bw=W-12;function X(m){return x0+m/TOT*bw}var s='';
 s+='<rect x="'+x0+'" y="'+(B-P*.36)+'" width="'+bw+'" height="'+(P*.36)+'" fill="#28A86E" opacity=".18"/>';
 OKT.forEach(function(b,i){var h=P*blokkH(b),x=X(b.s)+.75,w=X(b.e)-X(b.s)-1.5;s+='<rect class="blk" data-i="'+i+'" x="'+x+'" y="'+(B-h)+'" width="'+w+'" height="'+h+'" rx="3" fill="'+blokkFarge(b)+'" opacity="'+(b.t==='sky'?.7:(b.z==='I1'?.62:.95))+'"/>'});
 var tx='font-family="Barlow Condensed" font-weight="700" font-size="12" letter-spacing=".06em"',sub='font-family="Barlow Condensed" font-size="11" fill="var(--a-mut)"';
 function enkel(b,tit,u,i){var cx=(X(b.s)+X(b.e))/2,top=B-P*blokkH(b);return'<g class="lbl" data-i="'+i+'"><text x="'+cx+'" y="'+(top-44)+'" text-anchor="middle" '+tx+' fill="var(--a-ink)">'+tit+'</text><text x="'+cx+'" y="'+(top-30)+'" text-anchor="middle" '+sub+'>'+u+'</text><line x1="'+cx+'" x2="'+cx+'" y1="'+(top-24)+'" y2="'+(top-2)+'" stroke="var(--a-line2)"/></g>'}
 function klamme(s0,e0,z,tit,u,i){var top=B-P*HOYDE[z],x1=X(s0)+1,x2=X(e0)-1,cx=(x1+x2)/2;return'<g class="lbl" data-i="'+i+'"><path d="M'+x1+' '+(top-18)+'v-4h'+(x2-x1)+'v4" fill="none" stroke="var(--a-line2)"/><text x="'+cx+'" y="'+(top-40)+'" text-anchor="middle" '+tx+' fill="var(--a-ink)">'+tit+'</text><text x="'+cx+'" y="'+(top-27)+'" text-anchor="middle" '+sub+'>'+u+'</text></g>'}
 s+=enkel(OKT[0],'OPPVARMING','20 min · I1',0);s+=klamme(20,43,'I3','2 × 10 MIN · I3','3 min pause',1);s+=klamme(46,65,'I4','3 × 5 MIN · I4','2 min pause',5);s+=enkel(OKT[10],'NEDJOGG','15 min · I1',10);
 OKT.forEach(function(b,i){if(b.t!=='sky')return;var cx=(X(b.s)+X(b.e))/2,top=B-P*.18;s+='<g class="lbl" data-i="'+i+'"><svg x="'+(cx-11)+'" y="'+(top-17)+'" width="11" height="11" viewBox="0 0 24 24" style="color:var(--a-mut)"><path d="'+IK.skyting.f+'" fill="currentColor"/></svg><text x="'+(cx+3)+'" y="'+(top-8)+'" '+tx+' font-size="11" fill="var(--a-mut)">'+b.ls+'</text></g>'});
 s+='<line x1="'+x0+'" x2="'+(W-6)+'" y1="'+B+'" y2="'+B+'" stroke="var(--a-line2)"/><text x="'+x0+'" y="212" font-family="Inter" font-size="10.5" fill="var(--a-mut)">0:00</text><text x="'+(W-6)+'" y="212" text-anchor="end" font-family="Inter" font-size="10.5" fill="var(--a-mut)">1:20:00</text>';
 return'<svg viewBox="0 30 '+W+' 188">'+s+'</svg>'}
SC.push({kap:0,tittel:'BYGG ØKTA PÅ SEKUNDER.',tekst:'Antall × dragtid × sone / pause. Skiskyttere velger skyting i pausene. Trykk Opprett, og økta tegner seg som graf med soner, klammer og nøkkeltall.',
 steg:['Fyll inn dragene','Skyting i pausene','Se økta før du gjør den'],
 mer:['Antall × dragtid × sone / pause, flere bolker etter hverandre, oppvarming og nedjogg rundt.','Drag i kilometer med planlagt fart, kortintervaller inni draget (50/10, 20/10), watt, stigning og motstand per bevegelsesform.','Skiskyting: L-S-L-S, LLSS, par eller ett anlegg - skytinga tar sin tid av pausen, totaltida er uendret.','Økta tegnes som graf med soner, klammer og nøkkeltall før du gjør den, og «Endre» på en bolk fyller skjemaet fra radene igjen.'],varighet:7500,fart:1,
 html:function(){function felt(v,cls){return'<div class="felt '+(cls||'')+'"><span class="v">'+v+'</span></div>'}
  function drag(i,a,t,z,p){return'<div class="drad" data-r="'+i+'">'+felt(a,'fa')+'<span>×</span><div class="tk"><span class="on">TID</span><span>KM</span></div>'+felt(t,'ft')+'<div class="felt fz"><span class="v sone" style="color:'+Z[z]+'">'+z+'</span></div><span>/</span>'+felt(p,'fp')+'</div>'}
  return'<div class="ob app"><div class="ob-top"><span class="bebas">Øktbygger</span><span class="pil fylt">Ferdig</span></div>'+
  '<div class="ob-sek">'+ik('intervallbygger','f')+'HURTIGOPPSETT - ANTALL × DRAGTID × SONE / PAUSE</div>'+
  '<div class="hurtig"><div class="ib"><div class="cap">Gjelder hele økta</div><div class="ob-to" style="margin-top:6px"><div class="felt">Skiskyting</div><div class="felt">Skøyting</div></div>'+
  '<div class="cap" style="margin-top:10px">Drag</div>'+drag(0,'2','10:00','I3','3:00')+drag(1,'3','5:00','I4','2:00')+
  '<div class="ob-to"><div><div class="cap" style="margin-bottom:5px">Skyting i pausene</div><div class="felt fsk"><span class="v">L-S-L-S</span></div></div><div><div class="cap" style="margin-bottom:5px">Oppvarming · nedjogg</div><div class="felt fon"><span class="v">20:00 · 15:00</span></div></div></div>'+
  '<div class="ob-info a">4 serier · 2 liggende, 2 stående · 20 skudd</div></div>'+
  '<div class="ob-knapper"><div class="opprett">Opprett</div></div></div>'+
  '<div class="bygget" style="display:none"><div class="ib">'+[['2 × 10 min I3 / 3 min','0:23:00 · 4 rader · Skiskyting',0,5],['3 × 5 min I4 / 2 min','0:19:00 · 5 rader · Skiskyting',5,10]].map(function(r){return'<div class="mrad a" style="grid-template-columns:auto minmax(0,1fr) auto;margin-top:0;margin-bottom:6px"><span class="mstripe" style="width:110px;height:16px">'+OKT.slice(r[2],r[3]).map(function(b){return'<i style="flex:'+(b.e-b.s)+';background:'+blokkFarge(b)+'"></i>'}).join('')+'</span><b>'+r[0]+'<br><small style="display:block;font-weight:500">'+r[1]+'</small></b><span class="pil" style="min-height:28px">Endre</span></div>'}).join('')+'</div>'+
  '<div class="pg" style="margin-top:10px">'+planGraf(erMobil()?380:660)+'</div>'+
  '<div class="nkt a"><div><div class="k">Varighet</div><div class="t"><span class="n1">0</span><small>min</small></div></div><div><div class="k">Hovedsone</div><div class="t" style="color:#E8B93C">I3</div></div><div><div class="k">I3-tid</div><div class="t"><span class="n2">0</span><small>min</small></div></div><div><div class="k">Belastning</div><div class="t"><span class="n3">0</span><small>TSS</small></div></div><div><div class="k">Forventet</div><div class="t">7<small>/10</small></div></div></div></div></div>'},
 spill:function(S){S.steg(0,0);var t=300;
  [['[data-r="0"] .fa'],['[data-r="0"] .ft'],['[data-r="0"] .fz'],['[data-r="0"] .fp'],['[data-r="1"] .fa'],['[data-r="1"] .ft'],['[data-r="1"] .fz'],['[data-r="1"] .fp'],['.fsk',1],['.fon']].forEach(function(f,i){
   if(f[1])S.steg(1,t);S.til(f[0],t-150);S.t(t,function(){S.qa('.felt').forEach(function(x){x.classList.remove('fokus')});var e=S.q(f[0]);e.classList.add('fokus');e.querySelector('.v').classList.add('inn')});t+=(i===7?260:160)});
  S.t(t,function(){S.qa('.felt').forEach(function(x){x.classList.remove('fokus')})});S.inn('.ob-info',t);t+=300;
  S.til('.opprett',t,true,300);S.t(t+300,function(){S.q('.opprett').classList.add('trykk')});t+=450;S.steg(2,t);
  S.bort(t);S.t(t,function(){S.q('.hurtig').style.display='none';S.q('.bygget').style.display='';requestAnimationFrame(function(){S.qa('.bygget .mrad').forEach(function(e){e.classList.add('inn')})})});t+=300;
  OKT.forEach(function(b,i){S.t(t+i*80,function(){var e=S.q('.blk[data-i="'+i+'"]');if(e)e.classList.add('inn');S.qa('.lbl[data-i="'+i+'"]').forEach(function(l){l.classList.add('inn')})})});t+=OKT.length*80+200;
  S.inn('.nkt',t);S.tell('.n1',0,80,600,t);S.tell('.n2',0,20,600,t);S.tell('.n3',0,96,600,t);S.steg(3,t+700)}
});

/* ── 3 · MAL ── */
SC.push({kap:0,tittel:'LAGRE DEN SOM MAL.',tekst:'Én knapp i skjemaet. Neste gang ligger økta klar i Maler - sammen med 58 ferdige økter på Olympiatoppens skala.',
 steg:['Lagre som mal','Gi den et navn','Klar i Maler'],
 mer:['Økt-, uke- og planmaler: én økt, en hel uke eller en periode lagres med ett trykk og hentes igjen fra Maler.','58 ferdige øktmaler bygget på Olympiatoppens intensitetsskala, sortert per idrett og type.','Testmaler og standardøkter (NSSF-serien, terskeltester) ligger i samme bibliotek.','Treneren lagrer maler i sitt panel og pusher dem til én eller flere utøvere.'],varighet:9000,
 html:function(){return'<div class="mal-wrap"><div class="app skj"><div class="skj-top"><span class="strek"></span><span class="bebas">Planlegg økt</span><span class="cap" style="margin-left:auto">Tir 15. sep</span></div>'+
  '<div class="skj-tit">Terskel komb - 2 × 10 I3 + 3 × 5 I4</div>'+
  '<div class="malrad"><span class="cap">Mal</span><span class="sel">Ingen mal valgt</span><span class="malpil">Lagre som mal</span></div>'+
  '<div class="okt-str" style="height:34px;align-items:flex-end;margin:4px 0 8px">'+stripe(true)+'</div>'+
  '<div style="display:flex;justify-content:space-between;font-size:13px;color:var(--a-mut)"><span>Skiskyting · Skøyting</span><span style="color:var(--orange);font-weight:700">1:20</span></div>'+
  '<div class="dlg"><div class="bebas">Lagre som mal</div><div class="felt"><span class="v">Terskel komb 2×10 I3 + 3×5 I4</span></div><span class="pil fylt dlg-lagre" style="width:100%;justify-content:center">'+ik('bokmerke','s')+'Lagre</span></div></div>'+
  '<div class="app maler"><div class="maler-hd"><span class="strek"></span><span class="bebas">Maler</span><span class="cap" style="margin-left:auto">Mine øktmaler</span></div><div class="mliste">'+
  '<div class="mrad ny" style="display:none"><b>Terskel komb 2×10 I3 + 3×5 I4</b><span class="ny-chip">NY</span><small><span class="mstripe">'+stripe()+'</span>1:20 · Skiskyting</small></div>'+
  [['Rolig langtur 90 min',[['I1',90]],'1:30 · Løping'],['I4 5 × 6 min / 2 min',[['I1',20],['I4',6],['P',2],['I4',6],['P',2],['I4',6],['P',2],['I4',6],['P',2],['I4',6],['I1',15]],'1:13 · Rulleski'],['Komb hard 4 × 5 min',[['I1',20],['I4',5],['P',3],['I4',5],['P',3],['I4',5],['P',3],['I4',5],['I1',15]],'1:04 · Skiskyting']].map(function(m){
   return'<div class="mrad"><b>'+m[0]+'</b><span></span><small><span class="mstripe">'+m[1].map(function(z){return'<i style="flex:'+z[1]+';background:'+(z[0]==='P'?'#43434B':Z[z[0]])+'"></i>'}).join('')+'</span>'+m[2]+'</small></div>'}).join('')+'</div></div>'+
  '<div class="toast">'+ik('fullfort','s')+'Lagret som mal</div></div>'},
 spill:function(S){S.steg(0,0);S.til('.malpil',500,true);S.t(1250,function(){S.q('.malpil').classList.add('trykk')});
  S.steg(1,1600);S.t(1600,function(){S.q('.malpil').classList.remove('trykk');S.q('.dlg').classList.add('inn')});S.t(2300,function(){S.q('.dlg .v').classList.add('inn')});
  S.til('.dlg-lagre',2900,true);S.t(3650,function(){S.q('.dlg-lagre').classList.add('trykk')});
  S.t(4000,function(){S.q('.dlg').classList.remove('inn');S.q('.toast').classList.add('inn')});S.bort(4000);
  S.steg(2,4400);S.t(4600,function(){var n=S.q('.mrad.ny');n.style.display='';n.animate([{opacity:0,transform:'translateY(-10px)'},{opacity:1,transform:'none'}],{duration:500,easing:'ease-out'})});
  S.t(6800,function(){S.q('.toast').classList.remove('inn')});S.steg(3,7200)}
});

/* ── 4 · LIVE STYRKE (bolk 8, 17. sep - fasit er components/workout/LiveSessionView.tsx, ikke designfila) ── */
function fmtTid(s){s=Math.max(0,Math.floor(s));return Math.floor(s/60)+':'+('0'+s%60).slice(-2)}
SC.push({kap:1,tittel:'LØFT MED ÉN HÅND.',tekst:'Live styrke er laget for hansker og tommel: store trinnknapper - eller trykk på tallet og skriv. Forrige økt i grått, totaltid og pause stort i toppen, og nye rekorder står klare når økta er ferdig.',
 steg:['Trinn, eller trykk tallet og skriv','Pausen teller opp til neste sett','Ferdig: form, kommentar, rekorder'],
 mer:['Start live fra en planlagt styrkeøkt eller rett fra +-knappen. Øvelsene kommer ferdig fra malen - dra dem i håndtaket, koble to med «Supersett», legg til et supersett i ett trykk.','Reps og kg med store trinnknapper, eller trykk på tallet og skriv 102,5 rett inn. Et nytt sett arver settet over; forrige økt står i grått som referanse.','Totaltid står stort og klebrig i toppen. Etter «Logg sett» teller pausen opp - «Start» på neste sett stanser den. Pausen er med i totaltida, stoppet tid er det ikke.','Ferdig-skjermen: totaltid, pause i alt, kommentar til økta, fysisk og mental form, og nye rekorder (est. 1RM etter Epley, maks reps ved vekt). «Lagre i dagboka» skriver alt inn på økta.'],varighet:13500,
 html:function(){function rad(n,r,kg,rpe,ferdig,pr){return'<div class="lv-r '+(ferdig?'ferdig':'')+'" data-s="'+n+'"><span class="lv-n">'+(ferdig?'✓':n)+'</span><span class="lv-f '+(ferdig?'fort':'spok')+' fr">'+r+'</span><span class="lv-f '+(ferdig?'fort':'spok')+' fk">'+kg+(pr?'<small>PR</small>':'')+'</span><span class="lv-rpe">'+rpe+'</span><span class="lv-k '+(ferdig?'ferdig':'')+'">'+(ferdig?'✓':'Start')+'</span></div>'}
  function kort(nr,navn,under,chips,rader,ss){return'<div class="lv-ov'+(ss?' ss':'')+'"><header>'+ik('flytt','s','width:16px;height:16px;color:var(--a-mute)')+'<span class="lv-nr">'+(ss?'SS A':nr)+'</span><span class="lv-navn"><b>'+navn+'</b><span>'+under+'</span></span><span class="lv-ikon">'+ik('notat','s','width:16px;height:16px')+'</span><span class="lv-hnd">⋯</span></header>'+chips+'<div class="lv-sett">'+rader+'</div><div class="lv-fot"><span class="lv-pill dash">+ Legg til sett</span><span class="lv-pill">'+(ss?'Løs opp':'Supersett')+'</span></div></div>'}
  function teller(tid,merke,sett,ekstra){return'<div class="lv-teller"><div><div class="lv-tid'+(merke?' dempet':'')+'">'+tid+'</div><div class="lv-etk">Totaltid'+(merke?'<span class="lv-merke">'+merke+'</span>':'')+'<span>· '+sett+'</span></div>'+(ekstra||'')+'</div><div class="lv-pause"><svg width="30" height="30" viewBox="0 0 42 42"><circle cx="21" cy="21" r="18" fill="none" stroke="var(--a-line2)" stroke-width="4"/><circle class="lv-ring" cx="21" cy="21" r="18" fill="none" stroke="#FF4500" stroke-width="4" stroke-linecap="round" stroke-dasharray="113" stroke-dashoffset="113" transform="rotate(-90 21 21)" style="transition:stroke-dashoffset .3s linear"/></svg><div><div class="lv-pt">0:00</div><div class="lv-pl">Pause · Markløft sett 1</div></div></div></div>'}
  return'<div class="ls-wrap"><div class="lv-ramme"><div class="lv-skala"><div class="lv">'+
  '<div class="lv-sl"><span>09:41</span><span>100 %</span></div>'+
  '<div class="lv-bar topp"><div class="lv-rad1"><span class="lv-x">×</span><span class="lv-tit">Live styrke</span><span class="lv-ikon">'+ik('notat','f','width:16px;height:16px')+'<i class="prikk"></i></span><span class="lv-pill">Stopp</span></div>'+teller('24:18','','<b class="lv-antall">4</b> av 12 sett')+'</div>'+
  '<div class="lv-inn">'+
  kort(1,'Knebøy','3 sett · 8 / 8 / <i class="lv-tre">-</i>','<div class="lv-chips"><span class="lv-chip beste">★ Beste <b>8 × 100 kg</b></span><span class="lv-chip plan">Plan <b>3 × 8 × 100</b></span></div><div class="lv-notat">gikk tungt i dag</div>',rad(1,8,100,8,1,1)+rad(2,8,100,9,1)+rad(3,8,100,'-',0))+
  kort(2,'Markløft','3 sett · - / - / -','',rad(1,6,120,'-',0))+
  '<span class="lv-pill dash lv-ss">+ Legg til supersett</span></div>'+
  '<div class="lv-tast"><div class="lv-hvem"><b>Knebøy · sett 3</b><span class="lv-ditt">Ditt tall</span></div>'+
  '<div class="lv-step"><span class="lv-b">−</span><div class="lv-v"><em class="vr">8</em><i>reps</i></div><span class="lv-b">+</span></div>'+
  '<div class="lv-step"><span class="lv-b lv-minus">−2,5</span><div class="lv-v lv-vk"><em class="vk2">100</em><i>kg</i></div><span class="lv-b lv-pluss">+2,5</span></div>'+
  '<div class="lv-pr"><span class="lv-pill lv-rpe8">RPE <b class="rpev">-</b></span><span class="lv-pill">Lukk</span></div>'+
  '<span class="lv-logg">✓ Logg sett</span></div>'+
  '<div class="lv-ferdig"><div class="lv-sl"><span>10:29</span><span>98 %</span></div><div class="lv-bar topp"><div class="lv-rad1"><span class="lv-x">‹</span><span class="lv-tit">Økta er ferdig</span></div>'+teller('48:12','Avsluttet','12 av 12 sett','<div class="lv-linje">Pause i alt: 14:20 (med i totaltida)</div><div class="lv-linje">Stoppet: 2:05 (ikke med)</div>')+'</div>'+
  '<div class="lv-inn"><div class="lv-kort"><h4>Nøkkeltall</h4><div class="lv-nk"><div><div class="bebas">7 840</div><small>kg tonnasje</small></div><div><div class="bebas">12</div><small>sett · 4 øvelser</small></div><div><div class="bebas" style="color:#D4A017">2</div><small>nye PR-er</small></div></div></div>'+
  '<div class="lv-kort"><h4>Nye rekorder</h4><div class="lv-rek"><span class="lv-chip beste">★</span><div><b>Knebøy</b><small>8 × 102,5 kg · est. 1RM 130 kg (før 127)</small></div></div><div class="lv-rek"><span class="lv-chip beste">★</span><div><b>Markløft</b><small>Maks reps ved 120 kg: 6 (før 5)</small></div></div></div>'+
  '<div class="lv-kort"><h4>Kommentar og form</h4><div class="lv-notat felt">Bra økt - tungt på markløft</div><div class="lv-form"><div><small>Fysisk form</small><span class="lv-stj"><i class="on"></i><i class="on"></i><i class="on"></i><i class="on"></i><i></i></span></div><div><small>Mental form</small><span class="lv-stj"><i class="on"></i><i class="on"></i><i class="on"></i><i></i><i></i></span></div></div></div>'+
  '<span class="lv-logg lv-lagre">Lagre i dagboka</span><div class="lv-pr" style="margin-top:9px"><span class="lv-pill">Se plan mot faktisk</span><span class="lv-pill">Utvikling</span></div></div></div>'+
  '</div></div></div>'+
  '<div class="app dbk pop"><div class="cap">Dagboka · ons 16. sep</div><div class="dbk-kort"><b>Styrke basis <span>48 min</span></b><small>Styrke · 12 sett · 7 840 kg · 2 PR · ★★★★☆ / ★★★☆☆</small></div>'+
  [['Knebøy','3 × 8 · 100-102,5 kg ★'],['Markløft','3 × 6 · 120 kg ★'],['Utfall','3 × 8 · 24 kg'],['Pullups','3 × 8']].map(function(r){return'<div class="dbk-rad"><span>'+r[0]+'</span><b>'+r[1]+'</b></div>'}).join('')+'<div class="dbk-rad"><span>Notat</span><b>Bra økt - tungt på markløft</b></div></div></div>'},
 spill:function(S){S.steg(0,0);
  /* totaltida går hele tida */
  for(var k=1;k<=26;k++)(function(k){S.t(k*500,function(){var t=S.q('.lv:not(.lv-ferdig) .lv-tid');if(t)t.textContent=fmtTid(24*60+18+k*0.5|0)})})(k);
  /* Start på sett 3: tastaturet åpner med settet over som startverdi (arv) */
  S.til('[data-s="3"] .lv-k',300,true);S.t(1050,function(){var r=S.q('[data-s="3"]');r.classList.add('aktiv');r.querySelector('.lv-k').textContent='Logg';S.q('.lv-tast').classList.add('aktiv')});
  /* trykk på tallet -> tastefelt, skriv 102,5 */
  S.til('.lv-vk',1500,true);S.t(2250,function(){var v=S.q('.lv-vk');v.classList.add('felt');S.q('.vk2').textContent='100'});
  S.t(2750,function(){S.q('.vk2').textContent='10'});S.t(2950,function(){S.q('.vk2').textContent='102'});S.t(3150,function(){S.q('.vk2').textContent='102,'});S.t(3350,function(){S.q('.vk2').textContent='102,5';S.q('[data-s="3"] .fk').textContent='102,5'});
  S.t(3900,function(){S.q('.lv-vk').classList.remove('felt')});
  S.til('.lv-rpe8',4100,true);S.t(4850,function(){S.q('.rpev').textContent='8';S.q('[data-s="3"] .lv-rpe').textContent='8'});
  /* Logg sett -> ført med PR, pausen teller OPP */
  S.til('.lv-tast .lv-logg',5100,true);S.t(5850,function(){S.q('.lv-tast .lv-logg').classList.add('trykk')});
  S.t(6050,function(){var r=S.q('[data-s="3"]');r.className='lv-r ferdig';r.innerHTML='<span class="lv-n">✓</span><span class="lv-f fort">8</span><span class="lv-f fort">102,5<small>PR</small></span><span class="lv-rpe">8</span><span class="lv-k ferdig">✓</span>';
   S.q('.lv-tast').classList.remove('aktiv');S.q('.lv-tast .lv-logg').classList.remove('trykk');S.q('.lv-antall').textContent='5';S.q('.lv-tre').textContent='8';
   S.q('.lv:not(.lv-ferdig) .lv-pause').classList.add('vis')});
  S.steg(1,6300);
  for(var j=1;j<=8;j++)(function(j){S.t(6050+j*400,function(){var p=S.q('.lv:not(.lv-ferdig) .lv-pt');if(p)p.textContent=fmtTid(j);var r=S.q('.lv:not(.lv-ferdig) .lv-ring');if(r)r.style.strokeDashoffset=113-113*j/90})})(j);
  /* Start på Markløft sett 1 stanser pausen */
  S.til('.lv-ov:nth-of-type(2) [data-s="1"] .lv-k',8600,true);S.t(9350,function(){S.q('.lv:not(.lv-ferdig) .lv-pause').classList.remove('vis');var r=S.q('.lv-ov:nth-of-type(2) [data-s="1"]');r.classList.add('aktiv');r.querySelector('.lv-k').textContent='Logg';S.q('.lv-tast').classList.add('aktiv');S.q('.lv-hvem b').textContent='Markløft · sett 1';S.q('.lv-ditt').textContent='Grått = forrige økt';S.q('.vr').textContent='6';S.q('.vr').classList.add('spok');S.q('.vk2').textContent='120';S.q('.vk2').classList.add('spok')});
  /* ferdig-skjermen */
  S.steg(2,10300);S.bort(10300);S.t(10300,function(){S.q('.lv-ferdig').classList.add('inn')});
  S.til('.lv-lagre',11000,true);S.t(11750,function(){S.q('.lv-lagre').classList.add('trykk')});S.inn('.dbk',12100);S.bort(12300);S.steg(3,12700)}
});

/* ── 5 · HELSE ── */
var HRV=[57,60,55,58,62,59,54,52,56,60,63,61,58,55,53,57,60,62,64,61,58,56,59,62,60,57,59,61,63,62];
var HVP=[50,49,52,50,48,49,53,54,51,50,48,48,50,52,53,51,49,48,47,49,51,52,50,48,49,51,50,49,48,48];
function linjeSti(a,min,max,W,H){return a.map(function(v,i){return(i?'L':'M')+(i/(a.length-1)*W).toFixed(1)+' '+(H-(v-min)/(max-min)*H).toFixed(1)}).join('')}
SC.push({kap:1,tittel:'FORMEN KOMMER INN OM NATTA.',tekst:'Søvn, hvilepuls og HRV fra klokka, uten å taste. Hardøktene ligger på samme akse, så du ser hva belastningen gjør med deg. Alt kan også føres manuelt.',
 steg:['Søvn og hvilepuls','HRV mot snittet','Hardøktene på aksen'],
 mer:['Søvn med faser, hvilepuls, natt-HRV og skritt hentes hver natt fra Garmin, COROS og Polar - alt kan også føres manuelt, og det du fører selv vinner.','HRV vises mot 7-dagerssnittet, hvilepuls mot ditt eget snitt; sykdom og skade føres som dagstatus og legges på samme akse.','Helsedata er dine: treneren ser dem bare når du har slått på deling, per trener.','Kalorier hentes bevisst ikke - estimatene spriker for mye mellom merker.'],varighet:9500,
 html:function(){var W=320,H=96,snH=H-(58-44)/(70-44)*H,snP=H-(50-44)/(58-44)*H;
  return'<div class="app hk"><div class="hk-hd"><span class="strek"></span>HELSE<span class="kl">'+ik('klokke','s')+'i natt</span><span class="apn">åpne '+ik('apne-fane','s')+'</span></div>'+
  '<div class="hk-grid"><div><div class="cap">Hvilepuls</div><div class="tall h1">0</div><div class="und">snitt 50</div></div><div><div class="cap">HRV</div><div class="tall h2">0</div><div class="und">snitt 58</div></div><div><div class="cap">Søvn</div><div class="tall h3">0:00</div><div class="und">score 84</div></div><div><div class="cap">Følelse</div><div class="tall">4<small>/5</small></div><div class="und">ført</div></div></div>'+
  '<div class="hk-sovn"><div class="sstripe"><i data-f="96" style="background:#1A6FD4"></i><i data-f="238" style="background:#38BDF8"></i><i data-f="104" style="background:#8B5CF6"></i><i data-f="14" style="background:#E8B93C"></i></div><div class="sleg"><span style="--c:#1A6FD4">Dyp 1:36</span><span style="--c:#38BDF8">Lett 3:58</span><span style="--c:#8B5CF6">REM 1:44</span><span style="--c:#E8B93C">Våken 0:14</span></div></div>'+
  '<div class="hk-graf"><div class="cap" style="font-size:10.5px">HRV og hvilepuls · 30 dager</div><div class="hk-leg"><span><i style="background:#1A6FD4"></i>HRV snitt <b style="color:var(--a-ink)">58</b></span><span><i style="background:#E23A5A"></i>Hvilepuls snitt <b style="color:var(--a-ink)">50</b></span></div>'+
  '<div class="klipp" style="clip-path:inset(0 100% 0 0);transition:clip-path 1.8s cubic-bezier(.4,.1,.2,1);margin-top:8px"><svg viewBox="0 0 '+W+' '+(H+14)+'" preserveAspectRatio="none"><path d="'+linjeSti(HRV,44,70,W,H)+'L'+W+' '+H+'L0 '+H+'Z" fill="#1A6FD4" opacity=".12"/><path d="'+linjeSti(HRV,44,70,W,H)+'" fill="none" stroke="#1A6FD4" stroke-width="1.8"/><path d="'+linjeSti(HVP,44,58,W,H)+'" fill="none" stroke="#E23A5A" stroke-width="1.8"/>'+
  '<line x1="0" x2="'+W+'" y1="'+snH+'" y2="'+snH+'" stroke="#1A6FD4" stroke-dasharray="4 3" opacity=".6"/><line x1="0" x2="'+W+'" y1="'+snP+'" y2="'+snP+'" stroke="#E23A5A" stroke-dasharray="4 3" opacity=".6"/>'+
  [3,7,10,14,17,21,24,28].map(function(d){return'<rect class="skudd hm" x="'+(d/29*W-2)+'" y="'+(H+5)+'" width="4" height="5" fill="#E8B93C"/>'}).join('')+
  '<circle cx="'+W+'" cy="'+(H-(62-44)/26*H)+'" r="3.2" fill="#1A6FD4" stroke="var(--a-card2)" stroke-width="1.5"/></svg></div>'+
  '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--a-mute);margin-top:2px"><span>17. aug</span><span>i dag</span></div></div>'+
  '<div class="hk-fot"><span class="logg">+ LOGG HELSE</span><span class="vis">VIS MER '+ik('apne-fane','s')+'</span></div></div>'},
 spill:function(S){S.steg(0,0);S.tell('.h1',70,48,1100,500);S.tell('.h3',0,452,1100,500,function(v){v=Math.round(v);return Math.floor(v/60)+':'+('0'+v%60).slice(-2)});
  S.t(1100,function(){S.qa('.sstripe i').forEach(function(i){i.style.flexBasis=(i.dataset.f/452*100)+'%'})});
  S.steg(1,2800);S.tell('.h2',30,62,1100,2800);S.t(3200,function(){S.q('.klipp').style.clipPath='inset(0 0 0 0)'});
  S.steg(2,5400);S.qa?S.t(5400,function(){S.qa('.hm').forEach(function(e,i){setTimeout(function(){e.classList.add('inn')},i*110)})}):0;S.steg(3,7400)}
});

/* ── 6 · KLOKKESYNK ── */
var MERKER=[['Garmin','G','var(--a-ink)',1,'Tilkoblet · synk automatisk · 6 t siden'],['Polar','P','#FF4500',0,'Tilkoblet · synk automatisk · i går'],['Strava','S','#FC5200',0,'Ikke tilkoblet'],['COROS','C','var(--a-ink)',1,'Ikke tilkoblet'],['Wahoo','W','var(--a-ink)',1,'Ikke tilkoblet'],['Zepp','Z','var(--a-ink)',1,'Ikke tilkoblet']];
SC.push({kap:2,tittel:'ØKTA KOMMER INN AV SEG SELV.',tekst:'Garmin, COROS, Wahoo og Zepp (beta), Polar og Strava - og .fit fra alle merker. Flett klokkeøkta med planen, så står plan og gjennomført i samme dagbok.',
 steg:['Klokka synker','Økta lander på planen','Flett med ett trykk'],
 mer:['Direktesynk for Garmin, COROS, Wahoo og Zepp (beta) via klokkesynk-leverandøren, pluss Strava og Polar. .fit-import for alle merker, også Suunto.','Pulskurve, runder, fart, høyde, watt og kadens følger økta inn; sonene regnes fra dine egne terskler.','Fletting: klokkeøkta legges på den planlagte økta med ett trykk, så plan og gjennomført står i samme rad - og kan skilles igjen.','Stillestand fra klokka kan gjøres om til pauser, med angre.'],varighet:11000,
 html:function(){return'<div class="sy-wrap"><div class="app" style="padding:10px">'+
  '<div class="glass"><span class="logo"><svg viewBox="0 0 24 24"><path d="M5 4l14 16M19 4L5 20" stroke="var(--a-ink)" stroke-width="3.2" stroke-linecap="round"/><path d="M5 20l4.2-4.8" stroke="#FF4500" stroke-width="3.2" stroke-linecap="round"/></svg>PULSE</span><span class="synkk">'+ik('synk','s')+'SYNK<i class="dot"></i></span><span class="avatar">O</span></div>'+
  '<div class="ark"><div class="over">KLOKKESYNK</div><div class="bebas">Synk</div><div class="sist">Sist synket 6 t siden</div>'+
  MERKER.map(function(m,i){var fl=m[2]==='var(--a-ink)'?'background:var(--a-ink);color:var(--a-flate)':'background:'+m[2];var tilk=m[4].indexOf('Tilkoblet')===0;
   return'<div class="mrk '+(i>1?'skjul-m':'')+'" data-m="'+i+'"><span class="fl" style="'+fl+'">'+m[1]+'</span><div><div class="nv">'+m[0]+(m[3]?'<span class="beta">BETA</span>':'')+'</div><div class="st '+(tilk?'':'graa')+'">'+m[4]+'</div></div><span class="hy">'+(tilk?ik('fullfort','s'):'<span style="font-size:11px;font-weight:700;letter-spacing:.1em;color:var(--orange)">KOBLE TIL</span>')+'</span></div>'}).join('')+
  '<div class="hentet a">'+ik('neste','s','width:13px;height:13px')+'<b>1 ny økt</b> hentet i dag</div></div></div>'+
  '<div class="app uk"><div class="uk-hd"><span class="bebas">Tir 15. sep</span><span class="cap">Uke 38 · plan</span></div>'+
  '<div class="okt"><div class="okt-t"><span class="hake">'+ik('fullfort','s')+'</span><span>2 × 10 min I3 / 3 min + 3 × 5 min I4 / 2 min</span><span class="dur">1:20</span></div><div class="okt-str">'+stripe()+'</div>'+
  '<small><span>Skøyting · Skiskyting</span><span class="kchip pop">'+ik('klokke','s')+'GARMIN</span><span class="kinfo a">snittpuls 149 · 21,4 km · 18/20</span></small></div>'+
  '<div class="flett-rad a"><span class="malpil flett">'+ik('koble-flett','s')+'Flett med planen</span></div>'+
  '<div class="sammen a"><div class="cap" style="margin-bottom:2px">Aktiviteter · runder fra klokka</div>'+
  [['#28A86E','Oppvarming','20:12 · 128','plan 20 min'],['#E8B93C','2 × 10 min I3','10:04 · 10:11 · 163','plan 2 × 10'],['#43434B','Skyting L · S · L · S','18/20 · 27,9 s','i pausene'],['#FF8C00','3 × 5 min I4','5:02 · 4:58 · 5:04 · 176','plan 3 × 5'],['#28A86E','Nedjogg','15:40 · 131','plan 15 min']].map(function(r){return'<div class="r"><i style="background:'+r[0]+'"></i><span><b>'+r[1]+'</b> · '+r[2]+'</span><em>'+r[3]+' ✓</em></div>'}).join('')+'</div></div></div>'},
 spill:function(S){S.steg(0,0);S.til('.synkk',400,true);S.t(1150,function(){var k=S.q('.synkk');k.classList.add('trykk','spinn');setTimeout(function(){k.classList.remove('trykk')},160);var st=S.q('[data-m="0"] .st');st.textContent='Synker…';st.classList.add('graa')});
  S.t(2800,function(){S.q('.synkk').classList.remove('spinn');S.q('.synkk .dot').classList.add('inn');var st=S.q('[data-m="0"] .st');st.textContent='Tilkoblet · synk automatisk · nettopp';st.classList.remove('graa');S.q('.ark .sist').textContent='Sist synket nettopp';S.q('.hentet').classList.add('inn')});
  S.bort(3000);S.steg(1,3400);S.inn('.kchip',3500);S.inn('.kinfo',3900);S.inn('.flett-rad',4600);
  S.steg(2,5200);S.til('.flett',5200,true);S.t(5950,function(){S.q('.flett').classList.add('trykk')});
  S.t(6300,function(){var f=S.q('.flett');f.classList.remove('trykk');f.className='gronn-chip';f.innerHTML=ik('fullfort','s')+'Flettet med planen';S.q('.okt').classList.add('ferdig');S.q('.sammen').classList.add('inn')});S.bort(6400);S.steg(3,8200)}
});

/* ── 7 · ØKT-GRAFEN (WorkoutDetailChart.tsx + OktKurve.tsx + CommentSection.tsx) ── */
function kurveSti(W,H){var min=90,max=190;return PULS.map(function(p,i){return(i?'L':'M')+(p[0]/TOT*W).toFixed(1)+' '+(H-(p[1]-min)/(max-min)*H).toFixed(1)}).join('')}
/* Høyde (runde på ~2,5 km med to bakker) og tempo (min/km) - fiktive, samme tidsakse */
var HOYDE_S=PULS.map(function(p){var m=p[0];return 612+20*Math.sin(m/7.5*Math.PI*2)+4*Math.sin(m/2.3*Math.PI*2+1)});
var TEMPO_S=PULS.map(function(p){var m=p[0],b=OKT.filter(function(x){return m>=x.s&&m<x.e})[0]||OKT[OKT.length-1];var base=b.t==='sky'?9.5:(b.t==='drag'?(b.z==='I4'?3.05:3.35):4.2);return base+(HOYDE_S[Math.round(m/.25)]-612)*.006});
SC.push({kap:3,tittel:'FØR DET KLOKKA IKKE VET.',tekst:'Skyting, laktat, ernæring og notater havner rett på kurven, der det skjedde. Velg puls, tempo, watt, kadens eller høyde - og treneren svarer rett på økta.',
 steg:['Pulsen over planen og høyden','Skyting, laktat, ernæring og tempo','Notat og svar fra treneren'],
 mer:['Kurver: puls, tempo, watt, kadens og høyde - velg dem du vil se, planen ligger bak som spøkelse.','Skyting plottes skudd for skudd med vind og sikt, laktat og ernæring settes på tidspunktet det skjedde, notater rett på kurven.','Detaljraden under grafen: opplevd belastning, laktat, ernæring og runder, alt på samme økt.','Kommentarer på økta: utøver oransje, trener blå, med varsel til den andre.'],varighet:14000,
 html:function(){
  /* Tegnes av den felles oktgraf-tegneren (oktgraf.js) - samme design som
     dagpopupen og ukekortet i #inside og trener-scene 2. */
  return tegnOktgraf({blokker:OKT,tot:TOT,pulsVed:pulsVed,punkter:PUNKT,hoyde:HOYDE_S,tempo:TEMPO_S,mob:erMobil(),tittel:'ØKT-GRAF',kilde:'Tir 15. sep · Garmin',
   kom:'<div class="kom a"><div class="kom-h"><span></span>KOMMENTARER (<b class="kom-n">1</b>)</div>'+
    '<div class="kom-li" style="border-left-color:#FF4500"><div class="kom-t"><span style="color:#FF4500">Utøver · Ola</span><em>i går 18:12</em></div><p>Tung i beina på siste drag, og måtte kjempe inn skuddene på skyting 4.</p></div>'+
    '<div class="kom-skriver">Trener skriver…</div>'+
    '<div class="kom-li kom-tr" style="border-left-color:#1A6FD4"><div class="kom-t"><span style="color:#1A6FD4">Trener · Kari</span><em>i dag 07:40</em></div><p>Bra kontroll på pulsen inn. Neste gang: roligere første to minutter av I4-dragene.</p></div></div>'})},
 spill:function(S){function trykk(sel){var k=S.q(sel);if(!k)return;k.classList.add('trykk');setTimeout(function(){k.classList.remove('trykk')},250)}
  S.steg(0,0);S.inn('.ghost',300);S.t(700,function(){S.q('.klipp').style.clipPath='inset(0 0 0 0)'});S.inn('.segb',2300);
  S.til('.c-hoy',2500,true,400);S.t(2900,function(){S.q('.c-hoy').classList.add('on');S.q('.hoy').style.opacity=1});
  S.til('.c-tem',7900,true,400);S.t(8300,function(){S.q('.c-tem').classList.add('on');S.q('.tem').style.opacity=1});
  S.steg(1,3700);S.til('.k-plott',3700,true,450);S.t(4150,function(){trykk('.k-plott');S.q('.c-sky').classList.add('on')});S.inn('.skyv',4250);
  S.t(4400,function(){S.qa('.pille[data-g="sky"]').forEach(function(e,i){setTimeout(function(){e.classList.add('inn')},i*200)})});
  S.til('.k-lak',5500,true,450);S.t(5950,function(){trykk('.k-lak');S.q('.c-lak').classList.add('on')});
  S.t(6100,function(){S.qa('.pille[data-g="lak"]').forEach(function(e,i){setTimeout(function(){e.classList.add('inn')},i*250)})});
  S.t(6900,function(){S.q('.c-ern').classList.add('on');S.q('.pille[data-g="ern"]').classList.add('inn')});
  S.steg(2,9000);S.til('.k-not',9000,true,450);S.t(9450,function(){trykk('.k-not');S.q('.c-not').classList.add('on');S.q('.pille[data-g="not"]').classList.add('inn')});
  S.inn('.kom',10000);S.bort(10100);S.t(10800,function(){S.q('.kom-skriver').classList.add('inn')});
  S.t(11900,function(){S.q('.kom-skriver').classList.remove('inn');S.q('.kom-tr').classList.add('inn');S.q('.kom-n').textContent='2'});S.steg(3,13000)}
});

/* ── 8 · PLOTT TREFF ── */
function vimpelSvg(r,l,sz){var flag=l<=0?'<path d="M30,14 C33,22 29,34 32,48 L37,47 C39,33 36,22 37,14 Z" fill="#E23A5A"/>':(l>=5?'<path d="M32,10 c8,-3 13,3 21,0 c8,-3 13,3 21,0 l0,13 c-8,3 -13,-3 -21,0 c-8,3 -13,-3 -21,0 Z" fill="#E23A5A"/>':'<g transform="rotate('+(-{1:15,2:35,3:55,4:75}[l])+' 32 14)"><rect x="26" y="14" width="13" height="40" rx="1.5" fill="#E23A5A"/></g>');
 var inner='<line x1="32" y1="12" x2="32" y2="84" stroke="var(--a-mute)" stroke-width="3.5" stroke-linecap="round"/><circle cx="32" cy="10" r="3.5" fill="var(--a-mut)"/>'+flag;
 return'<svg width="'+sz+'" height="'+sz+'" viewBox="0 0 92 92">'+(r==='V'?'<g transform="translate(92 0) scale(-1 1)">'+inner+'</g>':inner)+'</svg>'}
function taakeSvg(f){if(!f)return'<svg width="18" height="14" viewBox="0 0 18 14"><circle cx="9" cy="7" r="5" fill="none" stroke="#28A86E" stroke-width="2"/></svg>';var s='';for(var i=0;i<f;i++)s+='<path d="M2,'+(3+i*4)+' c3,-2 6,2 9,0 c2,-1 4,1 5,0" stroke="var(--a-mut)" stroke-width="1.8" fill="none" stroke-linecap="round" opacity="'+(.5+.17*i)+'"/>';return'<svg width="18" height="14" viewBox="0 0 18 14">'+s+'</svg>'}

var SERIER=[{ls:'L',navn:'LIGGENDE',gc:'#38BDF8',sc:'#1A6FD4',plass:'30:00-33:00',vind:['H',2,'H2',0,'God sikt'],skudd:[[.02,-.04],[-.06,.03],[.05,.05],[.01,.08],[-.03,-.07]],tid:'27,9',puls:164,treff:5},
 {ls:'S',navn:'STÅENDE',gc:'#FF4500',sc:'#E23A5A',plass:'43:00-46:00',vind:['V',1,'V1',1,'Lett tåke'],skudd:[[.18,-.12],[-.22,.1],[.61,.2],[.05,.24],[-.15,-.2]],tid:'29,0',puls:158,treff:4}];
function blinkSvg(ser,i){var s=ser.skudd[i];return'<svg viewBox="0 0 62 62"><circle class="skive" cx="31" cy="31" r="26" fill="#F2F2F0" stroke="var(--a-line2)" stroke-width="2" style="transition:fill .4s"/>'+(ser.ls==='L'?'<circle cx="31" cy="31" r="12" fill="none" stroke="#8A8A96" stroke-width="1" stroke-dasharray="4 3"/>':'')+
 '<g class="skudd"><circle cx="'+(31+s[0]*52)+'" cy="'+(31+s[1]*52)+'" r="8" fill="'+ser.sc+'" stroke="#0A0A0B" stroke-width="1"/><text x="'+(31+s[0]*52)+'" y="'+(31+s[1]*52+3.3)+'" text-anchor="middle" font-family="Barlow Condensed" font-weight="700" font-size="9.5" fill="#fff">'+(i+1)+'</text></g></svg>'}
/* Scene «Plott hvert skudd» er flyttet til «Detaljene som avgjør» (16. sep). */

/* ── 9 · FORMKARTET (design/xpulse-formkart-design.html - utkastet, ikke bygget ennå) ── */
var FK=(function(){var seed=11;function r(){seed=(seed*9301+49297)%233280;return seed/233280}var d=[],ctl=52,atl=50;
 for(var i=0;i<60;i++){var hvile=(i%7===6),syk=i>=33&&i<=37,konk=i===56,uke=Math.floor(i/7);var hard=!hvile&&!syk&&(i%7===1||i%7===3||(i%7===5&&uke%2===0));
  var t=hvile||syk?0:(konk?1.1:(hard?1.5+r()*.6:0.8+r()*.9));if(i%7===5&&!hard&&!syk)t=2.2+r()*.6;if(i>=49&&i<56)t*=.45;
  var z=t?{I1:t*(hard?.45:.8),I2:t*(hard?.18:.17),I3:hard?t*.2:t*.03,I4:hard?t*.12:0,I5:hard||konk?t*.05:0}:null;if(konk)z={I1:.55,I2:.1,I3:.1,I4:.2,I5:.15};
  var tss=t*(hard?85:52);ctl+=(tss-ctl)/42*2.2;atl+=(tss-atl)/7*1.6;
  var hrv=syk?-16+r()*3:(hard?-2:3)+(r()-.5)*5-(atl-ctl)*.2,hvp=syk?12+r()*3:(r()-.5)*4+(atl-ctl)*.12;
  d.push({hvile:hvile,syk:syk,konk:konk,hard:hard,t:t,z:z,ctl:ctl,atl:atl,tsb:ctl-atl,hrv:hrv,hvp:hvp,fol:syk?3:Math.round(6+(ctl-atl)/12+(r()-.5)*2)})}for(var j=0;j<d.length;j++){var a0=d[Math.max(0,j-1)],a2=d[Math.min(d.length-1,j+1)];d[j].hrvS=(a0.hrv+d[j].hrv+a2.hrv)/3;d[j].hvpS=(a0.hvp+d[j].hvp+a2.hvp)/3}return d})();
SC.push({kap:4,tittel:'SE HELE FORMEN PÅ ÉN AKSE.',tekst:'Sonetid per dag, form og tretthet, HRV, hvilepuls og følelse i baner på samme tidsakse. Du ser hva uka gjorde med deg - og når formen faktisk kom.',
 steg:['Sonetid per dag','Form og tretthet','Restitusjon og følelse'],
 mer:['Baner på én tidsakse: sonetid per dag (I1-I5), form (CTL), tretthet (ATL) og formbalanse (TSB), HRV og hvilepuls, følelse.','30, 60 eller 180 dager; sykdom, skade og konkurranser merkes i dagraden så du ser dem mot belastningen.','Hold over en dag for økta, formen, HRV mot snittet og følelsen samlet.','Sammenligner alltid med dine egne snitt - aldri med andres.'],varighet:11500,
 html:function(){var mob=erMobil(),D=mob?FK.slice(30):FK,n=D.length,W=1000,bw=W/n;
  function bane(navn,h,inner,kl){return'<div class="fkb '+(kl||'')+'"><div class="fkb-n">'+navn+'</div><div class="fkb-g" style="height:'+h+'px"><svg viewBox="0 0 '+W+' '+h+'" preserveAspectRatio="none">'+inner+'</svg></div></div>'}
  var dagen=D.map(function(x,i){var f=x.syk?'#E11D48':x.konk?'#D4A017':x.hvile?'var(--a-card2)':'#3A3A44';return'<rect x="'+(i*bw+bw*.12)+'" y="0" width="'+(bw*.76)+'" height="16" rx="2" fill="'+f+'" '+(x.hvile?'stroke="var(--a-line2)" vector-effect="non-scaling-stroke"':'')+'/>'}).join('');
  var SH=mob?70:96,maxT=3.2,sone='';D.forEach(function(x,i){if(!x.z)return;var y=SH;['I1','I2','I3','I4','I5'].forEach(function(k){var h=x.z[k]/maxT*(SH-6);if(h<.4)return;y-=h;sone+='<rect x="'+(i*bw+bw*.14)+'" y="'+y+'" width="'+(bw*.72)+'" height="'+Math.max(0,h-1.2)+'" fill="'+Z[k]+'"/>'});
   if(x.hard)sone+='<circle cx="'+((i+.5)*bw)+'" cy="3" r="2.2" fill="#FF4500" vector-effect="non-scaling-stroke"/>'});
  var FH=mob?56:74,minF=-40,maxF=90;function fy(v){return FH-(v-minF)/(maxF-minF)*FH}
  function sti(a,f){return a.map(function(v,i){return(i?'L':'M')+((i+.5)*bw).toFixed(1)+' '+f(v).toFixed(1)}).join('')}
  var z0=fy(0),over='M'+(.5*bw)+' '+z0+D.map(function(x,i){return'L'+((i+.5)*bw)+' '+fy(Math.max(0,x.tsb))}).join('')+'L'+((n-.5)*bw)+' '+z0+'Z',under='M'+(.5*bw)+' '+z0+D.map(function(x,i){return'L'+((i+.5)*bw)+' '+fy(Math.min(0,x.tsb))}).join('')+'L'+((n-.5)*bw)+' '+z0+'Z';
  var form='<line x1="0" x2="'+W+'" y1="'+z0+'" y2="'+z0+'" stroke="var(--a-line2)" vector-effect="non-scaling-stroke"/><path d="'+over+'" fill="#1A6FD4" opacity=".35"/><path d="'+under+'" fill="#E23A5A" opacity=".3"/>'+
   '<path d="'+sti(D.map(function(x){return x.atl}),fy)+'" fill="none" stroke="#8A8A96" stroke-width="1.5" stroke-dasharray="4 3" vector-effect="non-scaling-stroke"/><path d="'+sti(D.map(function(x){return x.ctl}),fy)+'" fill="none" stroke="var(--a-ink)" stroke-width="2" vector-effect="non-scaling-stroke"/>';
  var RH=mob?52:70;function ry(v){return RH/2-v/24*(RH/2)}
  var rest='<rect x="0" y="'+ry(6)+'" width="'+W+'" height="'+(ry(-6)-ry(6))+'" fill="var(--a-line)" opacity=".6"/><path d="'+sti(D.map(function(x){return x.hvpS}),ry)+'" fill="none" stroke="#E23A5A" stroke-width="1.6" vector-effect="non-scaling-stroke"/><path d="'+sti(D.map(function(x){return x.hrvS}),ry)+'" fill="none" stroke="#8B5CF6" stroke-width="1.8" vector-effect="non-scaling-stroke"/>';
  var OH=mob?24:30;function oy(v){return OH-(v-1)/9*(OH-4)-2}
  var fol='<path d="'+sti(D.map(function(x){return x.fol}),oy)+'" fill="none" stroke="var(--a-mute)" stroke-width="1" vector-effect="non-scaling-stroke"/>';
  var prikker=D.map(function(x,i){return'<i style="left:'+((i+.5)/n*100)+'%;top:'+oy(x.fol)+'px"></i>'}).join('');
  var ki=mob?26:56,kx=(ki+.5)/n*100,kd=D[ki];
  return'<div class="app fk"><div class="fk-t">Formkartet</div><div class="fk-u">Belastning, soner, restitusjon og følelse på én delt tidsakse</div>'+
  '<div class="fk-k"><span class="fk-seg"><span class="'+(mob?'on':'')+'">30 dager</span><span class="'+(mob?'':'on')+'">60 dager</span><span class="skjul-m">180 dager</span></span><span class="fk-seg"><span class="on">I1-I5</span><span>Lav / Med / Høy</span></span></div>'+
  '<div class="fk-leg">'+['I1','I2','I3','I4','I5'].map(function(k){return'<span><i style="background:'+Z[k]+'"></i>'+k+'</span>'}).join('')+'<span><i class="l" style="background:var(--a-ink)"></i>Form (CTL)</span><span><i class="l" style="background:#8A8A96"></i>Tretthet (ATL)</span><span><i class="l" style="background:#8B5CF6"></i>HRV</span><span><i class="l" style="background:#E23A5A"></i>Hvilepuls</span><span class="skjul-m"><i style="background:#E11D48"></i>Sykdom</span><span class="skjul-m"><i style="background:#D4A017"></i>Konkurranse</span></div>'+
  '<div class="fk-graf">'+bane('Dagen',16,dagen,'b0')+bane('Sonetid',SH,sone,'b1')+bane('Form',FH,form,'b2')+bane('Restitusjon',RH,rest,'b3')+
  '<div class="fkb b4"><div class="fkb-n">Følelse</div><div class="fkb-g fol" style="height:'+OH+'px"><svg viewBox="0 0 '+W+' '+OH+'" preserveAspectRatio="none">'+fol+'</svg>'+prikker+'</div></div>'+
  '<div class="fk-lese" style="left:'+kx+'%"><div class="fk-lese-l"></div><div class="fk-lese-p"><b>Søn 13. sep · Konkurranse</b><span>1:05 · I4 12 min · I5 9 min</span><span>Form '+Math.round(kd.ctl)+' · TSB <em style="color:#1A6FD4">+'+Math.max(1,Math.round(kd.tsb))+'</em></span><span>HRV <em style="color:#8B5CF6">+6 %</em> · hvilepuls <em style="color:#E23A5A">-3 %</em></span><span>Følelse 8/10</span></div></div>'+
  '</div><div class="fk-akse"><span>'+(mob?'17. aug':'18. jul')+'</span><span>'+(mob?'1. sep':'15. aug')+'</span><span>i dag</span></div></div>'},
 spill:function(S){S.steg(0,0);S.inn('.b0',300,'vis');S.inn('.b1',800,'vis');S.steg(1,2700);S.inn('.b2',2700,'vis');S.steg(2,4800);S.inn('.b3',4800,'vis');S.inn('.b4',5700,'vis');
  S.til('.fk-lese',7200);S.inn('.fk-lese',7900);S.bort(8200);S.steg(3,9200)}
});

/* ── 10 · STANDARDØKTA OVER TID (components/analysis/SerieAnalyse.tsx) ── */
var SERIE=[
 {d:'12. jun',p:154,l:5.8,tr:78,st:32.1,o:8,drag:[5.1,5.8,5.2]},{d:'26. jun',p:153,l:5.5,tr:80,st:31.4,o:8,drag:[4.9,5.5,5.0]},{d:'10. jul',p:152,l:5.6,tr:75,st:30.8,o:7,drag:[4.8,5.6,5.1]},{d:'24. jul',p:152,l:5.1,tr:85,st:30.2,o:7,drag:[4.5,5.1,4.7]},
 {d:'7. aug',p:151,l:5.0,tr:83,st:29.5,o:7,drag:[4.4,5.0,4.5],k:1},{d:'21. aug',p:150,l:4.9,tr:88,st:28.9,o:7,drag:[4.2,4.9,4.3]},{d:'1. sep',p:150,l:4.8,tr:85,st:28.6,o:6,drag:[4.1,4.8,4.2]},{d:'15. sep',p:149,l:4.6,tr:90,st:27.9,o:7,drag:[3.9,4.6,4.0]}];
var SVAR=[{id:'p',navn:'Snittpuls',fmt:function(v){return String(Math.round(v))},min:146,max:156,lav:1},{id:'l',navn:'Laktat maks',fmt:function(v){return v.toFixed(1).replace('.',',')},min:3.6,max:6.2,lav:1},{id:'tr',navn:'Treff %',fmt:function(v){return Math.round(v)+' %'},min:70,max:95,lav:0},{id:'st',navn:'Skytetid',fmt:function(v){return v.toFixed(1).replace('.',',')+' s'},min:26,max:33,lav:1},{id:'o',navn:'Opplevd',fmt:function(v){return String(v)},min:4,max:10,lav:1}];
function serieGraf(vid,perDrag,H){var W=1000,n=SERIE.length,v=SVAR.filter(function(x){return x.id===vid})[0];function X(i){return 30+i*(W-60)/(n-1)}function Y(x){return 10+(1-(x-v.min)/(v.max-v.min))*(H-20)}
 var s=[.25,.5,.75].map(function(f){return'<line x1="0" x2="'+W+'" y1="'+(H*f)+'" y2="'+(H*f)+'" stroke="var(--a-line)" vector-effect="non-scaling-stroke"/>'}).join('');
 if(perDrag){var F=['#FF4500','#1A6FD4','#28A86E'];[0,1,2].forEach(function(j){s+='<path d="'+SERIE.map(function(r,i){return(i?'L':'M')+X(i)+' '+Y(r.drag[j])}).join('')+'" fill="none" stroke="'+F[j]+'" stroke-width="2" vector-effect="non-scaling-stroke"/>'});return{svg:s,pkt:SERIE.map(function(r,i){return[0,1,2].map(function(j){return{x:X(i)/W*100,y:Y(r.drag[j]),c:F[j]}})}).reduce(function(a,b){return a.concat(b)},[])}}
 var best=0;SERIE.forEach(function(r,i){if(v.lav?r[vid]<SERIE[best][vid]:r[vid]>SERIE[best][vid])best=i});
 s+='<path d="'+SERIE.map(function(r,i){return(i?'L':'M')+X(i)+' '+Y(r[vid])}).join('')+'" fill="none" stroke="#FF4500" stroke-width="2.5" vector-effect="non-scaling-stroke"/>';
 return{svg:s,best:{x:X(best)/W*100,y:Y(SERIE[best][vid])},pkt:SERIE.map(function(r,i){return{x:X(i)/W*100,y:Y(r[vid]),c:'#FF4500',t:v.fmt(r[vid])}})}}
SC.push({kap:4,tittel:'SAMME ØKT. ÅTTE GANGER.',tekst:'Merk en økt som standardøkt, så følger appen hver gjennomføring: puls, laktat, treff og skytetid - drag for drag, mot forrige og mot beste.',
 steg:['Laktat over tid','Skytingen på samme serie','Drag for drag'],
 mer:['Merk en økt som standardøkt (egen eller NSSF-serien), så samles hver gjennomføring i én serie.','Graf per variabel med beste markert: puls, laktat, fart, treff og skytetid over tid.','«Per drag»: hvert drag mot forrige gjennomføring og mot beste, med tabell.','Treneren ser samme serie for sine utøvere i sitt panel.'],varighet:10500,
 html:function(){var mob=erMobil(),H=mob?130:170;
  var kol=mob?['p','l','tr']:['p','l','tr','st','o'];
  var tab='<table class="se-tab"><thead><tr><th></th><th>Dato</th>'+kol.map(function(k){return'<th>'+SVAR.filter(function(v){return v.id===k})[0].navn+'</th>'}).join('')+'</tr></thead><tbody>'+
   SERIE.slice(mob?5:3).reverse().map(function(r,ri){var idx=SERIE.indexOf(r),f=SERIE[idx-1];return'<tr class="'+(idx===7?'best':'')+'"><td><i class="ck on"></i></td><td>'+(idx===7?ik('peak','f','width:12px;height:12px;color:#E8B93C;margin-right:3px'):'')+r.d+(r.k?ik('konkurranse','s','width:12px;height:12px;margin-left:3px'):'')+'</td>'+
    kol.map(function(k){var v=SVAR.filter(function(x){return x.id===k})[0],val=r[k],dl=f?val-f[k]:null;var bra=dl==null?0:(v.lav?dl<0:dl>0);return'<td>'+v.fmt(val)+(dl!=null&&dl!==0?'<small class="'+(bra?'g':'r')+'">'+(dl>0?'+':'−')+v.fmt(Math.abs(dl)).replace(' %','').replace(' s','')+'</small>':'')+'</td>'}).join('')+'</tr>'}).join('')+'</tbody></table>';
  return'<div class="app se"><div class="se-t">Terskel komb - over tid</div><div class="se-u">Standardøkt · 8 gjennomføringer · 2 × 10 I3 + 3 × 5 I4 m/ skyting</div>'+
  '<div class="chiprad"><span class="cap" style="font-size:10px">Gjennomføringer</span><span class="chip on" style="--c:#FF4500">Siste 5</span><span class="chip skjul-m" style="--c:#FF4500">Beste 5</span><span class="chip skjul-m" style="--c:#E23A5A">Konkurranser</span></div>'+
  '<div class="chiprad"><span class="cap" style="font-size:10px">Variabel</span>'+SVAR.map(function(v){return'<span class="chip sv '+(v.id==='o'||v.id==='st'?'skjul-m':'')+'" data-v="'+v.id+'" style="--c:#FF4500">'+v.navn+'</span>'}).join('')+'<span class="chip perdrag" style="--c:#1A6FD4">Per drag</span></div>'+
  '<div class="se-g" style="height:'+(H+18)+'px"><div class="se-plot" style="height:'+H+'px"></div><div class="se-x">'+SERIE.map(function(r){return'<span>'+r.d+'</span>'}).join('')+'</div></div>'+
  '<div class="se-leg"></div>'+tab+'</div>'},
 spill:function(S){var mob=erMobil(),H=mob?130:170;
  function tegn(vid,perDrag){var g=serieGraf(vid,perDrag,H),p=S.q('.se-plot');
   p.innerHTML='<div class="klipp" style="position:absolute;inset:0;clip-path:inset(0 100% 0 0);transition:clip-path 1.1s cubic-bezier(.45,.05,.25,1)"><svg viewBox="0 0 1000 '+H+'" preserveAspectRatio="none" style="width:100%;height:100%;overflow:visible">'+g.svg+'</svg>'+
    g.pkt.map(function(k){return'<i class="se-p" style="left:'+k.x+'%;top:'+k.y+'px;background:'+k.c+'"></i>'+(k.t&&!mob?'<b class="se-v" style="left:'+k.x+'%;top:'+(k.y-19)+'px">'+k.t+'</b>':'')}).join('')+
    (g.best?'<i class="se-best" style="left:'+g.best.x+'%;top:'+g.best.y+'px"></i><b class="se-bt" style="left:'+g.best.x+'%;top:'+(g.best.y+10)+'px">beste</b>':'')+'</div>';
   requestAnimationFrame(function(){requestAnimationFrame(function(){var k=p.querySelector('.klipp');if(k)k.style.clipPath='inset(0 0 0 0)'})});
   if(S.still){var k=p.querySelector('.klipp');k.style.clipPath='inset(0 0 0 0)'}
   S.qa('.sv').forEach(function(c){c.classList.toggle('on',c.dataset.v===vid);c.classList.toggle('fokus',c.dataset.v===vid)});S.q('.perdrag').classList.toggle('on',!!perDrag);
   S.q('.se-leg').innerHTML=perDrag?'<span><i style="background:#FF4500"></i>Drag 1</span><span><i style="background:#1A6FD4"></i>Drag 2</span><span><i style="background:#28A86E"></i>Drag 3</span>':'<span><i style="background:#FF4500"></i>'+SVAR.filter(function(x){return x.id===vid})[0].navn+'</span><span><i style="background:#E8B93C;border-radius:50%"></i>Beste</span>'}
  S.steg(0,0);S.t(300,function(){tegn('l')});S.qa?S.t(600,function(){S.qa('.se-tab tbody tr').forEach(function(tr,i){tr.style.transitionDelay=(i*60)+'ms';tr.classList.add('inn')})}):0;
  S.steg(1,3300);S.til('.sv[data-v="tr"]',3300,true);S.t(3700,function(){tegn('tr')});
  S.til('.sv[data-v="'+(mob?'p':'st')+'"]',5200,true);S.t(5600,function(){tegn(mob?'p':'st')});
  S.steg(2,7000);S.til('.perdrag',7000,true);S.t(7400,function(){tegn('l',true)});S.bort(7700);S.steg(3,9300)}
});

/* ── 11 · HJEM (app/app/(authed)/oversikt/page.tsx + components/oversikt/*) ── */
function hjKort(tittel,tag,innhold,kl,stil){return'<section class="hjk a '+(kl||'')+'" style="'+(stil||'')+'"><div class="xp-kh"><span class="xp-beam"></span><h2>'+tittel+'</h2>'+(tag?'<span class="tag">'+tag+'</span>':'')+'</div>'+innhold+'</section>'}
function hjSone(z,leg){var tot=0;for(var k in z)tot+=z[k];return'<div class="hj-zb">'+Object.keys(z).map(function(k){return'<span class="gro" style="--w:'+(z[k]/tot*100)+'%;background:'+Z[k]+'"></span>'}).join('')+'</div>'+(leg?'<div class="hj-zl">'+Object.keys(z).map(function(k){var m=z[k];return'<span><b style="background:'+Z[k]+'"></b>'+k+' '+(m>=60?Math.floor(m/60)+'t '+(m%60?m%60+'m':''):m+'m')+'</span>'}).join('')+'</div>':'')}
function hjBar(navn,v,maal,vt,mt,farge){return'<div class="hj-fr"><div class="hj-frt"><span>'+navn+'</span><span><b>'+vt+'</b> / '+mt+'</span></div><div class="hj-fb"><i class="gro" style="--w:'+Math.min(100,v/maal*100)+'%;background:'+farge+'"></i></div></div>'}
var HJ={
 idag:function(){return hjKort('I dag','Ons 16. sep','<span class="hj-st">'+ik('fullfort','s')+'Gjennomført</span><h3>Styrke basis</h3><p class="hj-m">48 min · 12 sett · 7 840 kg · 2 PR</p>'+
  '<div class="hj-nk3"><div><small>Tid</small><b>48m</b></div><div><small>Sett</small><b>12</b></div><div><small>Tonnasje</small><b>7 840</b></div></div>'+
  '<div class="hj-neste"><small>Neste økt · tor 17. sep</small><div><span class="mstripe" style="width:70px;height:9px"><i style="flex:1;background:#28A86E;opacity:.62"></i></span><b>Rolig 60 min · I1</b></div></div>')},
 uke:function(){return hjKort('Ukens totaler','Uke 38','<div class="hj-sg"><div><small>Tid</small><b class="hj-c" data-til="380" data-f="t">0t</b><em class="g">↑ 12% vs forrige</em></div><div><small>Distanse</small><b>58,4 km</b><em class="g">↑ 8% vs forrige</em></div><div><small>Økter</small><b>4</b></div></div>'+
  hjSone({I1:258,I2:52,I3:40,I4:30},true)+'<div class="hj-skc"><span class="hj-pill">'+ik('skyting','s')+'<b>180/200</b> treff · 90 %</span><span class="hj-meter"><i class="gro" style="--w:90%"></i></span></div>'+
  hjBar('Timer',6.3,11,'6t 20m','11t','#28A86E')+hjBar('Hard I3+',70,90,'1t 10m','1t 30m','#28A86E')+
  '<div class="hj-dager">'+['M','T','O','T','F','L','S'].map(function(d,i){var k=i<3?(i===1?'hard':'ok'):(i===2?'':'plan');return'<span class="'+(i===0?'ok':i===1?'hard':i===2?'ok':'plan')+'">'+d+'</span>'}).join('')+'</div>')},
 konk:function(){return'<section class="hjk a hj-konk"><div class="hj-kh"><span class="hj-gb"></span><span>Neste A-konkurranse</span><span class="dt">lør 12. des</span></div><div class="hj-kr"><div><h3>NC Simostranda</h3><p class="hj-m">Simostranda · Skiskyting · Sprint 7,5 km</p><p class="hj-maal"><small>Mål</small>Topp 10</p><p class="hj-fase">Grunntrening · uke 3 av 9</p></div><div class="hj-ned"><b class="hj-c" data-til="87">87</b><small>dager igjen</small></div></div>'+
  '<div class="hj-kl">'+[['C','Sjusjøen testløp','lør 14. nov · Sjusjøen'],['B','Beitostølen','lør 21. nov · Beitostølen · Sprint'],['B','NC Lillehammer','lør 23. jan · Lillehammer · Jaktstart']].map(function(r){return'<div><span class="pri '+r[0]+'">'+r[0]+'</span><div><b>'+r[1]+'</b><small>'+r[2]+'</small></div></div>'}).join('')+'</div></section>'},
 helse:function(){return hjKort('Helse','i natt','<div class="hj-h4"><div><small>Hvilepuls</small><b>48</b><em>snitt 50</em></div><div><small>HRV</small><b>62</b><em>snitt 58</em></div><div><small>Søvn</small><b>7:32</b><em>score 84</em></div><div><small>Følelse</small><b>4<i>/5</i></b><em>ført</em></div></div><div class="sstripe" style="margin-top:10px"><i class="gro2" style="flex-basis:21%;background:#1A6FD4"></i><i class="gro2" style="flex-basis:52%;background:#38BDF8"></i><i class="gro2" style="flex-basis:23%;background:#8B5CF6"></i><i class="gro2" style="flex-basis:3%;background:#E8B93C"></i></div>'+
  '<svg class="hj-hrv" viewBox="0 0 320 70" preserveAspectRatio="none"><path d="'+linjeSti(HRV,44,70,320,70)+'" fill="none" stroke="#1A6FD4" stroke-width="1.8" vector-effect="non-scaling-stroke"/><path d="'+linjeSti(HVP,44,58,320,70)+'" fill="none" stroke="#E23A5A" stroke-width="1.8" vector-effect="non-scaling-stroke"/></svg>')},
 hard:function(){var W=1000,H=90;return hjKort('Siste hardøkt','Tir 15. sep','<h3 style="font-size:17px">2 × 10 min I3 + 3 × 5 min I4</h3><p class="hj-m">Skøyting · Skiskyting · Garmin</p>'+
  '<div class="hj-kurve"><svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none">'+OKT.map(function(b){return'<rect x="'+(b.s/TOT*W+1)+'" y="'+(H-H*blokkH(b))+'" width="'+((b.e-b.s)/TOT*W-2)+'" height="'+(H*blokkH(b))+'" fill="'+blokkFarge(b)+'" opacity="'+(b.t==='sky'?.35:.12)+'"/>'}).join('')+'<path d="'+kurveSti(W,H)+'" fill="none" stroke="#E23A5A" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg></div>'+
  '<div class="segb" style="height:10px;margin-top:4px">'+OKT.map(function(b){return'<i style="flex:'+(b.e-b.s)+';background:'+(b.t==='oppv'?'#BBAA55':b.t==='ned'?'#64748B':b.t==='sky'?'#43434B':'#1E2AA8')+'"></i>'}).join('')+'</div>'+
  '<div class="hj-nk6">'+[['Varighet','1t 20'],['Snittpuls','149'],['Laktat maks','4,6'],['Skyting','18/20'],['Belastning','96 TSS'],['Opplevd','7/10']].map(function(x){return'<div><small>'+x[0]+'</small><b>'+x[1]+'</b></div>'}).join('')+'</div>','hj-hardk')},
 maal:function(){return hjKort('Hovedmål','2026/27','<h3>Topp 10 i NM</h3><p class="hj-m">226 dager til sesongslutt · 30. apr</p>'+hjBar('Timer hittil',38,620,'38 t','620 t · 6 %','#28A86E')+'<p class="hj-und">i rute · plan 6 % · 12,7 t/uke snitt</p>'+hjBar('Skudd hittil',1240,12000,'1 240','12 000 · 10 %','#28A86E')+'<p class="hj-und">i rute · plan 6 % · treff 88 %</p>')},
 periode:function(){return hjKort('Periode','uke 3 av 9','<div style="display:flex;gap:8px;align-items:center"><h3 style="margin:0">Grunntrening</h3><span class="hj-int">Rolig</span></div><p class="hj-m">31. aug - 1. nov · 46 dager igjen</p><div class="hj-fb" style="margin-top:8px"><i class="gro" style="--w:26%;background:#1A6FD4"></i></div><p class="hj-und">Dag 17 av 63 · volum 12,7 t/uke snitt hittil</p>'+
  '<div class="hj-tl">'+PER.map(function(p,i){return'<span style="flex:'+p[2].length+';background:'+(p[0]==='rolig'?'#28A86E':p[0]==='medium'?'#E8B93C':'#E23A5A')+';opacity:'+(i?.55:1)+(i?'':';outline:2px solid var(--a-ink);outline-offset:-1px')+'"></span>'}).join('')+'</div>'+
  '<div class="hj-pl"><div><i style="background:#D4A017;border-radius:2px"></i><b>Livigno</b><small>8.-17. okt · høyde · 10 dager</small></div><div><i style="background:#E8B93C"></i><b>Oppbygging</b><small>2.-29. nov · 4 uker · Medium</small></div></div>','','--blaa:1')}
};
SC.push({kap:5,tittel:'ALT SAMLET PÅ HJEM.',tekst:'Dagens økt, uka mot planen, nedtelling til neste A-renn, formen fra natta, siste hardøkt, hovedmålet og perioden - ett blikk når du åpner appen.',
 steg:['Dagen og uka','Konkurransen og målet','Formen og perioden'],
 mer:['Rad 1: I dag (dagens økt med start-knapp), ukens totaler mot planen, neste A-konkurranse med nedtelling.','Rad 2: helsekortet fra natta, siste hardøkt med full øktgraf, hovedmålet og perioden du står i.','PR-merke når en styrkeøkt satte rekord, «Hva er nytt» når appen har fått noe nytt.','Trenerens Hjem: status nå for hele troppen i én henting - rød, gul, grønn etter dager siden siste logging.'],varighet:9000,
 html:function(){var mob=erMobil(),bredde=mob?380:1180;
  var innhold=mob?(HJ.idag()+HJ.uke()+HJ.konk()):('<div class="hj-r1">'+HJ.idag()+HJ.uke()+HJ.konk()+'</div><div class="hj-r2">'+HJ.helse()+HJ.hard()+HJ.maal()+HJ.periode()+'</div>');
  return'<div class="hj-ytre"><div class="app hj-ramme"><div class="hj-skala" style="width:'+bredde+'px"><div class="hj-inn '+(mob?'mob':'')+'">'+
  '<div class="hj-hero a"><div class="xp-eyebrow"><span class="xp-beam"></span>Onsdag 16. september · Uke 38</div><h1>God morgen, Ola</h1><p>Uke 38 · <b>4 økter</b> · <b>6t 20min</b></p></div>'+innhold+'</div></div></div></div>'},
 spill:function(S){function skaler(){var y=S.q('.hj-ytre'),sk=S.q('.hj-skala');if(!y||!sk)return;var bredde=parseFloat(sk.style.width),s=Math.min(1,y.clientWidth/bredde);sk.style.transform='scale('+s+')';var maxH=erMobil()?470:560;sk.parentNode.style.height=Math.min(sk.offsetHeight*s,maxH)+'px'}
  S.t(0,skaler);S.steg(0,0);var kort=function(){return S.qa('.hjk,.hj-hero')};
  S.t(150,function(){kort().forEach(function(k,i){k.style.transitionDelay=(i*110)+'ms';k.classList.add('inn')})});
  S.t(700,function(){S.qa('.gro,.gro2').forEach(function(g){g.classList.add('inn')})});
  S.tell('.hj-c[data-til="380"]',0,380,1000,700,function(v){v=Math.round(v);return Math.floor(v/60)+'t '+(v%60)+'m'});S.tell('.hj-konk .hj-c',140,87,1100,900);
  S.steg(1,2800);S.t(2800,function(){var k=S.q('.hj-konk');if(k)k.classList.add('glod')});S.steg(2,5200);S.t(5200,function(){var h=S.q('.hj-hardk');if(h)h.classList.add('glod')});S.steg(3,7600)}
});

/* Utkast-scenene ut - FØR motoren far lista, sa kapittel-tellingen stemmer. */
if (!VIS_UTKAST_SCENER) SC = SC.filter(function (s) { return UTKAST_TITLER.indexOf(s.tittel) === -1; });
karusell(SC, KAP, '');
