/* #tflyt «HELE TROPPEN. ETT PANEL.» - scenene. Kilde: <script> i
   design/xpulse-trener-bolk-design.html (16. sep 2026). Samme motor
   (karusell.js), samme okta og puls (delt der), ikonene fra ikoner.js.
   Fem scener i fem kapitler: Planlegg for gruppa · Folg opp i okta ·
   Sammenlign · Troppen · Utoveren eier. Trener Kari, utoverne Ola, Mari,
   Jonas, Emma, Sander, Ida, Even, Nora. Tekstene er rettet mot koden og
   star som i utkastet: ingen «lav recovery», ingen «varsler ved hoy
   belastning», «Hard I3+», «sonene lest mot egne terskler», 8 er ikke en
   grense.

   Kort 5: de tre nye bryterne («Kan redigere dagboken», «... soner og
   terskler», «... utstyr og skitester») vises som vanlige brytere, av som
   standard (Sverre 16. sep: bolken «trener redigerer utoverdata» kommer
   sa snart uansett - fase 131a er skrevet). */

var KAP3=[{n:'Planlegg for gruppa',ik:'maler'},{n:'Følg opp i økta',ik:'innboks'},{n:'Sammenlign',ik:'analyse'},{n:'Troppen',ik:'trener'},{n:'Utøveren eier',ik:'las'}];
var SC3=[];
var UT=[['Ola','Skiskyting · U23','OL'],['Mari','Skiskyting · senior','MA'],['Jonas','Langrenn · U23','JO'],['Emma','Skiskyting · junior','EM'],['Sander','Langrenn · senior','SA'],['Ida','Skiskyting · U23','ID'],['Even','Løping · senior','EV'],['Nora','Skiskyting · junior','NO']];
function av(u,st){return'<span class="t-av" style="'+(st||'')+'">'+u[2]+'</span>'}
function trykk3(S,sel){var k=S.q(sel);if(!k)return;k.classList.add('trykk');setTimeout(function(){k.classList.remove('trykk')},220)}
function zs(a){var f=['#28A86E','#1A6FD4','#E8B93C','#FF8C00','#E23A5A'];return'<span class="t-zs">'+a.map(function(v,i){return'<i style="flex:'+v+';background:'+f[i]+'"></i>'}).join('')+'</span>'}

/* ── T1 · PUSH TIL GRUPPA ── */
var MALRAD=[['Man','Langtur 2t I1','#28A86E'],['Tir','3 × 10 min I3 + skyting','#E8B93C'],['Tir','Styrke','#6E6E78'],['Ons','Rolig 1t 15','#28A86E'],['Tor','4 × 5 min I4','#FF8C00'],['Fre','Rolig 45 min','#28A86E'],['Søn','Langtur 2t 30','#28A86E']];
SC3.push({kap:0,tittel:'ÉN MAL. HELE GRUPPA.',tekst:'Lag uka én gang som plan-mal. Velg gruppa, trykk push - og hver utøver får uka inn i sin egen plan, med sonene lest mot egne terskler.',
 steg:['Velg plan-malen','Velg gruppe og utøvere','Push - hver får sin plan'],varighet:9500,
 mer:['Fire faner under Planlegg: Øktmaler, Plan-maler, Årsplan-maler og Test-maler - alle kan pushes til én, flere eller en hel gruppe.','Startdatoen skalerer planen: er utøverens vindu kortere eller lengre enn malens, flyttes dagene lineært.','Fellestrening: én økt til hele gruppa i ett trykk, merket som fellestrening i alles kalender - og treneren melder oppmøte.','Grupper med roller (admin, trener, utøver), redigerbare når som helst. Utøveren får varsel med lenke rett inn i planen.','Trener Basic: inntil 10 utøvere. Trener Pro: ubegrenset, med fem Athlete Pro-lisenser inkludert.'],
 html:function(){return'<div class="app t-app t-push"><div class="t-nav">'+['Hjem','Planlegg','Kalender','Utøvere','Sammenligne'].map(function(n,i){return'<span class="'+(i===1?'on':'')+'">'+n+'</span>'}).join('')+'</div>'+
  '<div class="t-faner">'+['Øktmaler','Plan-maler','Årsplan-maler','Test-maler'].map(function(n,i){return'<span class="pil'+(i===1?' fylt':'')+'">'+n+'</span>'}).join('')+'</div>'+
  '<div class="t-to"><div class="t-mal"><span class="cap" style="color:var(--blue)">Plan-mal · 7 dager</span><b class="bebas">Grunntrening 2 · Uke B</b><small>7 økter · 9t 05min · 2 hardøkter · 1 skyting</small>'+MALRAD.map(function(r){return'<div class="t-mr"><i style="background:'+r[2]+'"></i><span>'+r[0]+'</span>'+r[1]+'</div>'}).join('')+'<span class="pil fylt t-pushk">'+ik('trener','s')+'Push til utøvere</span></div>'+
  '<div class="t-modal a"><div class="t-mh"><b class="bebas">Push «Grunntrening 2 · Uke B»</b><span class="x">×</span></div><span class="cap">Grupper</span><div class="t-grp"><span class="pil t-g">'+ik('fellestrening','s')+'Skiskyting U23 · 5</span><span class="pil t-g2">Langrenn · 2</span></div><div class="t-uh"><span class="cap">Utøvere</span><small class="t-valgt">0/8 valgt</small></div><div class="t-ul">'+UT.map(function(u,i){return'<div class="t-ur" data-i="'+i+'"><i class="t-cb"></i>'+av(u)+'<span class="nm">'+u[0]+'<small>'+u[1]+'</small></span><span class="t-ok">'+HAKE+' i planen</span></div>'}).join('')+'</div><div class="t-mf"><span>Start <b>man 21. sep</b></span><span class="pil fylt t-pushn">Push til <b class="t-ant">0</b></span></div></div></div>'+
  '<div class="t-toast pop">'+ik('innboks','s')+'<span><b>8 varsler sendt</b> · «Ny plan fra Kari: Grunntrening 2 · Uke B»</span></div></div>'},
 spill:function(S){S.steg(0,200);S.til('.t-mal .bebas',500);S.til('.t-pushk',1500,true);S.t(1900,function(){trykk3(S,'.t-pushk');S.q('.t-modal').classList.add('inn')});S.steg(1,2300);
  S.til('.t-g',2900,true);S.t(3300,function(){trykk3(S,'.t-g');S.q('.t-g').classList.add('fylt')});
  [0,1,3,5,7].forEach(function(i,j){S.t(3400+j*180,function(){S.q('[data-i="'+i+'"] .t-cb').classList.add('on');var n=S.qa('.t-cb.on').length;S.q('.t-valgt').textContent=n+'/8 valgt';S.q('.t-ant').textContent=n})});
  S.til('.t-g2',4500,true);S.t(4900,function(){trykk3(S,'.t-g2');S.q('.t-g2').classList.add('fylt')});
  [2,4].forEach(function(i,j){S.t(5000+j*180,function(){S.q('[data-i="'+i+'"] .t-cb').classList.add('on');var n=S.qa('.t-cb.on').length;S.q('.t-valgt').textContent=n+'/8 valgt';S.q('.t-ant').textContent=n})});
  S.til('[data-i="6"] .t-cb',5500,true,300);S.t(5800,function(){S.q('[data-i="6"] .t-cb').classList.add('on');S.q('.t-valgt').textContent='8/8 valgt';S.q('.t-ant').textContent='8'});
  S.steg(2,6000);S.til('.t-pushn',6200,true);S.t(6600,function(){trykk3(S,'.t-pushn')});
  UT.forEach(function(_,i){S.t(6800+i*160,function(){S.q('[data-i="'+i+'"]').classList.add('ok')})});
  S.bort(7200);S.t(8300,function(){S.q('.t-toast').classList.add('inn')});S.steg(3,9000)}
});

/* ── T2 · KOMMENTER I ØKTA ── */
var KOM_T='Drag 3 lå 6 slag over de to første - legg deg på 165 neste gang, det er nok. Skytinga: ta 2 s ekstra på liggende, bommene er tidsbommer.';
/* Okta i trener-kortet tegnes av den felles oktgraf-tegneren (oktgraf.js). */
function oktGraf(){return tegnOktgraf({blokker:OKT,tot:TOT,pulsVed:pulsVed,punkter:PUNKT,still:true,chips:false,knapper:false,mob:true,PH:90,TOPP:56,akse:3,klasse:'t-og'})}
SC3.push({kap:1,tittel:'KOMMENTER I ØKTA. IKKE I INNBOKSEN.',tekst:'Trenerens ord ligger på økta, rett under grafen. Utøveren får varsel med lenke rett inn, og svarer på samme sted.',
 steg:['Kommentaren ligger på økta','Utøveren får varsel','Svarer samme sted'],varighet:9500,
 mer:['Kommentarer på økt, dag, uke og måned - i planen, dagboken og årsplanen. Uke- og månedstrådene ligger over kalenderen.','Begge parter får varsel med dyplenke; lest-status vises på kommentaren.','Innboks felles for begge roller: meldingstråder, kommentar-feed og varsler, med uleste-merke i navigasjonen.','Retter treneren i utøverens egen økt, står «endret av trener» på økta - med logg utøveren kan lese.'],
 html:function(){return'<div class="app t-app t-kom"><div class="t-wm"><div class="t-wmh"><span class="cap" style="color:#28A86E">Gjennomført · Garmin</span><b class="bebas">Terskel komb</b><span class="t-eier">'+av(UT[0])+'Ola · tir 15. sep</span></div>'+oktGraf()+'<div class="t-nk"><span><b>152</b> snitt</span><span><b>30</b> min I3-I4</span><span><b>18/20</b> treff</span><span><b>4,6</b> laktat</span></div></div>'+
  '<div class="t-ks"><div class="t-ksh"><span class="strek"></span><span class="cap">Kommentarer · økta</span><small class="t-lest a">Lest av Ola ✓</small></div><div class="t-kb tr a"><span class="chip-t">Trener</span><p class="t-txt"></p><small>Kari · i dag 14:12</small></div>'+
  '<div class="t-varsel pop">'+ik('innboks','s')+'<span><b>Ola</b> · varsel: «Ny kommentar fra Kari på Terskel komb» → åpner økta</span></div>'+
  '<div class="t-kb sv a"><p>Kjente det på drag 3 ja. Prøver 165 torsdag 👍</p><small>Ola · 14:40</small></div>'+
  '<div class="t-skriv"><span class="t-inn"><span class="t-typ"></span><i class="t-cur"></i></span><span class="pil fylt t-send">Send</span></div></div></div>'},
 spill:function(S){S.steg(0,200);S.til('.t-inn',500);var n=KOM_T.length,ms=2600;
  for(var i=1;i<=n;i+=3){(function(i){S.t(800+i/n*ms,function(){S.q('.t-typ').textContent=KOM_T.slice(0,i)})})(i)}
  S.t(800+ms+50,function(){S.q('.t-typ').textContent=KOM_T});S.til('.t-send',800+ms+200,true);
  S.t(800+ms+600,function(){trykk3(S,'.t-send');S.q('.t-typ').textContent='';S.q('.t-txt').textContent=KOM_T;S.q('.t-kb.tr').classList.add('inn')});
  S.bort(4300);S.steg(1,4500);S.t(4700,function(){S.q('.t-varsel').classList.add('inn')});
  S.steg(2,6400);S.t(6500,function(){S.q('.t-varsel').classList.remove('inn');S.q('.t-varsel').classList.add('bort')});S.t(6700,function(){S.q('.t-kb.sv').classList.add('inn');S.q('.t-lest').classList.add('inn')});S.steg(3,8600)}
});

/* ── T3 · SAMMENLIGN ── */
var SAM=[['Timer',['11t 25','13t 40']],['Hard I3+',['1t 40','2t 05']],['% av plan',['92 %','78 %']],['Soner',[[74,9,11,6,0],[62,12,16,10,0]]],['CTL',['78','61']],['TSB',['+12','-9']],['HRV',['71 ▲','ikke delt']],['Treff %',['84','79']],['LT2',['165 / 4,1','171 / 3,8']]];
SC3.push({kap:2,tittel:'TO UTØVERE. SAMME BILDE.',tekst:'Timer, hard tid, prosent av plan, soner, CTL, TSB, HRV, treff og terskler - side om side for samme periode. Belastningen over tid ligger ett trykk unna.',
 steg:['Side om side','Sonefordeling','Belastning over tid'],varighet:9500,
 mer:['Åtte faner: Side om side, Oversikt, Belastning, Per bevegelsesform, Helse, Konkurranser, Tester & PR og Årsplan.','Så mange utøvere du vil i samme bilde - én, to eller hele gruppa - med felles periode- og sportsvelger.','Hard tid regnes som I3 og oppover. LT2 vises som puls og laktat fra siste laktatprofil.','Helsekolonnene viser «ikke delt» til utøveren har sagt ja - treneren ser aldri tall utøveren ikke har delt.','Metrikk- og periodevalget huskes per trener.'],
 html:function(){return'<div class="app t-app t-sam"><div class="t-faner t-sf">'+['Side om side','Oversikt','Belastning','Per bev.form','Helse','Konkurranser','Tester & PR','Årsplan'].map(function(n,i){return'<span class="pil'+(i===0?' fylt':'')+'" data-f="'+i+'">'+n+'</span>'}).join('')+'</div>'+
  '<div class="t-sv"><span class="pil">Siste 4 uker</span><span class="pil">Alle sporter</span><span class="pil">'+ik('legg-til','s')+'Utøver</span></div>'+
  '<div class="t-tab"><div class="t-th"><span></span><span>'+av(UT[0])+'Ola</span><span>'+av(UT[1])+'Mari</span></div>'+SAM.map(function(r,i){return'<div class="t-tr a" data-r="'+i+'"><span class="k">'+r[0]+'</span>'+r[1].map(function(v){return'<span class="v'+(typeof v==='string'&&v.indexOf('ikke')>-1?' dim':'')+(v==='-9'?' rod':'')+(v==='+12'?' gron':'')+'">'+(typeof v==='string'?v:zs(v))+'</span>'}).join('')+'</div>'}).join('')+'</div>'+
  '<div class="t-bel a"><span class="cap">Belastning · CTL siste 12 uker</span><svg viewBox="0 0 300 80" preserveAspectRatio="none" class="t-graf"><polyline class="t-l1" fill="none" stroke="#FF4500" stroke-width="2" vector-effect="non-scaling-stroke" points="0,52 25,50 50,46 75,44 100,40 125,38 150,34 175,33 200,30 225,28 250,26 275,25 300,24"/><polyline class="t-l2" fill="none" stroke="#1A6FD4" stroke-width="2" vector-effect="non-scaling-stroke" points="0,66 25,64 50,62 75,58 100,57 125,52 150,50 175,46 200,44 225,42 250,38 275,36 300,34"/><g class="t-konk"><path d="M212 12l4 7h-8z" fill="#D4A017"/><path d="M262 8l4 7h-8z" fill="#D4A017"/></g></svg><div class="t-leg"><span><i style="background:#FF4500"></i>Ola · CTL 78</span><span><i style="background:#1A6FD4"></i>Mari · CTL 61</span><span><i style="background:#D4A017;border-radius:0"></i>Konkurranse</span></div></div></div>'},
 spill:function(S){S.steg(0,200);SAM.forEach(function(_,i){if(i===3)return;S.t(400+i*220,function(){S.q('[data-r="'+i+'"]').classList.add('inn')})});
  S.steg(1,2800);S.t(2900,function(){S.q('[data-r="3"]').classList.add('inn')});S.t(3000,function(){S.qa('.t-zs').forEach(function(z){z.classList.add('vis')})});
  S.steg(2,5200);S.til('[data-f="2"]',5300,true);S.t(5700,function(){trykk3(S,'[data-f="2"]');S.qa('.t-sf .pil').forEach(function(p,i){p.classList.toggle('fylt',i===2)});S.q('.t-bel').classList.add('inn')});
  S.bort(6300);S.t(6000,function(){S.q('.t-bel svg').classList.add('tegn')});S.steg(3,8800)}
});

/* ── T4 · TROPPEN ── */
var TROPP=[[4,'rod','3t 10','34',[70,10,12,8,0],'0t 20','21/40 · 53 %','-','4 dager siden sist'],[5,'gul','6t 50','71',[68,12,12,8,0],'1t 05','38/50 · 76 %','ikke delt','2 dager siden sist'],[0,'gron','9t 20','92',[74,9,11,6,0],'1t 40','92/100 · 92 %','71 ▲',''],[1,'gron','11t 05','96',[62,12,16,10,0],'2t 05','86/110 · 78 %','ikke delt',''],[2,'gron','8t 40','88',[72,10,10,8,0],'1t 20','-','66 ▼',''],[3,'gron','7t 15','90',[76,8,10,6,0],'1t 00','44/50 · 88 %','74 ▲',''],[6,'gron','9t 00','85',[80,8,8,4,0],'0t 55','-','69 ▲',''],[7,'gron','5t 30','94',[78,9,9,4,0],'0t 45','30/40 · 75 %','ikke delt','']];
SC3.push({kap:3,tittel:'HELE TROPPEN. DENNE UKA.',tekst:'Timer, prosent av plan, soner, skyting og HRV per utøver - og hvem som ikke har logget. Rødt øverst. Ett trykk, og du står i utøverens plan.',
 steg:['Timer og % av plan','Hvem har ikke logget','Rett inn i utøveren'],varighet:9500,
 mer:['Uke, måned eller år - samme liste. Rødt = ikke logget på over to dager, gult = to dager, grønt = i dag eller i går. Uleste kommentarer sorteres øverst.','Trener-hjem: neste konkurranse og fellestrening, aktivitetsfeed (loggede økter, sykdom, skade, hvile, mål nådd), grupper og plasser.','Trener-kalender på tvers av utøvere: konkurranser, økter du har meldt oppmøte på og egne notater.','Drilldown per utøver: Plan, Dagbok, Analyse, Årsplan, Historikk og Utstyr - faner du ikke har fått tilgang til er grå.','HRV, søvn og hvilepuls vises bare når utøveren har delt helsedata.'],
 html:function(){return'<div class="app t-app t-tropp"><div class="t-hero"><span class="cap">God dag, Kari</span><b class="bebas">8 utøvere aktive · <span style="color:#FF4500">3</span> uleste</b><span class="t-seg"><span>Uke</span><span class="on">Uke 38</span><span>Måned</span><span>År</span></span></div>'+
  '<div class="t-lh"><span></span><span>Utøver</span><span>Timer</span><span>% av plan</span><span>Soner · hard</span><span>Skudd · treff</span><span>HRV</span></div>'+
  TROPP.map(function(r,i){var u=UT[r[0]];return'<div class="t-lr a" data-i="'+i+'"><i class="t-dot '+r[1]+'"></i><span class="nm">'+av(u)+'<span>'+u[0]+'<small>'+u[1]+'</small></span></span><span class="tm">'+r[2]+'</span><span class="pl"><i class="t-bar"><b style="--w:'+r[3]+'%"></b><em></em></i><small>'+r[3]+' %</small></span><span class="zo">'+zs(r[4])+'<small>'+r[5]+'</small></span><span class="sk">'+r[6]+'</span><span class="hr'+(r[7]==='ikke delt'?' dim':'')+'">'+r[7]+'</span>'+(r[8]?'<span class="t-tip pop">'+r[8]+'</span>':'')+'</div>'}).join('')+
  '<div class="t-drill a"><div class="t-dh">'+av(UT[4])+'<b class="bebas">Sander</b><small>Langrenn · senior</small></div><div class="t-dt">'+['Plan','Dagbok','Analyse','Årsplan','Historikk','Utstyr'].map(function(n,i){return'<span class="'+(i===0?'on':'')+(i===3?' gra':'')+'">'+n+'</span>'}).join('')+'</div><div class="t-dk">'+[['Man','Rolig 1t 30','#28A86E',1],['Tir','Intervall 5×6','#FF8C00',0],['Ons','Rolig 1t','#28A86E',0],['Tor','Terskel 3×12','#E8B93C',0],['Fre','-','',0],['Lør','Langtur 2t 30','#1A6FD4',0],['Søn','Rolig 1t','#28A86E',0]].map(function(d){return'<div><small>'+d[0]+'</small>'+(d[2]?'<span class="t-dp'+(d[3]?' ok':'')+'" style="--c:'+d[2]+'">'+d[1]+'</span>':'<em>Hvile</em>')+'</div>'}).join('')+'</div></div></div>'},
 spill:function(S){S.steg(0,200);TROPP.forEach(function(_,i){S.t(400+i*160,function(){S.q('[data-i="'+i+'"]').classList.add('inn')})});S.t(1900,function(){S.qa('.t-bar b').forEach(function(b){b.classList.add('vis')});S.qa('.t-zs').forEach(function(z){z.classList.add('vis')})});
  S.steg(1,3200);S.til('[data-i="0"] .t-dot',3400);S.t(3900,function(){S.q('[data-i="0"] .t-tip').classList.add('inn')});S.til('[data-i="1"] .t-dot',5000);S.t(5400,function(){S.q('[data-i="0"] .t-tip').classList.remove('inn');S.q('[data-i="1"] .t-tip').classList.add('inn')});
  S.steg(2,6300);S.til('[data-i="0"] .nm',6300,true);S.t(6700,function(){S.q('[data-i="1"] .t-tip').classList.remove('inn');S.q('.t-tropp').classList.add('drill');S.q('.t-drill').classList.add('inn')});S.bort(7000);S.steg(3,8800)}
});

/* ── T5 · UTØVEREN EIER ── */
var RETT=[['Kan redigere planen',1],['Kan se dagboken',1],['Kan se analysen',1],['Kan redigere årsplanen',0],['Del helsedata (søvn, HRV, hvilepuls)',0],['Kan redigere dagboken',0],['Kan redigere soner og terskler',0],['Kan redigere utstyr og skitester',0]];
SC3.push({kap:4,tittel:'UTØVEREN EIER DATAENE.',tekst:'Bryterne ligger hos utøveren: plan, dagbok, analyse, årsplan og helse - og egne brytere for å la treneren redigere dagbok, soner, terskler og utstyr. Helsedata er skjult for treneren til utøveren sier ja, håndhevet i databasen, ikke i menyen.',
 steg:['Utøveren bestemmer','Helse bare med ja','Trenerens spor i kalenderen'],varighet:9500,
 mer:['Fire rettigheter per trener-kobling pluss helsedeling, alle på utøverens side. Treneren setter sine standardvalg for nye koblinger.','Egne brytere for at treneren kan redigere dagboken, soner og terskler (puls, watt, HFmax, FTP) og utstyr og skitester - standard nei, håndhevet i databasen. Hver endring får «endret av trener» med hva som ble endret, «Sist endret av …» på terskelsida og utstyret, og varsel til utøveren. Treneren sletter aldri gjennomførte økter eller utstyr med historikk.','Helsedeling håndheves med radnivå-sikkerhet på søvn, HRV, hvilepuls og merkedata: uten ja finnes ikke tallene for treneren, uansett skjerm.','Økter treneren legger inn står blå og stiplet i utøverens kalender med trenerens navn. Retter treneren i utøverens egen økt, står «endret av trener» - med logg utøveren kan lese.','Kobling på to måter: utøveren lager en kode som varer i sju dager, eller treneren deler en plass-lenke der utøveren får Athlete Pro betalt av treneren.','Én konto, to roller: bryteren Utøver | Trener i menyen. Alle trener-abonnement inkluderer full Athlete Pro til deg selv.'],
 html:function(){return'<div class="t-to2"><div class="app t-app t-rett"><div class="t-rh"><span class="cap">Innstillinger · Trener</span><b class="bebas">Kari Nordmann</b><small>aktiv siden aug 2026</small></div>'+RETT.map(function(r,i){return'<div class="t-rr'+''+'" data-i="'+i+'"><span>'+r[0]+''+'</span><i class="t-sw'+(r[1]?' on':'')+'"><b></b></i></div>'}).join('')+'<div class="t-rls a"><span>'+ik('las','s')+'</span><span>Håndhevet i databasen: uten ja finnes ikke helsetallene for treneren</span></div></div>'+
  '<div class="t-hs"><div class="app t-app t-tv"><span class="cap">Kari ser · Sammenligne</span><div class="t-tr2"><span class="k">HRV</span><span class="v dim t-hrv">ikke delt</span></div><div class="t-tr2"><span class="k">Søvn</span><span class="v dim t-sov">ikke delt</span></div><div class="t-tr2"><span class="k">Hvilepuls</span><span class="v dim t-hp">ikke delt</span></div></div>'+
  '<div class="app t-app t-kal a"><span class="cap">Olas kalender · tor 17. sep</span><div class="t-pille tr"><span class="prikk-tr"></span><span class="kl">09:30</span><b>Intervall 5×6</b><span class="t-chip">'+ik('trener','s')+'Kari</span></div><div class="t-pille ok"><span class="kl">16:00</span><b>Skyting stående</b><span class="t-chip endret">endret av trener · se logg</span></div></div></div></div>'},
 spill:function(S){S.steg(0,200);RETT.slice(0,5).forEach(function(_,i){S.til('[data-i="'+i+'"] .t-sw',400+i*380)});S.steg(1,2600);S.til('[data-i="4"] .t-sw',2700,true);
  S.t(3100,function(){S.q('[data-i="4"] .t-sw').classList.add('on')});S.t(3500,function(){S.q('.t-hrv').textContent='71 ▲';S.q('.t-sov').textContent='7t 02min';S.q('.t-hp').textContent='48';S.qa('.t-tv .v').forEach(function(v){v.classList.remove('dim');v.classList.add('gron')})});
  S.t(4200,function(){S.q('.t-rls').classList.add('inn')});S.bort(4600);S.steg(2,5800);S.t(5900,function(){S.q('.t-kal').classList.add('inn')});S.til('.t-pille.tr .t-chip',6600);S.til('.t-chip.endret',7800);S.bort(8600);S.steg(3,8900)}
});

/* ═════════════════ KONTROLLEREN ═════════════════ */
karusell(SC3, KAP3, 't');
