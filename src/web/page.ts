/**
 * Two pages (LANDING `/`, DASHBOARD `/dashboard`) sharing a refined theme and a
 * PERFORMANT animated lattice. Animation uses pre-rendered glow sprites (no
 * per-frame gradients), a 30fps cap, pauses when the tab is hidden, and honours
 * prefers-reduced-motion — so it's smooth and light on CPU.
 */

const CSS = `
  :root{
    --bg:#0b0b10;--surface:#13131b;--surface2:#181822;--line:rgba(255,255,255,.07);
    --txt:#e9e9f0;--mut:#9a9aac;--dim:#63636f;
    --acc:#ff7a1a;--acc2:#ff5470;--grn:#36d399;--am:#f5b740;--red:#ff6b6b;
    --r:16px;--sp:22px;
  }
  *{box-sizing:border-box}
  html{scroll-behavior:smooth}
  body{margin:0;background:var(--bg);color:var(--txt);
    font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.6;-webkit-font-smoothing:antialiased;overflow-x:hidden}
  body::before{content:"";position:fixed;inset:0;z-index:-2;pointer-events:none;
    background:radial-gradient(1100px 560px at 50% -10%, rgba(255,122,26,.10), transparent 70%)}
  body::after{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;opacity:.4;
    background-image:linear-gradient(rgba(255,255,255,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.018) 1px,transparent 1px);
    background-size:54px 54px;mask-image:radial-gradient(circle at 50% 20%,#000,transparent 80%)}
  h1,h2,h3{font-family:'Chakra Petch',sans-serif;font-weight:700;margin:0;letter-spacing:.005em}
  a{color:inherit;text-decoration:none}
  .mono{font-family:'IBM Plex Mono',ui-monospace,monospace}
  .wrap{max-width:1140px;margin:0 auto;padding:0 24px}
  .mut{color:var(--mut)}.dim{color:var(--dim)}.grn{color:var(--grn)}.red{color:var(--red)}.acc{color:var(--acc)}.pk{color:var(--acc2)}.am{color:var(--am)}
  .label{display:inline-flex;align-items:center;gap:9px;font-size:12px;letter-spacing:2px;color:var(--acc);text-transform:uppercase;font-weight:600}
  .label .dot{width:6px;height:6px;border-radius:50%;background:var(--acc)}

  nav{position:sticky;top:0;z-index:50;backdrop-filter:blur(14px);background:rgba(11,11,16,.7);border-bottom:1px solid var(--line)}
  nav .wrap{display:flex;align-items:center;gap:24px;height:60px}
  .brand{font-family:'Chakra Petch';font-weight:700;font-size:17px;letter-spacing:2.5px;display:flex;align-items:center;gap:8px}
  .brand .gem{color:var(--acc)}
  nav .links{display:flex;gap:22px;margin-left:6px}
  nav .links a{font-size:14px;color:var(--mut);transition:color .15s}nav .links a:hover{color:var(--txt)}
  .navend{margin-left:auto;display:flex;align-items:center;gap:14px}
  .pill{display:inline-flex;align-items:center;gap:8px;font-size:12px;color:var(--grn);border:1px solid rgba(54,211,153,.25);background:rgba(54,211,153,.07);padding:5px 11px;border-radius:999px}
  .pill .dot{width:6px;height:6px;border-radius:50%;background:var(--grn)}
  .btn{font-family:Inter;font-weight:600;padding:11px 19px;border-radius:11px;font-size:14px;cursor:pointer;border:1px solid transparent;transition:transform .15s,border-color .15s,background .15s;display:inline-block}
  .btn.sm{padding:8px 15px;font-size:13px}
  .btn.primary{background:var(--acc);color:#1a0c02}
  .btn.primary:hover{transform:translateY(-1px);background:#ff8a33}
  .btn.ghost{background:transparent;border-color:var(--line);color:var(--txt)}
  .btn.ghost:hover{border-color:var(--acc);color:var(--acc)}

  .hero{display:grid;grid-template-columns:1.05fr .95fr;gap:36px;align-items:center;padding:72px 0 48px}
  .hero h1{font-size:clamp(38px,6.5vw,72px);line-height:1.02;letter-spacing:.01em}
  .hero h1 .stroke{color:var(--acc)}
  .hero .sub{margin:22px 0 6px;font-size:17px;line-height:1.7;color:var(--mut);max-width:500px}
  .hero .quote{color:var(--dim);font-size:13px;margin:14px 0 28px;font-family:'IBM Plex Mono'}
  .chips{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:28px}
  .chip{border:1px solid var(--line);border-radius:10px;padding:9px 13px;font-size:13px;color:var(--mut)}
  .chip b{font-family:'Chakra Petch';color:var(--txt);margin-right:4px}
  .btns{display:flex;gap:12px;flex-wrap:wrap}
  .canvas-wrap{position:relative;aspect-ratio:1/1;width:100%}
  canvas{width:100%;height:100%;display:block}
  .canvas-cap{position:absolute;bottom:2px;left:0;right:0;text-align:center;font-size:11px;color:var(--dim);letter-spacing:.5px}

  section{padding:40px 0}
  .head{margin-bottom:26px}
  .head h2{font-size:clamp(24px,3.6vw,38px);margin-top:10px}
  .head .mut{margin:8px 0 0;max-width:640px}
  .bento{display:grid;grid-template-columns:repeat(6,1fr);gap:16px}
  .card{grid-column:span 3;background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:20px 22px;transition:transform .18s,border-color .18s}
  .card:hover{transform:translateY(-2px);border-color:rgba(255,122,26,.3)}
  .card.span2{grid-column:span 4}.card.span-full{grid-column:span 6}.card.span-sm{grid-column:span 2}
  .card h3{font-size:12px;letter-spacing:1px;color:var(--mut);text-transform:uppercase;margin-bottom:14px;font-weight:600}
  .vcard .ic{width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;background:rgba(255,122,26,.1);color:var(--acc);margin-bottom:12px}
  .vcard h3{font-size:16px;color:var(--txt);text-transform:none;letter-spacing:0;margin-bottom:6px;font-family:Inter}
  .vcard p{color:var(--mut);font-size:13.5px;margin:0}
  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:28px 0;margin:10px 0}
  .stat b{font-family:'Chakra Petch';font-size:clamp(28px,4.5vw,44px);display:block;color:var(--txt)}
  .stat span{color:var(--mut);font-size:13px}
  .steps{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
  .step{border:1px solid var(--line);border-radius:var(--r);padding:20px;background:var(--surface)}
  .step .n{font-family:'IBM Plex Mono';font-size:12px;color:var(--acc);letter-spacing:1px}
  .step h3{font-size:17px;color:var(--txt);text-transform:none;margin:9px 0;letter-spacing:0;font-family:Inter}
  .step p{color:var(--mut);font-size:13.5px;margin:0}.step code,.proof code{font-family:'IBM Plex Mono';color:var(--am);font-size:.92em}
  .proof{margin-top:18px;border:1px solid var(--line);border-radius:var(--r);padding:18px 20px;background:var(--surface)}
  .cta{text-align:center;border:1px solid var(--line);border-radius:20px;padding:52px 24px;background:var(--surface)}
  .cta h2{font-size:clamp(26px,4.5vw,44px);margin-bottom:18px}

  .pipe{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:14px 0 32px}
  .stage{border:1px solid var(--line);background:var(--surface);border-radius:13px;padding:15px 17px}
  .stage .k{font-size:11px;letter-spacing:1.5px;color:var(--dim)}
  .stage .v{font-family:'Chakra Petch';font-size:23px;margin-top:3px}
  .stage .s{font-size:12px;color:var(--dim);margin-top:2px}

  table{width:100%;border-collapse:collapse;font-size:13.5px;font-family:'IBM Plex Mono'}
  th,td{text-align:left;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.05)}
  tr:last-child td{border-bottom:none}
  th{color:var(--dim);font-weight:500;font-size:11px;text-transform:uppercase;letter-spacing:.5px;font-family:Inter}
  td.r,th.r{text-align:right}
  .bar{height:5px;background:rgba(255,255,255,.06);border-radius:3px;overflow:hidden}.bar>i{display:block;height:100%;background:var(--acc)}
  .gauge{display:flex;align-items:baseline;gap:9px;margin:2px 0 12px}.gauge b{font-family:'Chakra Petch';font-size:34px}
  .latcard{height:260px;padding:0!important;position:relative;overflow:hidden}.latcard canvas{position:absolute;inset:0}
  .kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin:0 0 20px}
  .kpi{border:1px solid var(--line);border-radius:13px;padding:13px 15px;background:var(--surface)}
  .kpi b{font-family:'Chakra Petch';font-size:22px;display:block;line-height:1.1}
  .kpi span{font-size:11px;color:var(--dim);letter-spacing:.5px;text-transform:uppercase}
  .feed{font-family:'IBM Plex Mono';font-size:12.5px;color:var(--mut);max-height:190px;overflow:auto}
  .feed div{padding:4px 0;border-bottom:1px solid rgba(255,255,255,.04)}
  @media(max-width:880px){.kpis{grid-template-columns:repeat(2,1fr)}}
  .ticker{border-bottom:1px solid var(--line);background:rgba(0,0,0,.22);overflow:hidden;white-space:nowrap}
  .ticker .track{display:inline-block;padding:8px 0;animation:tick 48s linear infinite;font-family:'IBM Plex Mono';font-size:13px;will-change:transform}
  .ticker:hover .track{animation-play-state:paused}
  .ticker .it{margin:0 18px;color:var(--mut)}.ticker .it b{color:var(--txt)}
  @keyframes tick{from{transform:translateX(0)}to{transform:translateX(-50%)}}
  .ring{position:relative;width:128px;height:128px;margin:8px auto 2px}
  .ring svg{width:128px;height:128px}.ring .ring-bg{fill:none;stroke:rgba(255,255,255,.06);stroke-width:9}
  .ring-val{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:'Chakra Petch';font-size:32px}

  .skel{display:inline-block;height:13px;width:60%;border-radius:6px;background:linear-gradient(90deg,rgba(255,255,255,.05),rgba(255,255,255,.11),rgba(255,255,255,.05));background-size:200% 100%;animation:sh 1.3s infinite}
  @keyframes sh{0%{background-position:200% 0}100%{background-position:-200% 0}}

  .window{border:1px solid var(--line);border-radius:var(--r);overflow:hidden;background:var(--surface2)}
  .winbar{display:flex;align-items:center;gap:9px;padding:11px 15px;border-bottom:1px solid var(--line);background:rgba(255,255,255,.02)}
  .winbar .dots{display:flex;gap:6px}.winbar .dots i{width:9px;height:9px;border-radius:50%;background:#33333d;display:block}
  .winbar .url{font-size:12px;color:var(--dim);font-family:'IBM Plex Mono'}
  .winbody{padding:18px}
  .pvgrid{display:grid;grid-template-columns:1.5fr 1fr;gap:20px;margin:14px 0}
  .winbody h3{font-size:12px;letter-spacing:1px;color:var(--mut);text-transform:uppercase;margin:0 0 10px}

  footer{border-top:1px solid var(--line);padding:28px 0 46px;margin-top:34px;color:var(--mut);font-size:13.5px}
  footer .row{display:flex;justify-content:space-between;flex-wrap:wrap;gap:16px;align-items:flex-end}
  .big-foot{font-family:'Chakra Petch';font-weight:700;font-size:clamp(40px,11vw,120px);letter-spacing:.06em;line-height:1;text-align:center;color:rgba(255,255,255,.035);margin-top:18px;user-select:none}
  .reveal{opacity:0;transform:translateY(14px);transition:opacity .5s ease,transform .5s ease}.reveal.in{opacity:1;transform:none}
  @media(prefers-reduced-motion:reduce){.reveal{opacity:1;transform:none;transition:none}}
  @media(max-width:880px){.hero{grid-template-columns:1fr;gap:24px}.pipe,.stats{grid-template-columns:repeat(2,1fr)}.bento{grid-template-columns:1fr}.card,.card.span2,.card.span-full,.card.span-sm{grid-column:auto}.canvas-wrap{max-width:420px;margin:0 auto}.steps,.pvgrid{grid-template-columns:1fr}nav .links{display:none}}
`;

const LATTICE_JS = `(function(){
var L={};
L.mount=function(id){
  var cv=document.getElementById(id); if(!cv) return;
  var ctx=cv.getContext('2d'); var DPR=Math.min(2,window.devicePixelRatio||1);
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function makeSprite(rgb){
    var R=48, s=document.createElement('canvas'); s.width=s.height=R*2;
    var c=s.getContext('2d'), g=c.createRadialGradient(R,R,0,R,R,R);
    g.addColorStop(0,'rgba('+rgb+',0.95)'); g.addColorStop(0.28,'rgba('+rgb+',0.45)'); g.addColorStop(1,'rgba('+rgb+',0)');
    c.fillStyle=g; c.beginPath(); c.arc(R,R,R,0,6.283); c.fill(); return s;
  }
  var spChamp=makeSprite('255,122,26'), spConf=makeSprite('255,84,112');
  var G={nodes:[],edges:[]}, t0=Date.now(), last=0, paused=false;
  document.addEventListener('visibilitychange', function(){ paused=document.hidden; });
  function size(){ var r=cv.getBoundingClientRect(); cv.width=Math.max(1,Math.round(r.width*DPR)); cv.height=Math.max(1,Math.round(r.height*DPR)); }
  window.addEventListener('resize', function(){ size(); if(reduce) render(); });
  size();
  function build(scan){
    var champs=(scan.nodes||[]).filter(function(n){return n.kind==='championship';}).slice(0,8);
    var confs=(scan.nodes||[]).filter(function(n){return n.kind==='conference';});
    var nodes=[], map={};
    champs.forEach(function(n,i){var a=(i/Math.max(1,champs.length))*6.283;var nd={team:n.team,kind:'championship',prob:n.prob,ang:a,ring:0.33,ph:i*0.8};nodes.push(nd);map[n.team]=nd;});
    confs.forEach(function(n,i){var b=map[n.team];var a=b?b.ang:(i/Math.max(1,confs.length))*6.283;nodes.push({team:n.team,kind:'conference',prob:n.prob,ang:a,ring:0.45,ph:i*1.2});});
    var edges=[];
    confs.forEach(function(n){var a=map[n.team];if(a)edges.push([a,n.team]);});
    G={nodes:nodes,edges:edges,confMap:{}};
    G.byKey={}; nodes.forEach(function(n){G.byKey[n.team+':'+n.kind]=n;});
    if(reduce) render();
  }
  fetch('/api/scan').then(function(r){return r.json();}).then(build).catch(function(){});
  setInterval(function(){ fetch('/api/scan').then(function(r){return r.json();}).then(build).catch(function(){}); }, 30000);
  function P(n,T,rot,cx,cy,R){var a=n.ang+rot;var rr=(n.ring+Math.sin(T*0.7+n.ph)*0.01)*R;return [cx+Math.cos(a)*rr,cy+Math.sin(a)*rr];}
  function render(){
    var W=cv.width,H=cv.height; if(!W) return;
    var cx=W/2,cy=H/2,R=Math.min(W,H),T=(Date.now()-t0)/1000,rot=reduce?0:T*0.035;
    ctx.clearRect(0,0,W,H);
    ctx.lineWidth=1.3*DPR;
    G.nodes.forEach(function(n){ n._p=P(n,T,rot,cx,cy,R); });
    var pulse=0.16+0.10*Math.sin(T*1.4);
    G.edges.forEach(function(e){var a=e[0]._p, b=G.byKey[e[1]+':conference']._p; if(!a||!b)return;
      ctx.strokeStyle='rgba(255,122,26,'+pulse.toFixed(3)+')';
      ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.stroke();
    });
    G.nodes.forEach(function(n){var p=n._p; var rad=(7+Math.sqrt(Math.max(0,n.prob))*30)*DPR;
      var s=n.kind==='championship'?spChamp:spConf;
      ctx.drawImage(s, p[0]-rad, p[1]-rad, rad*2, rad*2);
      ctx.fillStyle=n.kind==='championship'?'#ffb574':'#ff9bb0';
      ctx.beginPath(); ctx.arc(p[0],p[1],2.2*DPR,0,6.283); ctx.fill();
      if(n.prob>0.12){ctx.fillStyle='rgba(233,233,240,0.82)';ctx.font='600 '+(11*DPR)+"px Inter,sans-serif";ctx.textAlign='center';ctx.fillText(n.team.split(' ').slice(-1)[0],p[0],p[1]-rad*0.9);}
    });
  }
  function frame(ts){ requestAnimationFrame(frame); if(paused) return; if(ts-last<33) return; last=ts; render(); }
  if(reduce){ render(); } else { requestAnimationFrame(frame); }
};
window.Lattice=L;
})();`;

const HEAD = `<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@600;700&family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${CSS}</style>`;

const REVEAL_JS = `var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{threshold:.1});document.querySelectorAll('.reveal').forEach(function(n){io.observe(n);});`;

export const LANDING = `<!doctype html><html lang="en"><head>
<title>Arbiter — market-neutral arbitrage for prediction markets</title>${HEAD}</head>
<body>
<nav><div class="wrap">
  <div class="brand"><span class="gem">&#9670;</span> ARBITER</div>
  <div class="links"><a href="#product">Product</a><a href="#how">How it works</a><a href="#crossvenue">Cross-venue</a></div>
  <div class="navend"><a class="btn primary sm" href="/dashboard">Launch dashboard</a></div>
</div></nav>

<header class="wrap hero">
  <div>
    <div class="label"><span class="dot"></span> market-neutral &middot; model-free &middot; on Canon</div>
    <h1>Enforce the <span class="stroke">math</span> the market forgot</h1>
    <p class="sub">An AI-driven arbitrage engine for prediction markets. It never predicts who wins &mdash; it harvests the instants when a market's own prices break the logic that connects them.</p>
    <p class="quote">P(champion) &le; P(conference) &le; P(series) &nbsp;&middot;&nbsp; &Sigma; P = 1 &nbsp;&middot;&nbsp; YES + NO &ge; 1</p>
    <div class="chips">
      <span class="chip"><b id="cMkts">&middot;&middot;&middot;</b> live markets</span>
      <span class="chip"><b>2</b> venues</span>
      <span class="chip"><b id="cNodes">&middot;</b> lattice nodes</span>
      <span class="chip"><b>0</b> forecasts</span>
    </div>
    <div class="btns"><a class="btn primary" href="/dashboard">Launch live dashboard</a><a class="btn ghost" href="#how">How it works</a></div>
  </div>
  <div class="canvas-wrap"><canvas id="lattice"></canvas><div class="canvas-cap">live lattice &middot; node size = implied probability</div></div>
</header>

<main class="wrap">
  <section id="product">
    <div class="head reveal"><div class="label"><span class="dot"></span> beyond prediction</div><h2>A different kind of edge</h2></div>
    <div class="bento">
      <div class="card vcard reveal"><div class="ic">&#9678;</div><h3>Model-free</h3><p>No forecasts, no alpha. The edge is pure internal price inconsistency &mdash; the market contradicting itself.</p></div>
      <div class="card vcard reveal"><div class="ic">&#8646;</div><h3>Market-neutral</h3><p>Every trade is a hedged basket with a locked, non-negative payoff regardless of the game result.</p></div>
      <div class="card vcard reveal"><div class="ic">&#9783;</div><h3>Multi-venue</h3><p>Watches the same market on Polymarket and Kalshi and arbs disagreements between independent books.</p></div>
      <div class="card vcard reveal"><div class="ic">&#10022;</div><h3>AI-classified</h3><p>A free-tier LLM maps any market into the lattice, so the same engine generalizes to any sport or event.</p></div>
    </div>
    <div class="stats reveal">
      <div class="stat"><b id="sMkts">600+</b><span>live markets scanned</span></div>
      <div class="stat"><b>30</b><span>teams in the lattice</span></div>
      <div class="stat"><b>2</b><span>venues, fee-aware</span></div>
      <div class="stat"><b>43</b><span>passing tests</span></div>
    </div>
  </section>

  <section id="how">
    <div class="head reveal"><div class="label"><span class="dot"></span> how it works</div><h2>Three layers of coherence</h2></div>
    <div class="steps">
      <div class="step reveal"><div class="n">L0 &middot; WITHIN-MARKET</div><h3>Complementary</h3><p>If <code>ask(YES) + ask(NO) &lt; 1</code> on one market, buy both sides for a guaranteed dollar.</p></div>
      <div class="step reveal"><div class="n">L1 &middot; SINGLE EVENT</div><h3>Dutch book</h3><p>The 30 title outcomes are exhaustive. If &Sigma; <code>ask(YES) &lt; 1</code>, buy them all for under a dollar.</p></div>
      <div class="step reveal"><div class="n">L2 &middot; CROSS-EVENT</div><h3>Implication</h3><p>Champion &#8849; conference. When <code>P(champion) &gt; P(conference)</code>, short the dear leg, buy the cheap one.</p></div>
    </div>
    <div class="proof reveal"><b class="acc">Why it's risk-free:</b> <span class="mut">if a team's championship price <code>a</code> exceeds its conference price <code>b</code>, buy NO(champion) at <code>(1&minus;a)</code> + YES(conference) at <code>b</code>. The minimum payout in every outcome is <b>$1</b> (the "wins title but not conference" case is impossible) for a cost of <code>(1&minus;a)+b</code> &mdash; a guaranteed <b class="grn">a &minus; b</b>, with no view on the game.</span></div>
  </section>

  <section id="crossvenue">
    <div class="head reveal"><div class="label"><span class="dot"></span> the frontier</div><h2>Same market, two venues</h2>
      <p class="mut">Polymarket and Kalshi each run the 2026 NBA Champion market on independent order books. When they disagree beyond fees, that gap is a locked cross-venue arbitrage &mdash; shown live below.</p></div>
    <div class="window reveal">
      <div class="winbar"><span class="dots"><i></i><i></i><i></i></span><span class="url">arbiter // live dashboard</span></div>
      <div class="winbody">
        <div class="pipe" id="pvStages"></div>
        <div class="pvgrid">
          <div><h3>Cross-venue (live)</h3><div id="pvXv"><span class="skel"></span></div></div>
          <div><h3>Coherence</h3><div id="pvCoh"><span class="skel"></span></div></div>
        </div>
        <a class="btn primary" href="/dashboard">Open the full dashboard</a>
      </div>
    </div>
  </section>
</main>

<footer><div class="wrap"><div class="row">
  <div><div class="brand"><span class="gem">&#9670;</span> ARBITER</div><div class="mut" style="margin-top:8px">It doesn't predict the game &mdash; it enforces the math the market forgot.</div></div>
  <div class="mut">DEGA NBA Prediction Market Hackathon &middot; built on Canon<br>Polymarket + Kalshi &middot; live, read-only &middot; market-neutral</div>
</div><div class="big-foot">ARBITER</div></div></footer>

<script>${LATTICE_JS}</script>
<script>
Lattice.mount('lattice');
var pct=function(x){return x==null?'—':(x*100).toFixed(1)+'%';};
function setH(id,h){var e=document.getElementById(id);if(e)e.innerHTML=h;}
fetch('/api/scan').then(function(r){return r.json();}).then(function(s){
  var a=document.getElementById('cMkts'); if(a)a.textContent=s.marketCount;
  var b=document.getElementById('cNodes'); if(b)b.textContent=s.nodeCount;
  var c=document.getElementById('sMkts'); if(c)c.textContent=s.marketCount;
  var armed=s.tradeableCount>0;
  var cells=[['FETCH',s.marketCount+' mkts'],['ANALYZE',s.nodeCount+' nodes'],['DECIDE',s.tradeableCount+' edges'],['EXECUTE',armed?'ARMED':'WATCHING']];
  setH('pvStages',cells.map(function(x){return '<div class="stage"><div class="k">'+x[0]+'</div><div class="v">'+x[1]+'</div></div>';}).join(''));
  if(s.partitions&&s.partitions.length){var p=s.partitions[0];setH('pvCoh','<div class="gauge"><b class="am">'+(p.overround>=0?'+':'')+pct(p.overround)+'</b><span class="mut">overround</span></div><div class="mut" style="font-size:12px">'+p.label+' &middot; &Sigma;='+p.sum.toFixed(3)+'</div>');}
}).catch(function(){});
fetch('/api/crossvenue').then(function(r){return r.json();}).then(function(c){
  if(c.error||!c.rows||!c.rows.length){setH('pvXv','<span class="mut">no overlap right now</span>');return;}
  setH('pvXv','<table><tr><th>Team</th><th class="r">PM</th><th class="r">Kalshi</th><th class="r">Edge</th></tr>'+c.rows.slice(0,4).map(function(r){return '<tr><td>'+r.team+'</td><td class="r acc">'+pct(r.pmYes)+'</td><td class="r pk">'+pct(r.kalshiYes)+'</td><td class="r '+(r.tradeable?'grn':'mut')+'">'+(r.netEdge>=0?'+':'')+pct(r.netEdge)+'</td></tr>';}).join('')+'</table>');
}).catch(function(){setH('pvXv','<span class="mut">unavailable</span>');});
${REVEAL_JS}
</script>
</body></html>`;

export const DASHBOARD = `<!doctype html><html lang="en"><head>
<title>Arbiter — live dashboard</title>${HEAD}</head>
<body>
<nav><div class="wrap">
  <div class="brand"><span class="gem">&#9670;</span> ARBITER</div>
  <div class="links"><a href="/">&larr; Site</a><a href="#xv-s">Cross-venue</a><a href="#perf-s">Performance</a></div>
  <div class="navend"><span class="pill"><span class="dot"></span><span id="navstatus">live</span></span></div>
</div></nav>
<div class="ticker"><div class="track" id="ticker"></div></div>

<main class="wrap">
  <section style="padding-top:38px">
    <div class="head reveal"><div class="label"><span class="dot"></span> live engine</div><h2>Automation pipeline</h2></div>
    <div class="pipe reveal" id="pipe"></div>
    <div class="kpis reveal" id="kpis"></div>
    <div class="bento">
      <div class="card span-full reveal"><h3>Live edge capture &mdash; detect → size → execute → P&amp;L</h3>
        <div id="demoBox"><button class="btn primary" id="demoRun">&#9654; Capture an edge</button> <span class="dim" style="font-size:12px">runs a real-magnitude dislocation through the full pipeline</span></div></div>
      <div class="card span-full reveal"><h3>AI agents &mdash; live reasoning (analyst → architect → developer → QA)</h3><div id="agentsBox"><span class="skel"></span></div></div>
      <div class="card span-full reveal"><h3>Live activity</h3><div class="feed" id="feed"><span class="dim">awaiting first scan…</span></div></div>
      <div class="card span2 reveal"><h3>Coherence lattice &mdash; top nodes by implied probability</h3><div id="lat"><span class="skel"></span></div></div>
      <div class="card span-sm reveal"><h3>Coherence score</h3><div id="coh"><span class="skel"></span></div></div>
      <div class="card span-sm reveal latcard"><canvas id="dlattice"></canvas></div>
      <div class="card span2 reveal"><h3>Tradeable edges &mdash; net of live spread</h3><div id="edges"><span class="skel"></span></div></div>
      <div class="card span-full reveal" id="xv-s"><h3>Cross-venue &mdash; Polymarket vs Kalshi (fee-aware)</h3><div id="xv"><span class="skel"></span></div></div>
      <div class="card span-full reveal" id="perf-s"><h3>Backtest &amp; cost sensitivity &mdash; champion &#8849; conference</h3>
        <div id="bt"><button class="btn ghost" id="btRun">Run live backtest</button> <span class="dim" style="font-size:12px">replays a full season &middot; ~30&ndash;60s</span></div></div>
    </div>
  </section>
</main>

<footer><div class="wrap"><div class="row">
  <div class="mut">&#9670; ARBITER &middot; live dashboard &middot; auto-refresh 30s</div>
  <div class="mut">paper-trading against the live book &middot; market-neutral</div>
</div></div></footer>

<script>${LATTICE_JS}</script>
<script>
var pct=function(x){return x==null?'—':(x*100).toFixed(1)+'%';};
var usd=function(x){return '$'+(Number(x)||0).toFixed(2);};
function set(id,h){var e=document.getElementById(id);if(e)e.innerHTML=h;}
function stages(s){var armed=s.tradeableCount>0;
  var c=[['FETCH',s.marketCount+' mkts','Polymarket + Kalshi'],['ANALYZE',s.nodeCount+' nodes',(s.partitions?s.partitions.length:0)+((s.partitions&&s.partitions.length===1)?' partition':' partitions')],['DECIDE',s.tradeableCount+' edges','min edge '+pct(s.minEdge)],['EXECUTE',armed?'ARMED':'WATCHING','paper, neutral']];
  set('pipe',c.map(function(x){return '<div class="stage"><div class="k">'+x[0]+'</div><div class="v">'+x[1]+'</div><div class="s">'+x[2]+'</div></div>';}).join(''));}
function lat(s){var champ=(s.nodes||[]).filter(function(n){return n.kind==='championship';});set('lat','<canvas id="oddsc" style="width:100%;display:block;margin-bottom:12px"></canvas><table><tr><th>Team</th><th>Kind</th><th class="r">Implied P</th><th></th></tr>'+s.nodes.slice(0,8).map(function(n){return '<tr><td>'+n.team+'</td><td class="mut">'+n.kind+'</td><td class="r">'+pct(n.prob)+'</td><td style="width:110px"><div class="bar"><i style="width:'+Math.max(2,Math.min(100,n.prob*100)).toFixed(0)+'%"></i></div></td></tr>';}).join('')+'</table>');drawOddsChart(document.getElementById('oddsc'),champ);}
function coh(s){if(!s.partitions||!s.partitions.length){set('coh','<span class="mut">no partitions</span>');return;}var p=s.partitions[0];var t=Math.abs(p.overround)<0.01;
  var score=Math.max(0,Math.min(100,Math.round(100-Math.abs(p.overround)*100)));var circ=2*Math.PI*52;var off=circ*(1-score/100);var col=score>70?'#36d399':(score>40?'#f5b740':'#ff7a1a');var note=score>70?'efficient — few edges':(score>40?'some incoherence':'incoherent — edges likely');
  var h='<div class="ring"><svg viewBox="0 0 120 120"><circle class="ring-bg" cx="60" cy="60" r="52"></circle><circle cx="60" cy="60" r="52" fill="none" stroke="'+col+'" stroke-width="9" stroke-linecap="round" stroke-dasharray="'+circ.toFixed(1)+'" stroke-dashoffset="'+off.toFixed(1)+'" transform="rotate(-90 60 60)"></circle></svg><div class="ring-val" style="color:'+col+'">'+score+'</div></div>';
  h+='<div class="mut" style="text-align:center;font-size:12px;margin:2px 0 12px">'+note+'</div>';
  h+=s.partitions.map(function(q){var tt=Math.abs(q.overround)<0.01;return '<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:12px"><span class="mut">'+q.label+'</span><span class="'+(tt?'grn':'am')+'">&Sigma; '+q.sum.toFixed(3)+'</span></div>';}).join('');set('coh',h);}
function edges(s){var t=(s.edges||[]).filter(function(e){return e.tradeable;});
  if(!t.length){set('edges','<div style="padding:6px 0"><span class="grn">&#10003; coherent at tradeable prices</span><div class="mut" style="font-size:13px;margin-top:6px">No arb clears the spread right now. The engine keeps scanning '+s.marketCount+' markets and fires the instant one dislocates.</div></div>');return;}
  set('edges','<table><tr><th>Type</th><th class="r">Net edge</th><th class="r">Legs</th><th>Rationale</th></tr>'+t.map(function(e){return '<tr><td class="pk">'+e.type+'</td><td class="r grn">'+pct(e.netEdge)+'</td><td class="r">'+e.legs+'</td><td class="mut">'+e.rationale+'</td></tr>';}).join('')+'</table>');}
function xv(c){if(c.error||!c.rows||!c.rows.length){set('xv','<span class="mut">'+(c.error||'no overlapping liquid markets right now')+'</span>');return;}
  set('xv','<canvas id="xvc" style="width:100%;display:block;margin-bottom:6px"></canvas><div class="mut" style="font-size:11px;margin-bottom:10px"><span class="acc">&#9632;</span> Polymarket &nbsp;&nbsp; <span class="pk">&#9632;</span> Kalshi</div><div class="mut" style="font-size:12px;margin-bottom:10px">'+c.pmCount+' Polymarket &middot; '+c.kalshiCount+' Kalshi &middot; '+c.matched+' matched</div><table><tr><th>Team</th><th class="r">Polymarket YES</th><th class="r">Kalshi YES</th><th>Best arb direction</th><th class="r">Net edge</th></tr>'+c.rows.map(function(r){return '<tr><td>'+r.team+'</td><td class="r acc">'+pct(r.pmYes)+'</td><td class="r pk">'+pct(r.kalshiYes)+'</td><td class="mut">'+r.dir+'</td><td class="r '+(r.tradeable?'grn':'mut')+'">'+(r.netEdge>=0?'+':'')+pct(r.netEdge)+'</td></tr>';}).join('')+'</table>');var _xc=document.getElementById('xvc');if(_xc)drawXvChart(_xc,c.rows);}
function bt(b){if(b.error){set('bt','<span class="mut">backtest unavailable: '+b.error+'</span>');return;}if(!b.rows||!b.rows.length){set('bt','<span class="mut">no opportunities in window</span>');return;}
  var _r=(b.rows||[]).filter(function(r){return Math.abs(r.haircut-0.005)<1e-9;})[0]||b.rows[b.rows.length-1];if(_r){lastRoi=_r.roiPct.toFixed(2)+'%';var _k=document.getElementById('kpiRoi');if(_k)_k.textContent=lastRoi;}
  set('bt','<canvas id="eqc" style="width:100%;height:120px;display:block;margin:0 0 8px"></canvas><div class="dim" style="font-size:11px;margin-bottom:10px">cumulative captured edge (gross, before per-leg costs)</div><div class="mut" style="font-size:12px;margin-bottom:10px">'+b.pairsTested+' team pairs &middot; market-neutral</div><table><tr><th>Cost / leg</th><th class="r">Opportunities</th><th class="r">Deployed</th><th class="r">Locked profit</th><th class="r">ROI</th></tr>'+b.rows.map(function(r){var c=r.profitUsd>=0?'grn':'red';return '<tr><td>'+pct(r.haircut)+'</td><td class="r">'+r.opportunities+'</td><td class="r mut">'+usd(r.deployedUsd)+'</td><td class="r '+c+'">'+usd(r.profitUsd)+'</td><td class="r '+c+'">'+r.roiPct.toFixed(2)+'%</td></tr>';}).join('')+'</table>');var _eq=document.getElementById('eqc');if(_eq)drawEquity(_eq,b.equity||[]);}
function ticker(s){var items=(s.nodes||[]).filter(function(n){return n.kind==='championship';}).slice(0,12).map(function(n){return '<span class="it">'+n.team.split(' ').slice(-1)[0]+' <b>'+(n.prob*100).toFixed(1)+'%</b></span>';}).join('');var t=document.getElementById('ticker');if(t&&items)t.innerHTML=items+items;}
function drawEquity(cv,eq){if(!cv||!eq||eq.length<2)return;var DPR=Math.min(2,window.devicePixelRatio||1);var r=cv.getBoundingClientRect();cv.width=Math.max(1,r.width*DPR);cv.height=120*DPR;var ctx=cv.getContext('2d');var ys=eq.map(function(e){return e.cum;});var mx=Math.max.apply(null,ys);var mn=Math.min(0,Math.min.apply(null,ys));var rng=(mx-mn)||1;var W=cv.width,H=cv.height;ctx.clearRect(0,0,W,H);ctx.beginPath();eq.forEach(function(e,i){var x=(i/(eq.length-1))*W;var y=H-((e.cum-mn)/rng)*(H*0.86)-H*0.07;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.strokeStyle='#36d399';ctx.lineWidth=2*DPR;ctx.stroke();ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.closePath();ctx.fillStyle='rgba(54,211,153,0.09)';ctx.fill();}
function drawOddsChart(cv,nodes){if(!cv||!nodes||!nodes.length)return;var DPR=Math.min(2,window.devicePixelRatio||1);var r=cv.getBoundingClientRect();var rows=nodes.slice(0,8);var rh=23;cv.width=Math.max(1,r.width*DPR);cv.height=rows.length*rh*DPR;var ctx=cv.getContext('2d');var W=cv.width,H=cv.height;ctx.clearRect(0,0,W,H);var max=Math.max.apply(null,rows.map(function(n){return n.prob;}))||1;var lw=104*DPR,pad=46*DPR,bm=W-lw-pad;rows.forEach(function(n,i){var y=i*rh*DPR+rh*DPR*0.5;var bw=Math.max(2,(n.prob/max)*bm);ctx.fillStyle='rgba(255,255,255,.06)';ctx.fillRect(lw,y-5*DPR,bm,9*DPR);var g=ctx.createLinearGradient(lw,0,lw+bw,0);g.addColorStop(0,'#ff7a1a');g.addColorStop(1,'#ff5470');ctx.fillStyle=g;ctx.fillRect(lw,y-5*DPR,bw,9*DPR);ctx.fillStyle='rgba(233,233,240,.85)';ctx.font=(12*DPR)+'px Inter,sans-serif';ctx.textAlign='left';ctx.fillText(n.team.split(' ').slice(-1)[0],2,y+4*DPR);ctx.textAlign='right';ctx.fillStyle='#ff9a4d';ctx.fillText((n.prob*100).toFixed(1)+'%',W-2,y+4*DPR);});}
function drawXvChart(cv,rows){if(!cv||!rows||!rows.length)return;var DPR=Math.min(2,window.devicePixelRatio||1);var r=cv.getBoundingClientRect();var data=rows.slice(0,6);var rh=32;cv.width=Math.max(1,r.width*DPR);cv.height=data.length*rh*DPR;var ctx=cv.getContext('2d');var W=cv.width,H=cv.height;ctx.clearRect(0,0,W,H);var lw=120*DPR,pad=48*DPR,bm=W-lw-pad;var mx=Math.max.apply(null,data.map(function(d){return Math.max(d.pmYes||0,d.kalshiYes||0);}))||1;data.forEach(function(d,i){var y=i*rh*DPR;ctx.fillStyle='rgba(233,233,240,.85)';ctx.font=(11*DPR)+'px Inter,sans-serif';ctx.textAlign='left';ctx.fillText(d.team.split(' ').slice(-1)[0],2,y+rh*DPR*0.5+3*DPR);ctx.fillStyle='#ff7a1a';ctx.fillRect(lw,y+6*DPR,Math.max(2,((d.pmYes||0)/mx)*bm),8*DPR);ctx.fillStyle='#ff5470';ctx.fillRect(lw,y+17*DPR,Math.max(2,((d.kalshiYes||0)/mx)*bm),8*DPR);ctx.fillStyle='rgba(154,154,172,.9)';ctx.font=(10*DPR)+'px IBM Plex Mono,monospace';ctx.textAlign='right';ctx.fillText(((d.pmYes||0)*100).toFixed(0)+'%',W-2,y+12*DPR);ctx.fillText(((d.kalshiYes||0)*100).toFixed(0)+'%',W-2,y+23*DPR);});}
var lastRoi='—';
function tile(v,l){return '<div class="kpi"><b>'+v+'</b><span>'+l+'</span></div>';}
function kpis(s){var ov=(s.partitions&&s.partitions[0])?((s.partitions[0].overround>=0?'+':'')+pct(s.partitions[0].overround)):'—';set('kpis',tile(s.marketCount,'markets')+tile(s.nodeCount,'lattice nodes')+tile(ov,'overround')+tile(s.tradeableCount,'tradeable edges')+tile('2','venues')+'<div class="kpi"><b id="kpiRoi">'+lastRoi+'</b><span>backtest ROI</span></div>');}
var feedLines=[];
function feed(s){var now=new Date().toLocaleTimeString();var ov=(s.partitions&&s.partitions[0])?(s.partitions[0].overround*100).toFixed(0)+'%':'—';var st=s.tradeableCount>0?'ARMED':'coherent';feedLines.unshift(now+'  scan '+s.marketCount+' mkts · '+s.nodeCount+' nodes · overround '+ov+' · '+s.tradeableCount+' tradeable · '+st);if(feedLines.length>8)feedLines.pop();set('feed',feedLines.map(function(l){return '<div>'+l+'</div>';}).join(''));}
function loadScan(){fetch('/api/scan').then(function(r){return r.json();}).then(function(s){stages(s);ticker(s);kpis(s);feed(s);lat(s);coh(s);edges(s);var n=document.getElementById('navstatus');if(n)n.textContent='live · '+new Date().toLocaleTimeString();}).catch(function(){var n=document.getElementById('navstatus');if(n)n.textContent='reconnecting';});}
function loadXv(){fetch('/api/crossvenue').then(function(r){return r.json();}).then(xv).catch(function(){set('xv','<span class="mut">cross-venue unavailable</span>');});}
document.getElementById('btRun').addEventListener('click',function(){set('bt','<span class="skel" style="width:40%"></span> <span class="mut" style="font-size:12px">replaying real price history…</span>');fetch('/api/backtest').then(function(r){return r.json();}).then(bt).catch(function(){set('bt','<span class="mut">backtest failed</span>');});});
function agentsRender(d){if(!d||!d.analyst){set('agentsBox','<span class="mut">agents unavailable</span>');return;}
  var roles=[['Market Analyst',d.analyst,'acc'],['Strategy Architect',d.architect,'pk'],['Developer',d.developer,'am'],['QA',d.qa,(d.qa&&d.qa.approved)?'grn':'red']];
  set('agentsBox','<div class="mut" style="font-size:12px;margin-bottom:12px">provider: '+(d.provider||'—')+'</div>'+roles.map(function(r){var a=r[1]||{};return '<div style="margin-bottom:13px"><span class="'+r[2]+'" style="font-weight:600">● '+r[0]+'</span> <span class="dim" style="font-size:11px">['+(a.source||'')+']</span><div class="mut" style="font-size:13px;margin-top:3px;line-height:1.55">'+(a.content||'')+'</div></div>';}).join(''));}
function loadAgents(){set('agentsBox','<span class="skel"></span> <span class="dim" style="font-size:12px">agents thinking…</span>');fetch('/api/agents').then(function(r){return r.json();}).then(agentsRender).catch(function(){set('agentsBox','<span class="mut">agents unavailable</span>');});}
function demoRender(d){if(d.error||!d.edges||!d.edges.length){set('demoBox','<span class="mut">'+(d.error||'no edge in scenario')+'</span>');return;}
  var e=d.edges[0];
  set('demoBox','<div class="mut" style="font-size:12px;margin-bottom:12px">'+d.note+'</div><div style="display:flex;gap:30px;flex-wrap:wrap;align-items:baseline"><div><div class="dim" style="font-size:11px;letter-spacing:1px">DETECTED</div><div class="pk" style="font-family:Chakra Petch;font-size:19px">'+e.type+' · '+(e.netEdge*100).toFixed(1)+'%</div></div><div><div class="dim" style="font-size:11px;letter-spacing:1px">EXECUTED</div><div style="font-family:Chakra Petch;font-size:19px">'+d.orders+' orders · '+d.fills+' fills</div></div><div><div class="dim" style="font-size:11px;letter-spacing:1px">LOCKED PROFIT</div><div class="grn" style="font-family:Chakra Petch;font-size:30px">$'+(Number(d.capturedUsd)||0).toFixed(2)+'</div></div></div><div class="mut" style="font-size:12px;margin-top:12px">'+e.rationale+'</div>');}
document.getElementById('demoRun').addEventListener('click',function(){set('demoBox','<span class="skel" style="width:35%"></span> <span class="mut" style="font-size:12px">running the pipeline…</span>');fetch('/api/demo').then(function(r){return r.json();}).then(demoRender).catch(function(){set('demoBox','<span class="mut">demo failed</span>');});});
loadAgents();
Lattice.mount('dlattice');
loadScan();loadXv();setInterval(function(){loadScan();loadXv();},30000);
${REVEAL_JS}
</script>
</body></html>`;
