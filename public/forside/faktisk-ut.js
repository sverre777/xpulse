/* #inside «SLIK SER DET FAKTISK UT.» v2 - dagboken. Kilde: <script> i
   design/xpulse-faktisk-ut-v2-design.html (16. sep 2026). Vanilla JS,
   datadrevet: Uke · Maned (rutenett/liste) · Ar, PC + mobil, dag-popup.
   Ikonene (IK) fra /forside/ikoner.js.

   AVVIK FRA REGEL 11 (bevisst, star i rapporten): dette er ikke eksporterte
   React-fragmenter. Atte visningstilstander pluss en dag-popup for hver av 35
   dager lar seg ikke forhandseksportere via /forside-eksport, og utkastet er
   skrevet etter Calendar.tsx, UkeVisning.tsx, PeriodeStripe.tsx,
   KompaktHelseKort.tsx og GlassLinje.tsx (linjereferanser i designfilas
   notat). Farger, ikoner og mal kommer fra de samme kildene som appen.

   To bevisste avvik fra dagens app (Sverre 16. sep): (a) oktkortet i dagen
   viser oktgrafen for gjennomforte okter; (b) styrkeokta bruker settgrafen
   fra design/xpulse-styrke-design.html. Forside-illustrasjoner - ingen
   app-kode endres. Datoene er faste (i dag = ons 16. sep 2026). */
/* ═══ SLIK SER DET FAKTISK UT v2 - dagboken, data + tegning ═══ */
(function(){
var Z={1:'#28A86E',2:'#1A6FD4',3:'#E8B93C',4:'#FF8C00',5:'#E23A5A',S:'#6E6E78',P:'#43434B'};
var BH={1:.36,2:.48,3:.6,4:.72,5:.86,S:.55,P:.3}; /* PlanGraf kompakt: høyde per sone */
var BEL={rolig:'#28A86E',medium:'#D4A017',hard:'#E11D48'};
var IDAG='2026-09-16';
var UKED=['Man','Tir','Ons','Tor','Fre','Lør','Søn'], UKEDL=['Mandag','Tirsdag','Onsdag','Torsdag','Fredag','Lørdag','Søndag'];
var MNDK=['jan','feb','mar','apr','mai','jun','jul','aug','sep','okt','nov','des'];

/* Perioder på 5-10 dager. Rød = hard = høyest totalbelastning (samlingen). */
var PER=[
  {n:'Grunnperiode',b:'rolig', fra:'2026-08-31',til:'2026-09-05'},
  {n:'Belastning',  b:'medium',fra:'2026-09-06',til:'2026-09-13'},
  {n:'Restitusjon', b:'rolig', fra:'2026-09-14',til:'2026-09-18'},
  {n:'Samling Sjusjøen',b:'hard',fra:'2026-09-19',til:'2026-09-27',samling:1},
  {n:'Overgang',    b:'rolig', fra:'2026-09-28',til:'2026-10-04'}
];
/* Nøkkeldatoer (ikon i dagcellen + omriss) */
var NOK={'2026-09-03':{t:'testlop',c:'#1A6FD4',n:'Testløp 3 000 m'},'2026-09-12':{t:'b-konkurranse',c:'#D4A017',n:'NC sprint'},'2026-09-13':{t:'b-konkurranse',c:'#D4A017',n:'NC jaktstart'},'2026-09-27':{t:'c-konkurranse',c:'#1A6FD4',n:'Klubbrenn sprint'}};
var HVILE={'2026-09-04':1,'2026-09-18':1,'2026-09-28':1};
var HELSE=function(k){return k<=IDAG}; /* klokka leverer søvn/HRV hver dag til og med i dag */

/* Byggeklosser: [sone, minutter]. Alt tegnes fra disse. */
function rep(n,a,b){var o=[];for(var i=0;i<n;i++){o.push(a);o.push(b);}return o;}
function okt(dt,kl,t,uk,sp,bl,x){var o={dt:dt,kl:kl,t:t,uk:uk,sp:sp,bl:bl};for(var k in (x||{}))o[k]=x[k];
  o.dur=bl.reduce(function(s,b){return s+b[1]},0);o.ok=dt<IDAG||(dt===IDAG&&kl<'12:00')?1:0;
  o.garmin=o.ok&&sp!=='Styrke'&&sp!=='Skyting'?1:0;
  var z={1:0,2:0,3:0,4:0,5:0,S:0,P:0};bl.forEach(function(b){z[b[0]]+=b[1]});o.z=z;
  /* intensityAccent (Calendar.tsx:600-610) + konkurranse/testløp/styrke */
  o.c=o.konk?'#D4A017':o.test?'#1A6FD4':sp==='Styrke'?Z.S:z[5]>=5?Z[5]:z[4]>=10?Z[4]:z[3]>=20?Z[3]:(z[2]>z[1]?Z[2]:Z[1]);
  return o;}
var TK=function(dt,x){return okt(dt,'09:30','Terskel komb','Terskel m/ skyting','Rulleski',[[1,15],[3,10],['P',3],[3,10],['P',3],[4,5],['P',2],[4,5],['P',2],[4,5],[1,20]],x)};
var HK=function(dt,n,m,x){var b=[[1,15]];for(var i=0;i<n;i++){b.push([4,m]);b.push(['P',2]);}b.push([1,12]);return okt(dt,x&&x.kl||'09:30','Hardkomb '+n+'×'+m,'Konkurransekomb L-S-L-S','Rulleski',b,x)};
var RO=function(dt,kl,min,sp,x){return okt(dt,kl,'Rolig','Rolig','' +sp,[[1,min]],x)};
var LT=function(dt,kl,min,sp,x){return okt(dt,kl,x&&x.sky?'Langtur m/ skyting':'Langtur','Rolig langtur',sp,x&&x.sky?[[1,min*.5],['P',8],[2,min*.3],['P',8],[1,min*.2-16]]:[[1,min*.55],[2,min*.3],[1,min*.15]],x)};
var IN=function(dt,t,sp,n,m,z,x){return okt(dt,'09:30',t,z>=5?'Hurtighet':z===3?'Terskel':'Intervall',sp,[[1,15]].concat(rep(n,[z,m],[1,z>=5?2:3])).concat([[1,10]]),x)};
var SK=function(dt,kl,t,min,x){return okt(dt,kl,t,t.indexOf('stå')>-1?'Stående':t.indexOf('ligg')>-1?'Liggende':'Kombinert','Skyting',[['P',min]],x)};
var ST=function(dt,x){return okt(dt,'16:30','Styrke','Maks/hypertrofi','Styrke',[['S',10],['P',3],['S',12],['P',3],['S',12],['P',3],['S',7]],x)};
var STYRKE_SETT=[['Knebøy',[[8,100],[8,100],[8,100]],1],['Markløft',[[6,120],[6,120],[6,120]],0],['Utfall',[[10,40],[10,40],[10,40]],0],['Nedtrekk',[[12,58],[12,58],[12,58]],0]];
function tonn(){var t=0;STYRKE_SETT.forEach(function(e){e[1].forEach(function(s){t+=s[0]*s[1]})});return t}

var OKTER=[
  /* U36 - Grunnperiode */
  RO('2026-08-31','09:00',120,'Rulleski',{km:38}),
  TK('2026-09-01',{sky:[17,20],lak:'4,2',nr:7,km:24}), ST('2026-09-01',{kg:7120}),
  RO('2026-09-02','08:30',60,'Løping',{km:11}), SK('2026-09-02','16:00','Skyting stående',40,{sky:[36,40]}),
  okt('2026-09-03','10:00','Testløp 3 000 m','Test','Løping',[[1,20],[5,11],[1,15]],{test:1,km:8,tid:'9:42'}),
  LT('2026-09-05','10:00',180,'Rulleski',{sky:[38,40],km:55}),
  RO('2026-09-06','11:00',90,'Sykkel',{km:42}),
  /* U37 - Belastning (medium), NC-helg */
  RO('2026-09-07','09:00',150,'Rulleski',{km:46}), ST('2026-09-07',{kg:7480}),
  IN('2026-09-08','Hurtighet 8×1','Rulleski',8,1,5,{km:20}), SK('2026-09-08','17:00','Skyting liggende',40,{sky:[37,40]}),
  RO('2026-09-09','08:30',70,'Løping',{km:13}),
  RO('2026-09-09','16:00',45,'Løping',{km:8}), SK('2026-09-09','17:00','Kombinert skyting',45,{sky:[39,45]}),
  HK('2026-09-10',4,6,{sky:[18,20],lak:'5,1',km:26}), RO('2026-09-10','16:00',40,'Løping',{km:7}),
  LT('2026-09-11','09:00',60,'Rulleski',{sky:[20,20],km:17}),
  okt('2026-09-12','11:00','NC sprint 7,5 km','Konkurranse','Rulleski',[[1,25],[5,24],[1,20]],{konk:'B',plass:4,sky:[8,10],km:12}),
  okt('2026-09-13','11:00','NC jaktstart 10 km','Konkurranse','Rulleski',[[1,25],[5,29],[1,20]],{konk:'B',plass:6,sky:[17,20],km:15}), RO('2026-09-13','16:00',60,'Sykkel',{km:26}),
  /* U38 - Restitusjon, i dag ons 16. */
  RO('2026-09-14','09:00',120,'Rulleski',{km:36}), SK('2026-09-14','16:00','Skyting liggende',40,{sky:[38,40]}),
  TK('2026-09-15',{sky:[18,20],lak:'4,6',nr:8,km:25,puls:152,tss:96,rpe:7}), ST('2026-09-15',{kg:tonn(),sett:STYRKE_SETT,tss:41,rpe:6}),
  RO('2026-09-16','08:30',60,'Løping',{km:11}), SK('2026-09-16','16:00','Skyting stående',40,{plan:40}),
  RO('2026-09-17','09:30',80,'Elghufs',{km:9}), SK('2026-09-17','16:00','Skyting stående',40,{plan:40}),
  LT('2026-09-19','09:30',180,'Rulleski',{sky:[0,40],plan:40,km:52}), SK('2026-09-19','16:00','Skyting liggende',40,{plan:40}),
  IN('2026-09-20','Intervall 5×6','Løping',5,6,4,{km:12}), RO('2026-09-20','16:00',60,'Sykkel',{km:28}),
  /* U39 - Samling Sjusjøen (hard) */
  LT('2026-09-21','09:00',180,'Rulleski',{km:54}), SK('2026-09-21','16:00','Skyting stående',45,{plan:50}),
  HK('2026-09-22',5,4,{plan:20,km:24}), ST('2026-09-22',{}),
  RO('2026-09-23','09:00',150,'Elghufs',{km:16}), SK('2026-09-23','16:00','Kombinert skyting',60,{plan:60}),
  IN('2026-09-24','Intervall 6×5','Løping',6,5,4,{km:13}), RO('2026-09-24','16:00',60,'Sykkel',{km:27}),
  RO('2026-09-25','09:00',60,'Løping',{km:11}), SK('2026-09-25','16:00','Skyting liggende',40,{plan:40}),
  LT('2026-09-26','09:30',210,'Rulleski',{sky:[0,40],plan:40,km:62}),
  okt('2026-09-27','10:00','Klubbrenn sprint','Konkurranse','Rulleski',[[1,25],[5,22],[1,15]],{konk:'C',km:11,plan:10}), RO('2026-09-27','15:00',45,'Løping',{km:8}),
  /* U40 - Overgang */
  HK('2026-09-29',4,5,{plan:20,km:23}), ST('2026-09-29',{}),
  RO('2026-09-30','08:30',60,'Løping',{km:11}),
  TK('2026-10-01',{nr:9,km:25}),
  RO('2026-10-02','09:00',60,'Løping',{km:11}),
  LT('2026-10-03','10:00',150,'Rulleski',{km:44}),
  RO('2026-10-04','11:00',90,'Sykkel',{km:40})
];
var BY={};OKTER.forEach(function(o){(BY[o.dt]=BY[o.dt]||[]).push(o)});Object.keys(BY).forEach(function(k){BY[k].sort(function(a,b){return a.kl<b.kl?-1:1})});

/* Datoverktøy */
function iso(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function dato(s){var p=s.split('-');return new Date(+p[0],+p[1]-1,+p[2])}
function pluss(d,n){var x=new Date(d);x.setDate(x.getDate()+n);return x}
function ukenr(d){var x=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));var dag=x.getUTCDay()||7;x.setUTCDate(x.getUTCDate()+4-dag);var y=new Date(Date.UTC(x.getUTCFullYear(),0,1));return Math.ceil(((x-y)/864e5+1)/7)}
function tid(min){min=Math.round(min);var h=Math.floor(min/60),m=min%60;return h+':'+String(m).padStart(2,'0')}
function tidT(min){min=Math.round(min);var h=Math.floor(min/60),m=min%60;return h?(h+'t'+(m?' '+m+'min':'')):(m+'min')}
function km(v){return String(Math.round(v*10)/10).replace('.',',')}
function kort(s){var d=dato(s);return d.getDate()+'. '+MNDK[d.getMonth()]}
function periodeFor(k){for(var i=0;i<PER.length;i++)if(k>=PER[i].fra&&k<=PER[i].til)return PER[i];return null}
var UKER=[];(function(){var m=dato('2026-08-31');for(var i=0;i<5;i++){UKER.push({m:m,nr:ukenr(m),dager:Array.from({length:7},function(_,j){return pluss(m,j)})});m=pluss(m,7)}})();
function sum(okter){var t=0,g=0,gt=0,k=0,n=0,z={1:0,2:0,3:0,4:0,5:0,S:0,P:0},sk=[0,0];okter.forEach(function(o){t+=o.dur;n++;k+=o.km||0;if(o.ok){g+=o.dur;gt++}for(var q in o.z)z[q]+=o.z[q];if(o.sky&&o.ok){sk[0]+=o.sky[0];sk[1]+=o.sky[1]}});return{t:t,g:g,gt:gt,km:k,n:n,z:z,sk:sk}}
function ukeOkter(u){var a=[];u.dager.forEach(function(d){a=a.concat(BY[iso(d)]||[])});return a}

/* Pulskurve simulert fra blokkene (henger sammen med økta) */
var MAAL={1:131,2:148,3:161,4:171,5:181,S:118,P:108};
function puls(o){var hr=92,seed=o.dur*7+o.bl.length,pts=[];function rnd(){seed=(seed*9301+49297)%233280;return seed/233280-.5}
  o.bl.forEach(function(b){var n=Math.max(2,Math.round(b[1]));for(var i=0;i<n;i++){hr+=(MAAL[b[0]]-hr)*(b[0]==='P'||b[0]===1?.18:.32)+rnd()*3;pts.push(hr)}});return pts}

/* Delelementer */
function ik(n,v,st){var p=IK[n]&&IK[n][v||'s'];if(!p)return'';return v==='f'?'<svg viewBox="0 0 24 24" aria-hidden="true"'+(st?' style="'+st+'"':'')+'><path d="'+p+'" fill="currentColor"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"'+(st?' style="'+st+'"':'')+'><path d="'+p+'" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>'}
function hake(){return'<svg class="hake" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'}
/* ChipKurve: PlanGraf kompakt (sonesøyler) + tynn rød pulslinje når økta kom fra klokka */
function kurve(o,h,sw){h=h||26;sw=sw||1.4;var W=200,x=0,s='';o.bl.forEach(function(b){var w=b[1]/o.dur*W,bh=BH[b[0]]*h;s+='<rect x="'+x.toFixed(1)+'" y="'+(h-bh).toFixed(1)+'" width="'+Math.max(w-.6,.5).toFixed(1)+'" height="'+bh.toFixed(1)+'" rx="1" fill="'+Z[b[0]]+'" opacity="'+(o.ok?(b[0]===1?.62:.9):.3)+'"'+(o.ok?'':' stroke="'+Z[b[0]]+'" stroke-dasharray="2 2" stroke-width=".8"')+'/>';x+=w});
  if(o.garmin){var p=puls(o),n=p.length;s+='<polyline fill="none" stroke="#E23A5A" stroke-width="'+sw+'" stroke-linejoin="round" vector-effect="non-scaling-stroke" points="'+p.map(function(v,i){return(i/(n-1)*W).toFixed(1)+','+(h-(v-85)/105*h).toFixed(1)}).join(' ')+'"/>'}
  return'<svg class="fv-kurve" viewBox="0 0 '+W+' '+h+'" preserveAspectRatio="none" style="height:'+h+'px">'+s+'</svg>'}
function zb(z){var s='';['1','2','3','4','5','S'].forEach(function(k){if(z[k]>0)s+='<i style="flex:'+z[k]+';background:'+Z[k]+'"></i>'});return s}
function ztekst(z){var t=z[1]+z[2]+z[3]+z[4]+z[5];if(!t)return'<span style="color:var(--a-mut)">Uten soner (styrke o.l.): 100%</span>';var a=Math.round((z[1]+z[2])/t*100),b=Math.round(z[3]/t*100),c=100-a-b;return'<span style="color:'+Z[1]+'">I1-2: '+a+'%</span> · <span style="color:'+Z[3]+'">I3: '+b+'%</span> · <span style="color:'+Z[5]+'">I4-5+: '+c+'%</span>'}
function skyChip(sk,plan){if(!sk[1]&&!plan)return'';var pct=sk[1]?Math.round(sk[0]/sk[1]*100):0;return'<span class="fv-skychip">'+ik('skyting')+'<b>'+sk[0]+'/'+(plan||sk[1])+'</b>&nbsp;skudd'+(sk[1]?' · '+pct+' %':'')+'<i class="tb"><i style="flex:55;background:#1A6FD4"></i><i style="flex:45;background:#FF8C00"></i></i></span>'}
function importBadge(){return'<span class="fv-kilde">'+ik('klokke')+'Garmin</span>'}
function metaTekst(o){var m=[];if(o.plass)m.push('<em style="color:'+o.c+'">#'+o.plass+'</em>');m.push('<b>'+tidT(o.dur)+'</b>');var u=[];if(o.uk&&o.uk!==o.t)u.push(o.uk);if(o.sp!==o.uk)u.push('<span class="bf">'+o.sp+'</span>');if(u.length)m.push(u.join(' · '));if(o.sky&&o.ok)m.push('<span class="sk">'+ik('skyting')+o.sky[0]+'/'+o.sky[1]+'</span>');else if(o.plan&&!o.ok)m.push('<span class="sk">'+ik('skyting')+o.plan+' skudd</span>');if(o.nr)m.push('<span style="color:#FF8A5C">'+ik('standardokt-serie')+'</span>');return m.join(' ')}

/* Periodestripe: per dag, spenner kolonner (PeriodeStripe.tsx) */
function pstripe(u,mob){var s='',i=0;while(i<7){var k=iso(u.dager[i]),p=periodeFor(k),j;if(!p){j=i;while(j<7&&!periodeFor(iso(u.dager[j])))j++;s+='<span class="tom" style="grid-column:'+(i+1)+'/'+(j+1)+'">'+(mob?'':'+ Legg til periode')+'</span>';i=j;continue}
    j=i;while(j<7&&periodeFor(iso(u.dager[j]))===p)j++;var forts=iso(u.dager[i])>p.fra,videre=iso(u.dager[j-1])<p.til;
    s+='<span style="grid-column:'+(i+1)+'/'+(j+1)+';background:color-mix(in srgb,'+BEL[p.b]+' 58%,transparent);border-radius:'+(forts?0:4)+'px '+(videre?0:4)+'px '+(videre?0:4)+'px '+(forts?0:4)+'px">'+p.n+(mob?'':' · '+kort(p.fra)+' - '+kort(p.til))+'</span>';i=j}
  return'<div class="fv-pstripe">'+s+'</div>'}
function ukestripe(u,mob){var s=sum(ukeOkter(u));var plan=0;ukeOkter(u).forEach(function(o){if(o.plan)plan+=o.plan});var sp=periodeFor(iso(u.dager[3]));
  return'<div class="fv-ukestripe"><span class="u">Uke '+u.nr+'</span>'+skyChip(s.sk,plan+s.sk[1])+(sp&&sp.samling?'<span class="fv-badge" style="color:#7C5CFF">'+ik('treningssamling')+'Sjusjøen</span>':'')+(s.g?'<span class="t">'+tidT(s.g)+'</span><span class="pl">/ '+tidT(s.t)+' plan</span>':'<span class="pl" style="margin:0">Ingen aktivitet · '+tidT(s.t)+' planlagt</span>')+'<span class="k">'+km(s.km)+' km</span><span>'+s.n+' økter</span><span class="zb">'+zb(s.z)+'</span><span class="pz">'+ztekst(s.z)+'</span></div>'}

/* Dagcellens topplinje: samling, dagstatus, nøkkeldato, helse, + */
function dagIkoner(k,mob){var p=periodeFor(k),s='';if(p&&p.samling)s+='<span style="color:#7C5CFF">'+ik('treningssamling')+'</span>';if(HVILE[k])s+='<span style="color:#28A86E">'+ik('helse')+'</span>';if(NOK[k])s+='<span style="color:'+NOK[k].c+'">'+ik(NOK[k].t)+'</span>';if(HELSE(k)&&!mob)s+='<span style="color:#E23A5A">'+ik('helse','f')+'</span>';if(!mob)s+='<span class="pl">'+ik('legg-til')+'</span>';return s}
function pille(o,mob){return'<div class="fv-pille'+(o.ok?'':' plan')+'" style="--c:'+o.c+'"><div class="fv-pt">'+(o.garmin?importBadge():'')+(o.konk?'<span style="color:#D4A017">'+ik(o.konk==='B'?'b-konkurranse':'c-konkurranse')+'</span>':'')+(o.test?'<span style="color:#1A6FD4">'+ik('testlop')+'</span>':'')+(o.ok?hake():'')+'<span class="kl">'+o.kl+'</span><span class="tt">'+o.t+'</span></div><div class="fv-pm">'+metaTekst(o)+'</div>'+kurve(o,mob?18:26)+'</div>'}

/* MÅNED - rutenett */
function analPanel(){var s=sum(OKTER.filter(function(o){return o.dt.slice(5,7)==='09'}));var g=sum(OKTER.filter(function(o){return o.dt.slice(5,7)==='09'&&o.ok}));var plan=0;OKTER.forEach(function(o){if(o.dt.slice(5,7)==='09'&&o.plan)plan+=o.plan});
  return'<div class="fv-anal"><div class="r"><span class="h">▾ Analyse september</span><span class="v">Skjul</span></div><div class="g"><div><small>Total tid</small><b>'+tidT(g.g)+'</b><i>/ '+tidT(s.t)+' plan</i></div><div><small>Km</small><b>'+km(g.km)+'</b><i>▲ 9 % vs. august</i></div><div><small>Økter</small><b>'+g.gt+'</b><i>/ '+s.n+' planlagt</i></div><div><small>Skyting</small>'+skyChip(g.sk,g.sk[1]+plan)+'</div></div><div class="z"><span class="zb">'+zb(g.z)+'</span><span class="pz">'+ztekst(g.z)+'</span></div></div>'}
function rutenett(mob){
  var h=analPanel();
  if(!mob)h+='<div class="fv-ukedager">'+UKED.map(function(d){return'<span>'+d.toUpperCase()+'</span>'}).join('')+'</div>';
  UKER.forEach(function(u){
    h+=pstripe(u,mob)+'<div class="fv-rad">';
    u.dager.forEach(function(d){var k=iso(d),ok=BY[k]||[],ute=d.getMonth()!==8,idag=k===IDAG,s=sum(ok),nk=NOK[k];
      var st='';if(nk)st+='outline:'+(nk.t==='a-konkurranse'?3:2)+'px solid '+nk.c+';outline-offset:-1px;';if(HVILE[k])st+='background:rgba(40,168,110,'+(k>IDAG?'.06':'.12')+');';
      h+='<div class="fv-dag'+(ute?' ute':'')+(idag?' idag':'')+'" data-dag="'+k+'" style="'+st+'"><div class="fv-dh"><b>'+d.getDate()+'</b><i>'+dagIkoner(k,mob)+'</i></div>';
      if(HVILE[k]&&!mob)h+='<div class="fv-pille hvile">Hviledag</div>';
      ok.forEach(function(o){h+=pille(o,mob)});
      if(s.t&&!mob)h+='<div class="fv-dfot"><div class="zb">'+zb(s.z)+'</div><div class="kt"><span>'+(s.km?km(s.km)+' km':'')+'</span><span>'+tidT(s.t)+'</span></div></div>';
      h+='</div>'});
    h+='</div>'+ukestripe(u,mob)});
  return h;}

/* MÅNED - liste (samme DOM på PC og mobil, MobileWorkoutPill) */
function liste(mob){
  var h=analPanel()+'<div class="fv-liste">';
  UKER.forEach(function(u){var sp=periodeFor(iso(u.dager[3]));
    h+='<div class="fv-lu"><div class="fv-lu-h"><span>Uke '+u.nr+'</span>'+(sp&&sp.samling?'<span class="chip" style="color:#7C5CFF">'+ik('treningssamling')+' Samling Sjusjøen</span>':'')+'</div><div class="fv-lu-g"><div class="fv-lu-pk">'+u.dager.map(function(d){var p=periodeFor(iso(d));return'<i style="background:'+(p?'color-mix(in srgb,'+BEL[p.b]+' 58%,transparent)':'transparent')+'" title="'+(p?p.n:'')+'"></i>'}).join('')+'</div><div>';
    var tomme=[];
    u.dager.forEach(function(d){var k=iso(d),ok=BY[k]||[],idag=k===IDAG;if(d.getMonth()!==8)return;
      if(!ok.length&&k<IDAG&&!HVILE[k]){tomme.push(d);return}
      if(tomme.length){h+='<div class="fv-dr tom"><div class="fv-db"></div><div class="fv-dri">'+(tomme.length>1?tomme.length+' dager uten økter - trykk for å utvide':UKEDL[(tomme[0].getDay()+6)%7]+' '+tomme[0].getDate()+'. ingen økter')+'</div></div>';tomme=[]}
      h+='<div class="fv-dr'+(ok.length?'':' tom')+(idag?' idag':'')+'" data-dag="'+k+'"><div class="fv-db"><small>'+UKED[(d.getDay()+6)%7]+'</small><b>'+d.getDate()+'</b><span class="ik">'+(NOK[k]?'<span style="color:'+NOK[k].c+'">'+ik(NOK[k].t)+'</span>':'')+(HVILE[k]?'<span style="color:#28A86E">'+ik('helse')+'</span>':'')+(HELSE(k)?'<span class="hp">●</span>':'')+'</span></div><div class="fv-dri">';
      if(!ok.length)h+=HVILE[k]?'Hviledag':'Ingen økter';
      ok.forEach(function(o){h+='<div class="fv-mp'+(o.ok?'':' plan')+'" style="--c:'+o.c+'"><div class="r1">'+(o.ok?hake():'')+(o.garmin?importBadge():'')+(o.konk?'<span style="color:#D4A017">'+ik(o.konk==='B'?'b-konkurranse':'c-konkurranse')+'</span>':'')+'<span class="kl">'+o.kl+'</span><span class="tt">'+o.t+'</span><span class="dur">'+tidT(o.dur)+'</span></div>'+kurve(o,22)+'</div><div class="fv-mpm">'+metaTekst(o).replace(/<b>.*?<\/b> ?/,'')+'</div>'});
      h+='</div><span class="pl">'+ik('legg-til')+'</span></div>'});
    if(tomme.length)h+='<div class="fv-dr tom"><div class="fv-db"></div><div class="fv-dri">'+tomme.length+' dager uten økter</div></div>';
    h+='</div></div>'+ukestripe(u,mob)+'</div>'});
  return h+'</div>';}

/* UKE (UkeVisning) */
var VALGT='2026-09-15';
function detaljGraf(o){var c=oktgrafOppsett(o);c.still=true;c.chips=false;c.knapper=false;c.mob=true;c.PH=76;c.TOPP=72;c.akse=3;c.klasse='fv-og fv-og-liten';
  return tegnOktgraf(c)}
/* Settgrafen - SAMME utlegg som appens settrad (lib/styrke-graf.leggUtSett + components/workout/StyrkeRad, styrke bolk 4):
   sett som blokker i styrkegrått (aldri sonefarger), høyde = kg mot maks kg, bredde = tid etter enhetene
   sett 2,2 / hvile 0,8 / mellomrom 1,2, tallet i blokka = reps, kg-etikett nederst når blokka er høy nok,
   hvile i pausegrå, øvelsen som klamme under, kroppsvekt = fast lav høyde (0,2), gull ring = PR i settet.
   HTML-blokker, ikke SVG: tallene skal ikke strekkes. Forside-illustrasjon - data fra STYRKE_SETT. */
var SG_GRAA='#6E6E78',SG_HVILE='#43434B',SG_GULL='#D4A017',SG_FONT="'Barlow Condensed',sans-serif";
function styrkeGraf(o){var H=64,BUNN=22,ES=2.2,EH=0.8,EO=1.2,ov=o.sett,maks=0,tot=0,n=0;
  ov.forEach(function(e){e[1].forEach(function(st){maks=Math.max(maks,st[1]);n++});tot+=e[1].length*ES+Math.max(0,e[1].length-1)*EH});tot+=Math.max(0,ov.length-1)*EO;
  var pct=function(u){return (u/tot*100).toFixed(3)+'%'},t=0,s='';
  s+='<span style="position:absolute;left:0;top:-14px;font-family:'+SG_FONT+';font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--a-mut);white-space:nowrap">Styrke · '+n+' sett</span>';
  s+='<div style="position:absolute;left:0;width:100%;top:0;height:'+H+'px;border-radius:4px;background:'+SG_GRAA+'24;border:1px solid '+SG_GRAA+'"></div>';
  ov.forEach(function(e,oi){var fra=t;e[1].forEach(function(st,i){var kg=st[1],reps=st[0],andel=kg>0&&maks>0?Math.max(.12,kg/maks):.2,h=Math.max(8,Math.round(andel*H)),pr=e[2]&&i===e[1].length-1;
      s+='<div class="fv-sg-sett" data-pr="'+(pr?1:0)+'" style="position:absolute;left:'+pct(t)+';width:'+pct(ES)+';bottom:'+BUNN+'px;height:'+h+'px;border-radius:3px;background:'+SG_GRAA+';opacity:.92;display:flex;flex-direction:column;align-items:center;justify-content:space-between;overflow:hidden;box-sizing:border-box'+(pr?';outline:1.6px solid '+SG_GULL+';outline-offset:1px':'')+'">'
        +'<span style="font-family:'+SG_FONT+';font-size:10.5px;font-weight:600;color:#F0F0F2;line-height:1;margin-top:2px">'+reps+'</span>'
        +(kg>0&&andel*H>=26?'<span style="font-family:'+SG_FONT+';font-size:9px;color:rgba(255,255,255,.62);line-height:1;margin-bottom:2px">'+String(kg).replace('.',',')+'</span>':'')+'</div>';
      t+=ES;if(i<e[1].length-1){s+='<div class="fv-sg-hvile" style="position:absolute;left:'+pct(t)+';width:'+pct(EH)+';bottom:'+BUNN+'px;height:7px;border-radius:2px;background:'+SG_HVILE+'"></div>';t+=EH}});
    s+='<div class="fv-sg-klamme" style="position:absolute;left:'+pct(fra)+';width:'+pct(t-fra)+';top:'+(H+5)+'px;border-top:1px solid var(--a-mute);text-align:center;font-family:'+SG_FONT+';font-size:10.5px;letter-spacing:.04em;color:var(--a-mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-top:3px">'+e[0]+'</div>';
    if(oi<ov.length-1)t+=EO});
  return'<div class="fv-settgraf" data-sett="'+n+'" style="position:relative;height:'+(H+BUNN)+'px;margin:20px 0 4px">'+s+'</div><div class="fv-graf-ak"><span style="color:'+SG_GULL+'">◯ PR i settet</span><span>hvile</span></div>'}
function oktkort(o){var st=o.sp==='Styrke';
  var nk=o.ok?(st?[['Tonnasje',(Math.round(o.kg/100)/10).toString().replace('.',',')+' t'],['Belastning',o.tss||38],['Opplevd',(o.rpe||6)+'/10'],['Varighet',tidT(o.dur)]]:[['Snittpuls',o.puls||(o.z[3]+o.z[4]+o.z[5]>15?152:134)],['I3-tid',(o.z[3])+' min'],['Belastning',(o.tss||Math.round(o.dur*.8))+' TSS'],['Opplevd',(o.rpe||5)+'/10']])
    :[['Varighet',tidT(o.dur)],['I'+(o.z[5]>=5?5:o.z[4]>=10?4:o.z[3]>=20?3:1)+'-tid',(o.z[5]>=5?o.z[5]:o.z[4]>=10?o.z[4]:o.z[3]>=20?o.z[3]:o.z[1])+' min'],[o.plan?'Skyting':'Distanse',o.plan?o.plan+' skudd':(o.km||0)+' km'],['Distanse',(o.km||0)+' km']];
  var meta=[o.sp,o.uk,tidT(o.dur)];if(o.km)meta.push(o.km+' km');if(o.lak)meta.push('laktat '+o.lak);if(o.sky&&o.ok)meta.push('skyting '+o.sky[0]+'/'+o.sky[1]);if(o.nr)meta.push('standardøkt #'+o.nr);
  return'<div class="fv-ok" style="--c:'+o.c+'"><span class="st '+(o.ok?'g':'p')+'">'+(o.ok?'Gjennomført':'Planlagt · '+o.kl)+'</span><h4>'+o.t+'</h4><div class="me">'+meta.map(function(m){return'<span>'+m+'</span>'}).join('')+(o.garmin?'<span class="kl">'+ik('klokke')+'Garmin</span>':'')+'</div>'
    +(o.ok?(st?styrkeGraf(o):detaljGraf(o)):'<div class="fv-plangraf">'+kurve(o,100)+'</div>')
    +'<div class="nk">'+nk.map(function(n){return'<div><small>'+n[0]+'</small><b>'+n[1]+'</b></div>'}).join('')+'</div><div class="kn">'+(o.ok?'<span class="g">Åpne økt</span><span>Rediger plan</span>':'<span class="b">Logg økta</span><span>Rediger plan</span>'+(st?'<span>Start live</span>':''))+'</div></div>'}
function uke(mob){var u=UKER[2],okt=ukeOkter(u),s=sum(okt),p=periodeFor('2026-09-16'),plan=0;okt.forEach(function(o){if(o.plan)plan+=o.plan});
  var h='<div class="fv-ban" style="--c:'+BEL[p.b]+'"><small>Periode</small><b>'+p.n+'</b><span class="ch">'+p.b+'</span><span class="uav">'+kort(p.fra)+' - '+kort(p.til)+'</span><span class="ml"><span class="nd" style="color:#7C5CFF">'+ik('treningssamling')+'Samling Sjusjøen fra lør</span></span></div>';
  h+='<div class="fv-usum"><b>Uke '+u.nr+'</b><span><em>'+tidT(s.g)+'</em> gjennomført · '+km(s.km)+' km · '+s.n+' økter · <em>'+tidT(s.t)+'</em> plan</span>'+skyChip(s.sk,plan+s.sk[1])+'<span class="zb">'+zb(s.z)+'</span></div>';
  h+=pstripe(u,mob)+'<div class="fv-ikrad">'+u.dager.map(function(d){var k=iso(d),pp=periodeFor(k);return'<span>'+(NOK[k]?'<i style="color:'+NOK[k].c+'">'+ik(NOK[k].t)+'</i>':'')+(pp&&pp.samling&&k===pp.fra?'<i style="color:#D4A017">'+ik('treningssamling')+'</i>':'')+'</span>'}).join('')+'</div>';
  h+='<div class="fv-kol">';
  u.dager.forEach(function(d){var k=iso(d),ok=BY[k]||[],idag=k===IDAG;
    h+='<div class="fv-k'+(idag?' idag':'')+(k===VALGT?' valgt':'')+'" data-dag="'+k+'"><small>'+UKED[(d.getDay()+6)%7].toUpperCase().slice(0,2)+'</small><b>'+d.getDate()+'</b>';
    ok.forEach(function(o){var lys=o.c==='#E8B93C'||o.c==='#D4A017';h+='<div class="fv-kc '+(o.ok?'ok':'plan')+(lys?' lys':'')+'" style="--c:'+o.c+'"><div class="t">'+o.t+'</div><div class="m">'+o.sp+' · '+tidT(o.dur)+'</div></div>'});
    h+='<div class="n">'+(ok.length?ok.length+' økt'+(ok.length>1?'er':''):(HVILE[k]?'Hviledag':''))+'</div></div>'});
  h+='</div>';
  var vd=dato(VALGT),vo=BY[VALGT]||[];
  h+='<div class="fv-dd"><div class="fv-dd-h"><i></i><b>'+UKEDL[(vd.getDay()+6)%7]+' '+vd.getDate()+'. '+MNDK[vd.getMonth()]+'</b><span>'+(vo.length?vo.length+' økt'+(vo.length>1?'er':'')+' · '+tid(vo.reduce(function(a,o){return a+o.dur},0)):'ingen økter')+'</span><span class="legg">+ Legg til økt</span></div><div class="fv-dd-g">'+vo.map(oktkort).join('')+'</div></div>';
  return h;}

/* ÅR (Calendar.tsx:2464-2646): statstripe, soner, 12 månedsfliser */
var AAR=[['jan',52,412,29,[.62,.2,.08,.06,.04],['NC Lillehammer','NM sprint'],[180,200]],['feb',50,388,28,[.6,.2,.09,.07,.04],['NM normal','NC Sjusjøen'],[176,200]],['mar',47,360,26,[.6,.22,.08,.06,.04],['NM del 2','Holmenkollen'],[168,190]],['apr',29,190,16,[.85,.1,.03,.02,0],['Sesongslutt'],[40,60]],['mai',43,410,24,[.78,.15,.04,.03,0],['Oppstart'],[110,150]],['jun',55,520,30,[.72,.18,.05,.03,.02],['Samling Sognefjellet'],[290,340]],['jul',58,560,32,[.7,.18,.06,.04,.02],[],[300,340]],['aug',55,530,30,[.7,.18,.06,.04,.02],['Blink'],[330,380]],['sep',0,0,0,null,['NC sprint','NC jaktstart','Samling Sjusjøen'],null],['okt',54,0,0,[.62,.2,.09,.06,.03],['Høydesamling 10 d'],null],['nov',48,0,0,[.55,.2,.12,.09,.04],['NC Sjusjøen'],null],['des',42,0,0,[.5,.2,.14,.1,.06],['NC Simostranda'],null]];
function aar(mob){var sep=sum(OKTER.filter(function(o){return o.dt.slice(5,7)==='09'&&o.ok}));var t=0,k=0,n=0,sk=[0,0];AAR.forEach(function(m){if(m[4]&&m[3]){t+=m[1];k+=m[2];n+=m[3];if(m[6]){sk[0]+=m[6][0];sk[1]+=m[6][1]}}});t+=sep.g/60;k+=sep.km;n+=sep.gt;sk[0]+=sep.sk[0];sk[1]+=sep.sk[1];
  var zt=[0,0,0,0,0];AAR.forEach(function(m){if(m[4]&&m[3])m[4].forEach(function(v,i){zt[i]+=v*m[1]})});['1','2','3','4','5'].forEach(function(q,i){zt[i]+=sep.z[q]/60});var zs=zt.reduce(function(a,b){return a+b},0);
  var h='<div class="fv-aar-stat"><div><small>Total tid</small><b>'+Math.round(t)+'t<em>▲ 6 % vs. 2025</em></b></div><div><small>Km</small><b>'+Math.round(k).toLocaleString('nb-NO')+'<em>▲ 4 %</em></b></div><div><small>Økter</small><b>'+n+'<em>▲ 11</em></b></div><div><small>Konkurranser</small><b>9<em style="color:var(--a-mute)">▬ 0</em></b></div></div>';
  h+='<div class="fv-aar-rad">'+skyChip(sk,sk[1])+'<span class="cap">Soner 2026</span></div><div class="fv-aar-zb">'+zt.map(function(v,i){return'<i style="flex:'+v+';background:'+Z[i+1]+'"></i>'}).join('')+'</div><div class="fv-aar-leg">'+zt.map(function(v,i){return'<span><i style="background:'+Z[i+1]+'"></i>I'+(i+1)+' '+Math.round(v)+'t · '+Math.round(v/zs*100)+' %</span>'}).join('')+'</div><div class="fv-sp">'+['Rulleski','Løping','Sykkel','Styrke','Skyting','Elghufs'].map(function(s){return'<span>'+s+'</span>'}).join('')+'</div>';
  h+='<div class="fv-aar">';AAR.forEach(function(m){var erSep=m[0]==='sep',tom=!erSep&&!m[3],tt=erSep?sep.g/60:m[1],kk=erSep?sep.km:m[2],nn=erSep?sep.gt:m[3];var z=erSep?['1','2','3','4','5'].map(function(q){return sep.z[q]}):m[4];var zsum=z.reduce(function(a,b){return a+b},0)||1;
    h+='<div class="fv-am'+(tom?' tom':'')+'"><small>'+m[0]+'</small><b>'+(tom?m[1]+'t':Math.round(tt)+'t')+'</b><span class="km">'+(tom?'planlagt':Math.round(kk)+' km')+'</span><span class="ok">'+(tom?'':nn+' økter')+'</span><div class="zb">'+z.map(function(v,j){return'<i style="flex:'+v+';background:'+Z[j+1]+(tom?';opacity:.45':'')+'"></i>'}).join('')+'</div><span class="zt">I1-2 '+Math.round((z[0]+z[1])/zsum*100)+' %</span>'+(erSep&&sep.sk[1]?skyChip(sep.sk,sep.sk[1]):m[6]?skyChip(m[6],m[6][1]):'')+(m[5].length?'<div class="fv-sp">'+m[5].slice(0,3).map(function(s){return'<span>'+s+'</span>'}).join('')+'</div>':'')+'</div>'});
  return h+'</div>';}

/* Helsedata per dag (deterministisk, bare til og med i dag) */
function helse(k){var n=parseInt(k.slice(8),10)+parseInt(k.slice(5,7),10)*3,r=function(i){return((n*37+i*11)%17)/17};return{hp:48+Math.round(r(1)*7),hrv:62+Math.round(r(2)*18),sov:390+Math.round(r(3)*90),fol:3+Math.round(r(4)*2),faser:[.22+r(5)*.08,.48-r(5)*.05,.22,.08]}}
var AAPEN=null;
/* Okta (o) -> oppsettet den felles oktgraf-tegneren (oktgraf.js) vil ha.
   Blokkene er PlanGraf-blokkene [sone, minutter]; pulsen er den samme
   deterministiske kurven som pillene i kalenderen bruker (puls(o)), sa
   grafen i dagen kan ikke sprike fra pillen. */
function oktgrafOppsett(o){var BL=[],m=0,skyN=0,skyAnt=o.bl.filter(function(b){return b[0]==='P'}).length;
  var mon=(o.uk||'').indexOf('L-S')>-1||(!!o.sky&&skyAnt>0);
  o.bl.forEach(function(b,i){var z=b[0],t;if(z==='P')t=mon?'sky':'pause';else if(z===1&&i===0)t='oppv';else if(z===1&&i===o.bl.length-1)t='ned';else t='drag';
    var e=m+b[1],bl={t:t,z:typeof z==='number'?'I'+z:'I1',s:m,e:e};if(t==='sky'){bl.ls=(skyN++)%2?'S':'L'}BL.push(bl);m=e});
  var pts=puls(o);function pulsVed(mm){var i=Math.max(0,Math.min(pts.length-1,Math.round(mm)));return pts[i]}
  var P=[];
  if(o.sky&&mon&&skyAnt){var tr=[],rest=o.sky[0],per=o.sky[1]/skyAnt,k=0;for(var i=0;i<skyAnt;i++){var t=Math.round(Math.min(per,rest-(skyAnt-1-i)*(per-1)));tr.push(t);rest-=t}
    BL.forEach(function(b){if(b.t!=='sky')return;P.push({m:(b.s+b.e)/2,k:'skyting',c:'var(--a-mut)',tx:b.ls+' '+tr[k]+'/'+per,grp:'sky',niv:k%2});k++})}
  if(o.lak){var fin=parseFloat(String(o.lak).replace(',','.')),harde=BL.filter(function(b){return b.t==='drag'&&+b.z.slice(1)>=3}),n2=harde.length;
    /* Som fasitens scene 7: pille pa forste og siste harde drag (2,8 -> 4,6) -
       fem piller pa nitten minutter overlapper hverandre. */
    harde.forEach(function(b,i){if(i!==0&&i!==n2-1)return;var v=(fin-(n2-1-i)*(n2>3?.45:.7)).toFixed(1).replace('.',',');P.push({m:b.e-.5,k:'laktat',c:'#E23A5A',tx:v,grp:'lak',niv:2})})}
  if(o.ok&&(o.konk||o.dur>=150))P.push({m:o.konk?4:Math.round(o.dur*.35),k:'ernaering',c:'#28A86E',tx:o.konk?'1 gel':'40 g',grp:'ern',niv:1});
  return{blokker:BL,tot:o.dur,pulsVed:pulsVed,punkter:P}}
function popGraf(o){var c=oktgrafOppsett(o);c.still=true;c.chips=false;c.knapper=false;c.PH=110;c.TOPP=84;c.kilde=o.garmin?'Garmin':'';c.klasse='fv-og';
  return'<div class="pkg">'+tegnOktgraf(c)+'</div>'}
function ernaering(o){if(!o.ok)return'';if(o.konk)return'<div class="ern"><span class="cap">'+ik('ernaering')+'Ernæring</span><span>1 gel før start</span><span>250 ml sportsdrikk</span><span>40 g karbo</span></div>';if(o.dur>=150)return'<div class="ern"><span class="cap">'+ik('ernaering')+'Ernæring</span><span>'+Math.round(o.dur/45)+' gel</span><span>'+Math.round(o.dur/60*500)+' ml sportsdrikk</span><span>'+(o.dur>=180?68:62)+' g karbo/t</span></div>';if(o.uk.indexOf('L-S')>-1||o.uk.indexOf('skyting')>-1)return'<div class="ern"><span class="cap">'+ik('ernaering')+'Ernæring</span><span>1 gel</span><span>500 ml sportsdrikk</span><span>55 g karbo/t</span></div>';return''}
function popKort(o){var stats=[];if(o.km)stats.push(km(o.km)+' km');if(o.ok&&o.garmin){stats.push('Snitt '+(o.puls||(o.z[3]+o.z[4]+o.z[5]>15?149:133))+' bpm');stats.push('Maks '+(o.z[5]>=5?189:o.z[4]>=10?181:o.z[3]>=20?174:158)+' bpm')}if(o.ok&&o.rpe)stats.push('RPE '+o.rpe);if(o.ok&&o.kg)stats.push((Math.round(o.kg/100)/10).toString().replace('.',',')+' t tonnasje');if(o.lak)stats.push(ik('laktat')+'Laktat '+o.lak);
  return'<div class="fv-pk'+(o.ok?'':' plan')+'" style="--c:'+o.c+'"><div class="l1">'+(o.ok?hake():'')+(o.garmin?importBadge():'')+(o.konk?'<span style="color:#D4A017">'+ik(o.konk==='B'?'b-konkurranse':'c-konkurranse')+'</span>':'')+'<span class="kl">'+o.kl+'</span><span class="tt">'+o.t+'</span>'+(o.plass?'<em style="color:'+o.c+'">#'+o.plass+'</em>':'')+'<span class="hoyre">'+(o.ok?'':'<span class="pl">Plan</span>')+'<b>'+tidT(o.dur)+'</b></span></div><div class="l2">'+o.sp+' · '+o.uk+'</div>'+(o.ok?(o.sett?'<div class="pkg">'+styrkeGraf(o)+'</div>':popGraf(o)):'')+(stats.length?'<div class="l3">'+stats.map(function(x){return'<span>'+x+'</span>'}).join('')+'</div>':'')+'<div class="zb">'+zb(o.z)+'</div>'+(o.sky&&o.ok?'<div class="sk"><span class="cap">'+ik('skyting')+'Skyting</span><b>'+o.sky[0]+'/'+o.sky[1]+'</b><span>'+Math.round(o.sky[0]/o.sky[1]*100)+' % treff</span>'+(o.uk.indexOf('L-S')>-1||o.t.indexOf('komb')>-1?'<span class="lig">L · S · L · S</span>':'')+'</div>':o.plan&&!o.ok?'<div class="sk"><span class="cap">'+ik('skyting')+'Skyting</span><b>'+o.plan+' skudd</b><span>planlagt</span></div>':'')+ernaering(o)+'</div>'+(o.sp==='Styrke'&&!o.ok?'<div class="fv-live">▶ Start live</div>':'')}
function popup(k,mob){var d=dato(k),ok=BY[k]||[],p=periodeFor(k),fram=k>IDAG,h=k<=IDAG?helse(k):null;
  var s='<div class="fv-pop-scrim" data-lukk="1"></div><div class="fv-pop"><div class="ph"><i></i><b>'+UKEDL[(d.getDay()+6)%7]+' '+d.getDate()+'. '+['januar','februar','mars','april','mai','juni','juli','august','september','oktober','november','desember'][d.getMonth()]+'</b><span class="x" data-lukk="1">'+ik('lukk')+'</span></div>';
  if(p)s+='<div class="chips"><span style="color:'+BEL[p.b]+';border-color:color-mix(in srgb,'+BEL[p.b]+' 33%,transparent)">● '+p.n+(k===p.fra?' · starter i dag':k===p.til?' · slutter i dag':'')+'</span>'+(p.samling?'<span style="color:#D4A017;border-color:rgba(212,160,23,.45)">'+ik('treningssamling')+' Samling · Sjusjøen · 900 moh</span>':'')+'</div>';
  s+='<div class="okter">'+(ok.length?ok.map(popKort).join(''):'<div class="tom">Ingen økter</div>')+'</div>';
  if(h){var sv=tidT(h.sov);s+='<div class="fv-hk"><div class="hh"><span class="strek"></span><b>Helse</b><span class="natt">'+ik('klokke')+' i natt</span><span class="apne">åpne '+ik('apne-fane')+'</span></div><div class="hg"><div><small>Hvilepuls</small><b>'+h.hp+'</b><i>snitt 52</i></div><div><small>HRV</small><b>'+h.hrv+'</b><i>snitt 70</i></div><div><small>Søvn</small><b>'+sv+'</b><i>score '+(70+Math.round(h.hrv/4))+'</i></div><div><small>Følelse</small><b>'+h.fol+'<span>/5</span></b><i>'+(k===IDAG?'+ før i dag':'ført')+'</i></div></div><div class="sovn">'+h.faser.map(function(f,i){return'<i style="flex:'+f+';background:'+['#1A6FD4','#38BDF8','#8B5CF6','#E8B93C'][i]+'"></i>'}).join('')+'</div><div class="hf"><span class="r">Rediger føring</span><span class="m">Vis mer '+ik('apne-fane')+'</span></div></div>'}
  if(HVILE[k])s+='<div class="fv-ds" style="--c:#28A86E">'+ik('hviledag','f')+'<b>'+(fram?'Planlagt hviledag':'Hviledag')+'</b><span>aktiv hvile · Følelse '+(h?h.fol:4)+'/5</span><em>Rediger</em></div>';
  s+='<div class="knapper"><span class="prim">'+ik('legg-til','s')+(fram?'Planlegg':'Logg')+'</span><span>'+ik('hviledag','f','color:#28A86E')+'Hviledag</span><span>'+ik('reisedag','f','color:#5B8DEF')+'Reisedag</span><span>'+ik('treningssamling','f','color:#7C5CFF')+'Samling</span>'+(fram?'':'<span>'+ik('sykdom','f','color:#E11D48')+'Syk</span><span>'+ik('skade','f','color:#FF8C00')+'Skade</span>')+(h?'':'<span>'+ik('helse','f','color:#E23A5A')+'Helse</span>')+(fram?'':'<span>'+ik('recovery','f','color:#28A86E')+'Recovery</span>')+'</div></div>';
  return s}

/* Rammer */
var STATE={vis:'pc',pc:{visning:'maned',modus:'grid'},mob:{visning:'maned',modus:'liste'}};
function seg(items,on,cls,attr){return'<div class="fv-seg '+(cls||'')+'">'+items.map(function(it){return'<span class="'+(it[0]===on?'on':'')+'" data-'+attr+'="'+it[0]+'">'+(it[2]?ik(it[2]):'')+(it[1]||'')+'</span>'}).join('')+'</div>'}
function kalhode(st,mob){
  var lbl=st.visning==='uke'?'Uke 38 · 14. sep - 20. sep 2026':st.visning==='aar'?'2026':'September 2026';
  return'<div class="fv-kh"><div class="venstre">'+seg([['uke','Uke'],['maned','Måned'],['aar','År']],st.visning,'','vis')+(st.visning==='maned'?seg([['grid','','arsplan'],['liste','','hamburgermeny']],st.modus,'ik','modus'):'')+'</div><div class="fv-nav2"><i>'+ik('forrige')+'</i><b>'+lbl+'</b><i>'+ik('neste')+'</i></div>'+(mob?'':'<div class="hoyre"></div>')+'</div>'}
function innhold(st,mob){return st.visning==='uke'?uke(mob):st.visning==='aar'?aar(mob):st.modus==='grid'?rutenett(mob):liste(mob)}
function logo(){return'<svg viewBox="-93 -132 1450 1450" aria-hidden="true"><g transform="translate(86,0) skewX(-8)"><path d="M62 125 L362 125 L1231 1068 L931 1068 Z" fill="currentColor"/><path d="M906 117 L1194 117 L850 510 L710 371 Z" fill="currentColor"/><path d="M132 331 L556 777 L279 1073 L61 1073 L349 706 Z" fill="#FF4500"/></g></svg>'}
var NAV=[['hjem','Hjem'],['plan','Plan'],['dagbok','Dagbok',1],['analyse','Analyse'],['maler','Maler']];
function pc(){var st=STATE.pc;
  return'<div class="fv-topp"><div class="fv-tv"><div class="fv-logo">'+logo()+'<b>PULSE</b></div><div class="fv-nav">'+NAV.map(function(n){return'<span class="'+(n[2]?'on':'')+'">'+ik(n[0])+n[1]+'</span>'}).join('')+'</div></div><div class="fv-th"><span class="fv-synk">'+ik('synk')+'SYNK</span><div class="fv-rolle"><span class="on">Utøver</span><span>Trener</span></div><span class="fv-avat">O</span></div></div>'
  +'<div class="fv-body"><div class="fv-hils"><small>God dag</small><b>Ola</b></div><div class="fv-h2"><i></i>Kalender</div><div class="fv-kort">'
  +kalhode(st)+'<div class="fv-inn '+(st.visning==='maned'?(st.modus==='grid'?'fv-g':'fv-l'):st.visning==='uke'?'fv-u':'fv-a')+'">'+innhold(st)+'</div></div></div>'+(AAPEN?popup(AAPEN):'')}
function mob(){var st=STATE.mob,m=st.visning==='maned'?(st.modus==='grid'?'fv-mg':'fv-ml'):st.visning==='uke'?'fv-mu':'fv-ma';
  return'<div class="fv-tlf"><div class="fv-sk"><div class="fv-sl"><span>09:41</span><span>●●● ᯤ ▮</span></div><div class="fv-glass"><span class="x">'+logo()+'</span><span class="mid">'+ik('dagbok')+'<span><b>Dagbok</b><small>uke 38</small></span></span><span class="fv-synk">'+ik('synk')+'SYNK</span><span class="fv-avat">O</span></div>'
  +'<div class="fv-mbody"><div class="fv-hils"><small>God dag</small><b>Ola</b></div><div class="fv-h2"><i></i>Kalender</div><div class="fv-kort"><div class="fv-mhode">'+kalhode(st,1)+'</div><div class="fv-inn '+m+'">'+innhold(st,1)+'</div></div></div>'
  +'<div class="fv-bunn">'+[['hjem','Hjem'],['plan','Plan'],['dagbok','Dagbok',1],['analyse','Analyse'],['mer','Mer']].map(function(n){return'<span class="'+(n[2]?'on':'')+'">'+ik(n[0],n[2]?'f':'s')+n[1]+'</span>'}).join('')+'</div><span class="fv-plus">'+ik('legg-til')+'</span>'+(AAPEN?popup(AAPEN,1):'')+'</div></div>'}

var BEHOLD=false;
function tegn(){var p=document.getElementById('fv-pc'),m=document.getElementById('fv-mob');var sp=p&&p.querySelector('.fv-inn')?p.querySelector('.fv-inn').scrollTop:0,sm=m&&m.querySelector('.fv-mbody')?m.querySelector('.fv-mbody').scrollTop:0;if(p)p.innerHTML=pc();if(m)m.innerHTML=mob();
  if(BEHOLD){if(p&&p.querySelector('.fv-inn'))p.querySelector('.fv-inn').scrollTop=sp;if(m&&m.querySelector('.fv-mbody'))m.querySelector('.fv-mbody').scrollTop=sm}
  document.querySelectorAll('.fv-visbryter button').forEach(function(b){b.classList.toggle('on',b.dataset.v===STATE.vis)});
  var st=STATE[STATE.vis];document.querySelectorAll('.fv-ytre [data-yvis]').forEach(function(b){b.classList.toggle('on',b.dataset.yvis===st.visning)});document.querySelectorAll('.fv-ytre [data-ymodus]').forEach(function(b){b.classList.toggle('on',b.dataset.ymodus===st.modus)});var ym=document.getElementById('fv-ymodus');if(ym)ym.style.visibility=st.visning==='maned'?'':'hidden';
  if(p)p.style.display=STATE.vis==='pc'?'':'none';if(m)m.style.display=STATE.vis==='mob'?'':'none';
  if(!BEHOLD)[p&&p.querySelector('.fv-inn'),m&&m.querySelector('.fv-mbody')].forEach(function(r){if(!r)return;var d=r.querySelector('.fv-dag.idag,.fv-dr.idag');if(!d){r.scrollTop=0;return}
    var rad=d.closest('.fv-rad')||d.closest('.fv-lu'),mal=rad.previousElementSibling&&rad.previousElementSibling.classList.contains('fv-pstripe')?rad.previousElementSibling:rad;
    var hode=r.querySelector('.fv-mhode');var top=mal.getBoundingClientRect().top-r.getBoundingClientRect().top+r.scrollTop;var ud=r.querySelector('.fv-ukedager');r.scrollTop=Math.max(0,top-(hode?hode.offsetHeight+10:(ud?ud.offsetHeight:0)+6))})}
document.addEventListener('click',function(e){
  /* RETTELSE MOT UTKASTET (16. sep): alle tre pillegruppene over rammen deler
     klassen .fv-visbryter, sa Uke/Maned/Ar og Kalender/Liste traff ogsa denne
     grenen og satte STATE.vis til undefined («Cannot read properties of
     undefined (reading 'visning')»). Bare PC/Mobil-knappene har data-v. */
  var b=e.target.closest('.fv-visbryter button');if(b&&b.dataset.v){STATE.vis=b.dataset.v;AAPEN=null;tegn();return}
  var y=e.target.closest('.fv-ytre button');if(y){var s0=STATE[STATE.vis];if(y.dataset.yvis)s0.visning=y.dataset.yvis;else if(y.dataset.ymodus)s0.modus=y.dataset.ymodus;AAPEN=null;tegn();return}
  if(e.target.closest('[data-lukk]')){AAPEN=null;BEHOLD=true;tegn();BEHOLD=false;return}
  if(e.target.closest('.fv-pop'))return;
  var dg=e.target.closest('.fv-dag,.fv-dr');if(dg&&dg.dataset.dag&&!dg.classList.contains('ute')){AAPEN=dg.dataset.dag;BEHOLD=true;tegn();BEHOLD=false;return}
  var s=e.target.closest('.fv-seg span');if(s){var st=e.target.closest('#fv-mob')?STATE.mob:STATE.pc;if(s.dataset.vis){st.visning=s.dataset.vis}else if(s.dataset.modus){st.modus=s.dataset.modus}else return;AAPEN=null;tegn();return}
  var k=e.target.closest('.fv-k');if(k){VALGT=k.dataset.dag;BEHOLD=true;tegn();BEHOLD=false}
});
/* «i»-knappen under ramma: trykk = apne/lukke (hover og fokus gar via CSS). */
document.addEventListener('click',function(e){var i=e.target.closest('.fv-info');var w=document.querySelector('.fv-info-wrap');if(!w)return;if(i){var ap=w.classList.toggle('apen');i.setAttribute('aria-expanded',ap?'true':'false')}else if(!e.target.closest('.fv-info-wrap')){w.classList.remove('apen');var k=w.querySelector('.fv-info');if(k)k.setAttribute('aria-expanded','false')}});
function start(){if(window.matchMedia('(max-width:900px)').matches)STATE.vis='mob';if(document.getElementById('fv-pc')||document.getElementById('fv-mob'))tegn()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
/* v3 scrolly (17. sep): motoren i scrolly.js tegner med disse. sett() setter tilstanden FØR pc()/mob(). */
window.FV={tegn:tegn,STATE:STATE,OKTER:OKTER,
  r:{pc:pc,mob:mob,sett:function(o){if(o.aapen!==undefined)AAPEN=o.aapen;if(o.valgt)VALGT=o.valgt;if(o.mob)Object.assign(STATE.mob,o.mob);if(o.pc)Object.assign(STATE.pc,o.pc)}}};
})();
