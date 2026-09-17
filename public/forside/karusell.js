/* KARUSELLEN - motoren for #flyt, #dflyt og #tflyt. EN kopi (regel 11).
   Kilde: <script> i design/xpulse-flyt-bolk-design.html (16. sep 2026).
   Loftet nesten uendret; trener-fila hadde samme motor kopiert og er ikke tatt
   to ganger. Ikonene (IK) kommer fra /forside/ikoner.js - generert fra
   design/ikoner/svg/ikoner.json av scripts/forside-ikoner.ts, aldri handkopiert.

   HVA SOM ER DELT HER, og hvorfor:
   · ik(), HAKE, Z (ZONE_COLORS_V2), MOBIL/erMobil   - alle tre bolkene
   · OKTA + PULS (okta tir 15. sep, fiktiv puls)      - flyt OG trener tegner
     den samme okta; en kilde, sa de ikke kan sprike (diffet identisk 16. sep)
   · Scene + karusell()                               - motoren

   Oppforsel (fasit): autoavspilling KUN nar sporet er >=35 % synlig, pause
   ved skjult fane, en scene om gangen; klikk pa kapittel/prikk/pil/kort og
   sveip gar til scenen; «+» snur kortet og pauser; prefers-reduced-motion
   gir ingen autoavspilling og alle kort i sluttilstand; markoren er et
   element inne i scenen, aldri en tilpasset musepeker (regel 30).
   Scroll-snap pa sporet, overscroll-behavior-x:contain - aldri
   touch-action:none. */
/* ───────── Ikoner fra ikonsettet (design/ikoner/svg/ikoner.json) ───────── */
function ik(n,v,st){v=v||'s';var p=IK[n]&&IK[n][v];if(!p)return'';
  return v==='s'?'<svg viewBox="0 0 24 24" aria-hidden="true" style="'+(st||'')+'"><path d="'+p+'" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  :'<svg viewBox="0 0 24 24" aria-hidden="true" style="'+(st||'')+'"><path d="'+p+'" fill="currentColor"/></svg>';}
var HAKE='<svg viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
var Z={I1:'#28A86E',I2:'#1A6FD4',I3:'#E8B93C',I4:'#FF8C00',I5:'#E23A5A'};
var MOBIL=matchMedia('(max-width:900px)');
function erMobil(){return MOBIL.matches}

/* ───────── ØKTA (én kilde for alle scenene) ───────── */
var OKT=[
 {t:'oppv',z:'I1',s:0,e:20},{t:'drag',z:'I3',s:20,e:30},{t:'sky',ls:'L',s:30,e:33},{t:'drag',z:'I3',s:33,e:43},{t:'sky',ls:'S',s:43,e:46},
 {t:'drag',z:'I4',s:46,e:51},{t:'sky',ls:'L',s:51,e:53},{t:'drag',z:'I4',s:53,e:58},{t:'sky',ls:'S',s:58,e:60},{t:'drag',z:'I4',s:60,e:65},{t:'ned',z:'I1',s:65,e:80}];
var TOT=80;
var HOYDE={I1:.36,I2:.5,I3:.62,I4:.74,I5:.86};
function blokkH(b){return b.t==='sky'?.18:HOYDE[b.z]}
function blokkFarge(b){return b.t==='sky'?'#43434B':Z[b.z]}
function stripe(h){return OKT.map(function(b){return'<i style="flex:'+(b.e-b.s)+';background:'+blokkFarge(b)+';opacity:'+(b.z==='I1'?.62:1)+(h?';height:'+(blokkH(b)*100)+'%;align-self:flex-end':'')+'"></i>'}).join('')}

/* Pulsen (fiktiv, deterministisk) */
var PULS=(function(){var hr=96,ut=[],seed=7;function rnd(){seed=(seed*9301+49297)%233280;return seed/233280}
  for(var m=0;m<=TOT;m+=.25){var b=OKT.filter(function(x){return m>=x.s&&m<x.e})[0]||OKT[OKT.length-1];var mal;
    if(b.t==='oppv')mal=118+(m/20)*20;else if(b.t==='ned')mal=138-(m-65)*1.3;else if(b.t==='sky')mal=b.ls==='L'?122:128;else mal=(b.z==='I3'?160:174)+(m-b.s)*.35;
    var k=b.t==='sky'?.22:.13;hr+=(mal-hr)*k+(rnd()-.5)*2.2;ut.push([m,hr])}return ut})();
function pulsVed(m){var i=Math.round(m/.25);return PULS[Math.max(0,Math.min(PULS.length-1,i))][1]}

/* Punktene pa okta (skyting, laktat, ernaering, notat) - delt av flyt-scene 7 og
   trener-scene 2, sa begge viser den samme okta. */
var PUNKT=[{m:20,k:'ernaering',c:'#28A86E',tx:'40 g',ctx:'drag 1 · 20:00',niv:0,grp:'ern'},{m:31.5,k:'skyting',c:'var(--a-mut)',tx:'L 5/5',ctx:'skyting 1',niv:0,grp:'sky'},{m:41,k:'laktat',c:'#E23A5A',tx:'2,8',ctx:'drag 2 · 41:00',niv:1,grp:'lak'},
 {m:44.5,k:'skyting',c:'var(--a-mut)',tx:'S 4/5',ctx:'skyting 2',niv:0,grp:'sky'},{m:52,k:'skyting',c:'var(--a-mut)',tx:'L 5/5',ctx:'skyting 3',niv:0,grp:'sky'},{m:59,k:'skyting',c:'var(--a-mut)',tx:'S 4/5',ctx:'skyting 4',niv:0,grp:'sky'},{m:62,k:'for-okt',c:'#A6A6AF',tx:'Tungt i bakken',ctx:'drag 5 · 62:00',niv:1,grp:'not'},{m:64.5,k:'laktat',c:'#E23A5A',tx:'4,6',ctx:'drag 5 · 64:30',niv:2,grp:'lak'}];

/* ───────── Tidslinje-motor per scene ───────── */
function Scene(def,rot){this.d=def;this.rot=rot;this.hend=[];this.id=[];}
Scene.prototype.t=function(at,fn){this.hend.push([at,fn])};
Scene.prototype.q=function(s){return this.rot.querySelector(s)};
Scene.prototype.qa=function(s){return[].slice.call(this.rot.querySelectorAll(s))};
Scene.prototype.render=function(){if(this.d.fart)this.rot.classList.add('fart');this.rot.innerHTML=this.d.html();this.hend=[];this.d.spill(this);this.hend.sort(function(a,b){return a[0]-b[0]});
  var m=document.createElement('div');m.className='markor';this.rot.appendChild(m);this.mark=m};
Scene.prototype.stopp=function(){this.id.forEach(clearTimeout);this.id=[]};
Scene.prototype.kjor=function(fra){var s=this;this.stopp();this.hend.forEach(function(h){if(h[0]<=fra)h[1]();else s.id.push(setTimeout(h[1],h[0]-fra))})};
Scene.prototype.slutt=function(){var kort=this.rot.closest('.sc');kort.classList.add('still');this.still=true;this.render();this.hend.forEach(function(h){h[1]()});this.still=false;if(this.d.rydd)this.d.rydd(this);
  if(this.mark)this.mark.classList.remove('vis');void kort.offsetWidth;requestAnimationFrame(function(){kort.classList.remove('still')})};
Scene.prototype.til=function(el,at,klikk,ms){ms=ms||750;var s=this;this.t(at,function(){var e=typeof el==='string'?s.q(el):el;if(!e)return;
  var r=s.rot.getBoundingClientRect(),b=e.getBoundingClientRect();s.mark.style.left=(b.left-r.left+b.width/2)+'px';s.mark.style.top=(b.top-r.top+b.height/2)+'px';s.mark.classList.add('vis')});
  if(klikk)this.t(at+ms,function(){s.mark.classList.add('klikk');setTimeout(function(){s.mark.classList.remove('klikk')},180)})};
Scene.prototype.bort=function(at){var s=this;this.t(at,function(){s.mark.classList.remove('vis')})};
Scene.prototype.steg=function(i,at){var s=this;this.t(at,function(){var li=s.rot.closest('.sc').querySelectorAll('.sc-steg li');
  [].forEach.call(li,function(l,j){l.className=j<i?'ok':(j===i?'na':'')})})};
Scene.prototype.inn=function(sel,at,kl){var s=this;this.t(at,function(){s.qa(sel).forEach(function(e){e.classList.add(kl||'inn')})})};
Scene.prototype.tell=function(el,fra,til,ms,at,fmt){var s=this;this.t(at,function(){var e=s.q(el);if(!e)return;if(s.still){e.textContent=fmt?fmt(til):til;return}var t0=performance.now();
  (function f(n){var p=Math.min(1,(n-t0)/ms),v=fra+(til-fra)*(1-Math.pow(1-p,3));e.textContent=fmt?fmt(v):Math.round(v);if(p<1&&!document.hidden)requestAnimationFrame(f);else e.textContent=fmt?fmt(til):til})(t0)})};
var still=document.createElement('style');still.textContent='.sc.still *{transition:none!important;animation:none!important}';document.head.appendChild(still);

/* ═════════════════ ÉN SCENE ALENE (undersidene bolk 2, 17. sep) ═════════════════
   enScene(tittel, element, {fil}) monterer ÉN scene fra SC uten kapittelrad, med
   scenens egne steg-tekster under kortet. Spiller når kortet er minst 50 % i
   viewport, stopper og nullstiller utenfor, loop av. Scenefila lastes lat per
   underside - bare den fila scenen ligger i (flyt / trener / detaljene), pluss
   oktgraf.js som flyt og trener tegner med. prefers-reduced-motion: sluttbildet
   stille. Samme Scene-motor og samme CSS-variabler som forsiden (lys/mørk følger sida). */
var SCENER_ALLE={};            /* tittel -> scenedefinisjon, fylt av karusell() i hver scenefil */
var SCENEFIL_LASTER={};        /* fil -> Promise, så samme fil aldri lastes to ganger */
function lastScenefil(fil){if(SCENEFIL_LASTER[fil])return SCENEFIL_LASTER[fil];
  SCENEFIL_LASTER[fil]=new Promise(function(ok,feil){var s=document.createElement('script');s.src='/forside/'+fil+'.js';s.async=true;s.onload=function(){ok()};s.onerror=function(){feil(new Error('fant ikke /forside/'+fil+'.js'))};document.head.appendChild(s)});
  return SCENEFIL_LASTER[fil]}
function enScene(tittel,element,opts){opts=opts||{};
  var trenger=[];if(typeof tegnOktgraf!=='function'&&opts.fil!=='detaljene')trenger.push(lastScenefil('oktgraf'));
  if(!SCENER_ALLE[tittel]&&opts.fil)trenger.push(lastScenefil('scener-'+opts.fil));
  return Promise.all(trenger).then(function(){var d=SCENER_ALLE[tittel];if(!d)throw new Error('enScene: fant ikke scenen «'+tittel+'»');
    var rolig=matchMedia('(prefers-reduced-motion: reduce)').matches;
    element.classList.add('sc-en-vert');
    element.innerHTML='<article class="sc on sc-en" aria-label="'+tittel.toLowerCase()+'"><div class="sc-scene"></div><ul class="sc-steg">'+d.steg.map(function(t){return'<li><b>'+HAKE+'</b>'+t+'</li>'}).join('')+'</ul></article>';
    var kort=element.querySelector('.sc'),S=new Scene(d,kort.querySelector('.sc-scene')),steg=function(){return[].slice.call(kort.querySelectorAll('.sc-steg li'))};
    var spiller=false,ferdigId=null;
    function nullstill(){S.stopp();if(ferdigId){clearTimeout(ferdigId);ferdigId=null}if(S.d.rydd)S.d.rydd(S);S.render();steg().forEach(function(l){l.className=''});kort.classList.remove('sc-en-ferdig');spiller=false}
    function spill(){if(spiller)return;nullstill();spiller=true;S.kjor(0);ferdigId=setTimeout(function(){kort.classList.add('sc-en-ferdig');spiller=false},d.varighet||9000)}
    function sluttbilde(){S.stopp();S.slutt();steg().forEach(function(l){l.className='ok'});kort.classList.add('sc-en-ferdig')}
    if(rolig){sluttbilde();return {element:element,scene:S,stopp:function(){}}}
    S.render();steg().forEach(function(l){l.className=''});
    var synlig=false;
    var io=new IntersectionObserver(function(es){es.forEach(function(e){var var_=synlig;synlig=e.intersectionRatio>=.5;
      if(synlig&&!var_){if(!document.hidden)spill()}else if(!synlig&&var_){nullstill()}})},{threshold:[0,.5,1]});
    io.observe(kort);
    var vis=function(){if(document.hidden){nullstill()}else if(synlig){spill()}};document.addEventListener('visibilitychange',vis);
    var bytt=function(){if(synlig)spill();else nullstill()};MOBIL.addEventListener('change',bytt);
    return {element:element,scene:S,stopp:function(){io.disconnect();document.removeEventListener('visibilitychange',vis);MOBIL.removeEventListener('change',bytt);nullstill()}}})}

/* ═════════════════ KONTROLLEREN ═════════════════ */
function karusell(SC,KAP,P){var $=function(id){return document.getElementById(P+id)};
 SC.forEach(function(d){SCENER_ALLE[d.tittel]=d});
 /* Undersidene (bolk 2): scenefila kan lastes uten karusell-DOM - da er registreringen over alt den gjør. */
 if(!$('spor'))return;
 var rolig=matchMedia('(prefers-reduced-motion: reduce)').matches;
 var spor=$('spor'),kapEl=$('kap'),prikkEl=$('prikker'),spillK=$('spill');
 var IKON_PAUSE='<svg viewBox="0 0 24 24"><rect x="6" y="4.5" width="4" height="15" rx="1.2" fill="currentColor"/><rect x="14" y="4.5" width="4" height="15" rx="1.2" fill="currentColor"/></svg>';
 var IKON_SPILL='<svg viewBox="0 0 24 24"><path d="M8 5.2v13.6c0 .8.9 1.3 1.6.8l10.2-6.8a1 1 0 0 0 0-1.6L9.6 4.4C8.9 3.9 8 4.4 8 5.2z" fill="currentColor"/></svg>';
 var IKON_IGJEN='<svg viewBox="0 0 24 24"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4v4h4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
 $('forr').innerHTML='<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
 $('nest').innerHTML='<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

 var kort=[],scener=[];
 KAP.forEach(function(k,i){var b=document.createElement('button');b.className='kap';b.type='button';b.setAttribute('role','tab');b.innerHTML='<span class="kn">0'+(i+1)+'</span>'+ik(k.ik,'s')+k.n+'<i></i>';b.onclick=function(){gaTil(SC.findIndex(function(s){return s.kap===i}),true)};kapEl.appendChild(b)});
 SC.forEach(function(d,i){var el=document.createElement('article');el.className='sc';el.setAttribute('aria-roledescription','lysbilde');el.setAttribute('aria-label',(i+1)+' av '+SC.length);
  var nr=SC.filter(function(s,j){return j<i&&s.kap===d.kap}).length;
  el.innerHTML='<div class="sc-tx"><div class="sc-kick">'+ik(KAP[d.kap].ik,'s')+'0'+(d.kap+1)+' · '+KAP[d.kap].n+'</div><h3>'+d.tittel+'</h3><p>'+d.tekst+'</p><ul class="sc-steg">'+d.steg.map(function(s){return'<li><b>'+HAKE+'</b>'+s+'</li>'}).join('')+'</ul></div><div class="sc-scene"></div>';
  if(d.mer){el.insertAdjacentHTML('beforeend','<button class="sc-pluss" type="button" aria-label="Les mer"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button><div class="sc-mer"><div class="sc-kick">'+ik(KAP[d.kap].ik,'s')+KAP[d.kap].n+'</div><h4>Alt i kortet</h4><ul>'+d.mer.map(function(m){return'<li>'+m+'</li>'}).join('')+'</ul></div>');
   el.querySelector('.sc-pluss').addEventListener('click',function(e){e.stopPropagation();if(i!==idx)gaTil(i,true);var apen=el.classList.toggle('apen');if(apen){pause();brukerPause=true}else{brukerPause=false;fortsett()}oppdaterKnapp()})}
  el.addEventListener('click',function(){if(i!==idx)gaTil(i,true)});
  spor.appendChild(el);kort.push(el);var S=new Scene(d,el.querySelector('.sc-scene'));scener.push(S);
  var p=document.createElement('button');p.className='prikk';p.type='button';p.setAttribute('aria-label','Scene '+(i+1)+': '+d.tittel.toLowerCase());p.innerHTML='<i></i>';p.onclick=function(){gaTil(i,true)};prikkEl.appendChild(p)});
 var prikker=[].slice.call(prikkEl.children),kaps=[].slice.call(kapEl.children);

 var idx=0,spiller=!rolig,synlig=false,brukerPause=false,t0=0,brukt=0,programScroll=0,ferdig=false;
 function ferdigTilstand(i){var S=scener[i];S.stopp();if(S.d.rydd)S.d.rydd(S);S.slutt();[].forEach.call(kort[i].querySelectorAll('.sc-steg li'),function(l){l.className='ok'})}
 scener.forEach(function(_,i){ferdigTilstand(i)});

 function aktiver(i,scroll){var gammel=idx;kort.forEach(function(k){k.classList.remove('apen')});if(gammel!==i){ferdigTilstand(gammel)}idx=i;ferdig=false;brukt=0;
  kort.forEach(function(k,j){k.classList.toggle('on',j===i)});prikker.forEach(function(p,j){p.classList.toggle('on',j===i);p.style.setProperty('--p','0%')});
  kaps.forEach(function(k,j){k.classList.toggle('on',j===SC[i].kap)});
  var sk=kaps[SC[i].kap];if(sk&&sk.scrollIntoView&&kapEl.scrollWidth>kapEl.clientWidth)kapEl.scrollTo({left:sk.offsetLeft-16,behavior:'smooth'});
  if(scroll){programScroll=Date.now();spor.scrollTo({left:kort[i].offsetLeft-parseFloat(getComputedStyle(spor).paddingLeft),behavior:rolig?'auto':'smooth'})}
  $('forr').disabled=i===0;$('nest').disabled=i===SC.length-1;
  var S=scener[i];S.stopp();if(S.d.rydd)S.d.rydd(S);
  if(rolig){ferdigTilstand(i);return}
  S.render();[].forEach.call(kort[i].querySelectorAll('.sc-steg li'),function(l){l.className=''});
  if(skalSpille()){t0=performance.now();S.kjor(0)}else{brukt=0}
  oppdaterKnapp()}
 function skalSpille(){return spiller&&synlig&&!brukerPause&&!rolig}
 function gaTil(i,bruker){if(i<0||i>=SC.length)return;if(bruker&&!rolig){brukerPause=false;spiller=true}aktiver(i,true)}
 function pause(){if(!skalSpille())return;brukt+=performance.now()-t0;var S=scener[idx];S.stopp();if(S.d.rydd)S.d.rydd(S)}
 function fortsett(){if(!skalSpille()||ferdig)return;var S=scener[idx];t0=performance.now();
  if(brukt>0){S.render();S.kjor(brukt)}else{S.render();[].forEach.call(kort[idx].querySelectorAll('.sc-steg li'),function(l){l.className=''});S.kjor(0)}}
 function oppdaterKnapp(){if(rolig){spillK.style.display='none';return}
  if(ferdig){spillK.innerHTML=IKON_IGJEN;spillK.setAttribute('aria-label','Spill av igjen')}
  else if(brukerPause){spillK.innerHTML=IKON_SPILL;spillK.setAttribute('aria-label','Spill av')}
  else{spillK.innerHTML=IKON_PAUSE;spillK.setAttribute('aria-label','Pause')}}
 spillK.onclick=function(){if(ferdig){brukerPause=false;spiller=true;gaTil(0,true);return}
  if(brukerPause){brukerPause=false;fortsett()}else{pause();brukerPause=true}oppdaterKnapp()};
 $('forr').onclick=function(){gaTil(idx-1,true)};
 $('nest').onclick=function(){gaTil(idx+1,true)};
 $('flyt').addEventListener('keydown',function(e){if(e.key==='ArrowRight'){gaTil(idx+1,true);e.preventDefault()}if(e.key==='ArrowLeft'){gaTil(idx-1,true);e.preventDefault()}});

 /* Fremdrift */
 (function tick(){if(skalSpille()&&!ferdig){var d=SC[idx].varighet,p=Math.min(1,(brukt+performance.now()-t0)/d);
   prikker[idx].style.setProperty('--p',(p*100)+'%');
   var ik2=SC.filter(function(s){return s.kap===SC[idx].kap}),foran=SC.slice(0,idx).filter(function(s){return s.kap===SC[idx].kap}).length;
   kaps[SC[idx].kap].style.setProperty('--kp',((foran+p)/ik2.length*100)+'%');
   if(p>=1){if(idx<SC.length-1){aktiver(idx+1,true)}else{ferdig=true;oppdaterKnapp()}}}
  requestAnimationFrame(tick)})();

 /* Synlighet: spiller bare når seksjonen er på skjermen */
 new IntersectionObserver(function(es){es.forEach(function(e){var var_=synlig;synlig=e.intersectionRatio>=.35;
   if(synlig&&!var_){fortsett()}else if(!synlig&&var_){brukt+=performance.now()-t0;var S=scener[idx];S.stopp();if(S.d.rydd)S.d.rydd(S)}})},{threshold:[0,.35,.6]}).observe(spor);
 document.addEventListener('visibilitychange',function(){if(document.hidden)pause();else fortsett()});

 /* Sveip/tofinger: kortet man lander på blir aktivt */
 var st;spor.addEventListener('scroll',function(){clearTimeout(st);st=setTimeout(function(){if(Date.now()-programScroll<900)return;
  var pl=parseFloat(getComputedStyle(spor).paddingLeft),best=0,bd=1e9;kort.forEach(function(k,j){var d=Math.abs(k.offsetLeft-pl-spor.scrollLeft);if(d<bd){bd=d;best=j}});
  if(best!==idx){brukerPause=false;spiller=true;aktiver(best,false)}},140)},{passive:true});

 /* Bytter mellom mobil og PC: tegn scenene på nytt i riktig oppstilling */
 MOBIL.addEventListener('change',function(){scener.forEach(function(_,i){if(i!==idx)ferdigTilstand(i)});aktiver(idx,true)});

 if(rolig)spillK.style.display='none';
 aktiver(0,false);
}
