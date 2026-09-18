/* SLIK SER DET FAKTISK UT v3 - SCROLLY. Motoren fra design/xpulse-faktisk-ut-v3-scrolly-design.html
   (Cowork 17. sep, runde 2 og 3). Tegnerne er faktisk-ut.js (window.FV.r) - ingen ny tegning her.
   Telefonen står fast midt i skjermen; sidebla-en styrer sju scener: 1 måned liste (mobil) · 2 måned
   kalender · 3 tirsdag 15. sep åpnet m/ øktgrafen · 4 samme dag rullet til styrkesettene og helsekortet ·
   5 uka · 6 måned på PC · 7 året på PC. Framdriften 0-1 i hver scene ruller appen inni rammen;
   skjermbildene krysstoner 0,5 s; maks to kort per scene. Prikkene er piller som fylles, kan trykkes;
   «Hopp over» går forbi. prefers-reduced-motion: ingen toning/rulling, hver scene i sluttilstand.
   Krav 17. sep: GlassTopp og GlassLinje synlige i alle mobilscener (dagen åpner inne i rammen,
   ikke som fullskjermsark - se .sv-lag .fv-pop i runde3.css), ekte ikoner fra ikonsettet, ekte
   komponentdesign (faktisk-ut.js). */
/* ===== v3 scrolly-motor. Bruker tegnerne fra v2 (window.FV) ===== */
(function(){
var stage=document.getElementById('sv-stage'),steg=document.getElementById('sv-steg'),prik=document.getElementById('sv-prikker'),nr=document.getElementById('sv-nr'),tt=document.getElementById('sv-tt'),enh=document.getElementById('sv-enh'),stripe=document.getElementById('sv-stripe'),scroll=document.getElementById('sv-scroll');
if(!stage||!window.FV||!FV.r)return;
var ROLIG=matchMedia('(prefers-reduced-motion: reduce)').matches;
var O=FV.OKTER,R=FV.r;
function uke38(){return O.filter(function(o){return o.dt>='2026-09-14'&&o.dt<='2026-09-20'})}
function tid(m){var h=Math.floor(m/60),mm=m%60;return h+':'+(mm<10?'0':'')+mm}
var u=uke38(),gjort=0,plan=0,km=0,sk=[0,0];u.forEach(function(o){plan+=o.dur;if(o.ok){gjort+=o.dur;km+=o.km||0;if(o.sky){sk[0]+=o.sky[0];sk[1]+=o.sky[1]}}});
var o15=O.filter(function(o){return o.dt==='2026-09-15'}),tk=o15[0],st=o15[1];
var sep=O.filter(function(o){return o.dt.slice(0,7)==='2026-09'}),konk=sep.filter(function(o){return o.konk}).length;
var samling=O.filter(function(o){return o.dt>='2026-09-19'&&o.dt<='2026-09-27'}).reduce(function(a,o){return a+o.dur},0);
function topI(el,root){var y=0;while(el&&el!==root){y+=el.offsetTop;el=el.offsetParent;if(el&&root.contains(el)===false)break}return y}
function rull(r,mal,minus){r.style.scrollBehavior='auto';r.scrollTop=Math.max(0,topI(mal,r)-(minus||0));r.style.scrollBehavior=''}
function idagPos(r){var d=r.querySelector('.fv-dag.idag,.fv-dr.idag');if(!d)return 0;var rad=d.closest('.fv-rad')||d.closest('.fv-lu'),mal=rad.previousElementSibling&&rad.previousElementSibling.classList.contains('fv-pstripe')?rad.previousElementSibling:rad;var hode=r.querySelector('.fv-mhode'),ud=r.querySelector('.fv-ukedager');return Math.max(0,topI(mal,r)-(hode?hode.offsetHeight+10:(ud?ud.offsetHeight:0)+6))}
var MOBIL=function(){return window.matchMedia('(max-width:900px)').matches},W_PC=1320;
var IKM='<svg viewBox="0 0 24 24"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M10.5 5h3"/></svg>',IKP='<svg viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M9 20h6"/></svg>';

/* Scenene. key = hvilket skjermbilde; like nøkler rendres ikke på nytt (3 → 4 ruller bare) */
var SC=[
 {t:'Måned som liste',e:'mob',key:'ml',vekt:1,
  sett:function(){R.sett({aapen:null,mob:{visning:'maned',modus:'liste'}})},
  rull:function(l,p){var r=l.querySelector('.fv-mbody');r.scrollTop=idagPos(r)+p*260},
  kort:[
   {s:'h',y:.3,cap:'I dag · onsdag 16. sep',b:'Fylt er gjort. Stiplet er planen.',p:'Morgenøkta kom fra klokka med pulslinje. Skytinga kl. 16 står stiplet til den er logget.'},
   {s:'v',y:-.3,cap:'Uke 38',b:'Uka summeres mens du logger.',p:'Tid mot plan, km, skudd og treff regnes fra øktene i uka.',tall:[['Gjort',tid(gjort)+' t'],['Plan',tid(plan)+' t'],['Treff',sk[1]?Math.round(sk[0]/sk[1]*100)+' %':'-']]}
  ]},
 {t:'Måned som kalender',e:'mob',key:'mg',vekt:1,
  sett:function(){R.sett({aapen:null,mob:{visning:'maned',modus:'grid'}})},
  rull:function(l,p){var r=l.querySelector('.fv-mbody');r.scrollTop=idagPos(r)+p*220},
  kort:[
   {s:'v',y:-.22,cap:'Perioder',b:'Rød stripe = hardeste uka.',p:'Samling Sjusjøen 19. - 27. sep ligger som rød periode over dagene. Grønn er rolig, gul er medium.',tall:[['Samling',tid(samling)+' t','g0']]},
   {s:'h',y:.3,cap:'Nøkkeldatoer',b:'NC-helga står i gull.',p:'Sprint 12. og jaktstart 13. sep med plassering, testløpet i blått - i samme rutenett som øktene.'}
  ]},
 {t:'Trykk på en dag',e:'mob',key:'pop',vekt:1.1,
  sett:function(){R.sett({aapen:'2026-09-15',valgt:'2026-09-15',mob:{visning:'maned',modus:'grid'}})},
  rull:function(l,p){var r=l.querySelector('.fv-pop'),k=l.querySelectorAll('.fv-pk')[1];if(!r||!k)return;r.scrollTop=p*(topI(k,r)-10)},
  kort:[
   {s:'h',y:-.3,cap:'Dagen åpner',b:'Økta med grafen.',p:'Terskel komb: sonesøyler fra økta, pulslinja fra klokka oppå, laktat der det er målt.',tall:[['Laktat',tk.lak],['Snitt',tk.puls+' bpm'],['Km',tk.km]]},
   {s:'v',y:.22,cap:'Skyting i komben',b:'L · S · L · S mellom dragene.',p:'Treff per serie står over skytepausene.',tall:[['Treff',tk.sky[0]+'/'+tk.sky[1]],['Standardøkt','#'+tk.nr]]}
  ]},
 {t:'Styrke og helse',e:'mob',key:'pop',vekt:1,
  sett:function(){R.sett({aapen:'2026-09-15',valgt:'2026-09-15',mob:{visning:'maned',modus:'grid'}})},
  rull:function(l,p){var r=l.querySelector('.fv-pop'),k=l.querySelectorAll('.fv-pk')[1];if(!r||!k)return;var fra=topI(k,r)-10,maks=r.scrollHeight-r.clientHeight;r.scrollTop=fra+p*(maks-fra)},
  kort:[
   {s:'v',y:-.28,cap:'Styrkeøkta',b:'Sett som blokker.',p:'Høyden er kg, tallet er reps, gull ring er PR. Hvile i pausegrått.',tall:[['Tonnasje',(Math.round(st.kg/100)/10).toString().replace('.',',')+' t'],['RPE',st.rpe]]},
   {s:'h',y:.3,cap:'Fra klokka i natt',b:'Hvilepuls, HRV, søvn, følelse.',p:'Helsekortet ligger i dagen, med 30-dagers snitt og søvnfasene under.'}
  ]},
 {t:'Uka',e:'mob',key:'mu',vekt:1,
  sett:function(){R.sett({aapen:null,valgt:'2026-09-15',mob:{visning:'uke'}})},
  rull:function(l,p){var b=l.querySelector('.fv-mbody'),d=l.querySelector('.fv-dd');if(!d)return;b.scrollTop=p*Math.max(0,topI(d,b)-90)},
  kort:[
   {s:'h',y:-.32,cap:'Ukevisning',b:'Sju dager, én skjerm.',p:'Periodebanner, ukesum og fylte chips per dag. Trykk på en dag for detaljene under.'},
   {s:'v',y:.3,cap:'Valgt dag',b:'Tirsdag med begge øktene.',p:'Terskel komb med graf og styrkeøkta med settene - samme data som i måneden.'}
  ]},
 /* Sverre 18. sep: scene 6 gikk for fort på mobil (0,65 = 55 vh mot 85 for de andre) - full vekt der; PC beholder den korte. */
 {t:'Samme på PC',e:'pc',key:'pg',vekt:window.matchMedia('(max-width:900px)').matches?1:.65,
  sett:function(){R.sett({aapen:null,pc:{visning:'maned',modus:'grid'}})},
  rull:function(l,p){var r=l.querySelector('.fv-inn');if(r)r.scrollTop=idagPos(r)+p*240},
  kort:[
   {s:'v',y:.42,cap:'PC',b:'Én dagbok, alle skjermer.',p:'Månedsrutenettet med periodestripe, ukestripe og analysepanelet øverst.'},
   {s:'h',y:.42,cap:'Skyting',b:'Skudd og treff per uke.',p:'Ukestripen teller skuddene, panelet over rutenettet summerer måneden.'}
  ]},
 {t:'Året',e:'pc',key:'pa',vekt:1,
  sett:function(){R.sett({aapen:null,pc:{visning:'aar'}})},
  rull:function(){},
  kort:[
   {s:'v',y:.4,cap:'År',b:'Tolv måneder, fire tall.',p:'Total tid, km, økter og konkurranser mot i fjor, og skudd per måned.',tall:[['Sep',konk+' konk.']]},
   {s:'h',y:.4,cap:'Det var dagboken',b:'Bla videre.',p:'Planen, analysen og trenerflaten ligger lenger ned på siden.'}
  ]}
];

/* Rulleblokker + prikker + chips */
var VH=window.innerHeight;
SC.forEach(function(s,i){var d=document.createElement('div');d.className='sv-s';d.dataset.i=i;d.style.height=(s.vekt*85)+'vh';steg.appendChild(d);
  var p=document.createElement('i');prik.appendChild(p);
  if(stripe){var c=document.createElement('span');c.innerHTML='<b>'+(i+1)+'</b>'+s.t;stripe.appendChild(c)}
  p.title=s.t;p.addEventListener('click',function(){SV.til(i)})});
var hopp=document.getElementById('sv-hopp');if(hopp)hopp.addEventListener('click',function(){var r=scroll.getBoundingClientRect();window.scrollTo(0,window.scrollY+r.bottom-window.innerHeight+40)});
/* første scene skal stå fullt før bla-en starter: sticky-en er 100 vh, blokkene kommer etter */

var AKT=-1,LAG=null,KEY=null,P=0;
/* Forsidens faste toppmeny ligger over den klebrige scenen - mål den, ikke gjett (utkastet hadde 56 px for sin stripe). */
function toppH(){var h=0;[].forEach.call(document.querySelectorAll('nav'),function(n){if(getComputedStyle(n).position==='fixed')h=Math.max(h,n.getBoundingClientRect().height)});document.getElementById('inside').style.setProperty('--sv-topp',(h+6)+'px')}
toppH();window.addEventListener('resize',toppH);
function maal(){var w=stage.clientWidth,h=stage.clientHeight;return{w:w,h:h}}
/* Sverre 17. sep: en tanke mindre på mobil (begge rammer), en tanke større på PC - og PC-ramma brei */
function skala(e,l){var m=maal(),pad=e==='mob'?16:12,mob=MOBIL();
  if(e==='mob'){return Math.min(mob?.74:.92,(m.h-pad)/800,(m.w-pad)/390)}
  var hh=l?l.scrollHeight:900;return Math.min(1,(m.h-pad)/hh,(m.w-pad)/W_PC)*(mob?.86:1)}
function vis(i,retning){var s=SC[i];
  /* topp */
  nr.textContent=i+1;tt.classList.add('bytt');setTimeout(function(){tt.textContent=s.t;tt.classList.remove('bytt')},180);
  enh.innerHTML=(s.e==='mob'?IKM+'Mobil':IKP+'PC');
  prik.querySelectorAll('i').forEach(function(p,j){p.classList.toggle('on',j===i)});
  stage.classList.toggle('pc',s.e==='pc');
  /* skjermbilde */
  var ny=s.key!==KEY;
  if(ny){s.sett();var l=document.createElement('div');l.className='sv-lag '+s.e;l.innerHTML=s.e==='mob'?R.mob():'<div class="fv-pc">'+R.pc()+'</div>';
    var gl=LAG;
    stage.appendChild(l);var sk=skala(s.e,l);l.style.setProperty('--s',sk.toFixed(4));
    stage.style.setProperty('--hv',((s.e==='mob'?390:W_PC)*sk/2).toFixed(1)+'px');stage.style.setProperty('--hh',((s.e==='mob'?800:l.scrollHeight)*sk/2).toFixed(1)+'px');
    s.rull(l,P);
    requestAnimationFrame(function(){requestAnimationFrame(function(){l.classList.add('inn')})});
    if(gl){gl.classList.remove('inn');setTimeout(function(){gl.remove()},560)}
    LAG=l;KEY=s.key}
  else{s.rull(LAG,P)}
  /* kort: gamle ut, nye inn */
  stage.querySelectorAll('.sv-call').forEach(function(k){k.classList.remove('vis');setTimeout(function(){k.remove()},420)});
  s.kort.forEach(function(k,j){var d=document.createElement('div');d.className='sv-call '+k.s;d.style.setProperty('--y',k.y);
    d.innerHTML='<small>'+k.cap+'</small><b>'+k.b+'</b><p>'+k.p+'</p>'+(k.tall?'<div class="tall">'+k.tall.map(function(t){return'<span>'+t[0]+'<b class="'+(t[2]||'')+'">'+t[1]+'</b></span>'}).join('')+'</div>':'');
    stage.appendChild(d);setTimeout(function(){d.classList.add('vis')},260+j*220)});
  AKT=i}
function aktiv(){var r=scroll.getBoundingClientRect(),vh=window.innerHeight,y=-r.top;
  /* hvor langt inn i rulleblokkene er vi? blokkene starter etter 100 vh sticky */
  var inne=y,tot=0,h=[],i;SC.forEach(function(s){var px=s.vekt*.85*vh;h.push(px);tot+=px});
  var maks=tot;if(inne<0)inne=0;if(inne>maks-1)inne=maks-1;
  var acc=0;for(i=0;i<h.length;i++){if(inne<acc+h[i])break;acc+=h[i]}
  if(i>=h.length){i=h.length-1;acc-=h[i]}
  P=Math.min(1,Math.max(0,(inne-acc)/h[i]));
  if(ROLIG)P=1;
  if(i!==AKT)vis(i);else if(LAG)SC[i].rull(LAG,P);
  var d=prik.children[i];if(d)d.style.setProperty('--p',P.toFixed(3))}
var tick=false;function onS(){if(tick)return;tick=true;requestAnimationFrame(function(){tick=false;aktiv()})}
window.addEventListener('scroll',onS,{passive:true});
window.addEventListener('resize',function(){if(LAG){var s=SC[AKT],sk=skala(s.e,LAG);LAG.style.setProperty('--s',sk.toFixed(4));stage.style.setProperty('--hv',((s.e==='mob'?390:W_PC)*sk/2).toFixed(1)+'px');stage.style.setProperty('--hh',((s.e==='mob'?800:LAG.scrollHeight)*sk/2).toFixed(1)+'px')}onS()});
setTimeout(aktiv,50);
window.SV={vis:vis,SC:SC,til:function(i){var r=scroll.getBoundingClientRect(),vh=window.innerHeight,acc=0;for(var j=0;j<i;j++)acc+=SC[j].vekt*.85*vh;window.scrollTo(0,window.scrollY+r.top+acc+20)}};
window.SV.hv=W_PC;
})();
