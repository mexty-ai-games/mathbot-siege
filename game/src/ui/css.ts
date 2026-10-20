// Game stylesheet (scoped under .msb). Injected once by the Block.
export const CSS = `
.msb{position:relative;width:100%;height:100%;min-height:320px;overflow:hidden;background:#02050a;color:#eaf6ff;
  font-family:"Segoe UI","Roboto","Helvetica Neue",system-ui,sans-serif;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent}
.msb *{box-sizing:border-box}
.msb-canvas{position:absolute;inset:0}
.msb-layer{position:absolute;inset:0;pointer-events:none}
.msb button{font-family:inherit;cursor:pointer;pointer-events:auto}
.msb button:focus-visible{outline:3px solid #ffe04a;outline-offset:3px}
.msb-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

/* ---------- logo ---------- */
.msb-logo{text-align:center;line-height:.86;font-weight:900;font-style:italic;text-transform:uppercase;letter-spacing:-.02em}
.msb-logo .l1,.msb-logo .l2{display:block;color:#fff;-webkit-text-stroke:2px #1d6dff;
  text-shadow:0 0 2px #fff,0 0 10px #3a8bff,0 0 26px #1d6dff,4px 4px 0 #0b1d4a,0 0 60px rgba(255,40,60,.55)}
.msb-logo .l1{font-size:clamp(40px,10vw,110px)}
.msb-logo .l2{font-size:clamp(46px,12vw,132px);margin-top:.02em}
.msb-tag{display:inline-block;margin-top:14px;padding:6px 18px;border:2px solid #ff3448;border-radius:6px;background:rgba(5,8,16,.85);
  font-weight:800;letter-spacing:.25em;font-size:clamp(11px,2vw,15px);box-shadow:0 0 18px rgba(255,52,72,.6),inset 0 0 12px rgba(255,52,72,.25)}

/* ---------- menu panels ---------- */
.msb-menu{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:16px;
  background:radial-gradient(ellipse at 50% 40%,rgba(2,6,14,.15) 0%,rgba(2,6,14,.75) 70%,rgba(2,6,14,.92) 100%);pointer-events:auto;overflow:auto}
.msb-menu.dim{background:rgba(2,6,14,.84)}
.msb-btn{position:relative;min-width:220px;padding:14px 34px;border:0;color:#04121c;font-weight:900;font-style:italic;font-size:clamp(16px,2.6vw,22px);
  text-transform:uppercase;letter-spacing:.06em;background:linear-gradient(180deg,#8ff6ff,#22c6ff);clip-path:polygon(12px 0,100% 0,calc(100% - 12px) 100%,0 100%);
  box-shadow:0 0 22px rgba(40,200,255,.7);transition:transform .12s,filter .12s}
.msb-btn:hover{transform:translateY(-2px) scale(1.03);filter:brightness(1.15)}
.msb-btn.ghost{background:rgba(10,30,50,.85);color:#bfefff;box-shadow:inset 0 0 0 2px #2fb8ff}
.msb-btn.red{background:linear-gradient(180deg,#ff8a7a,#ff3448);color:#1a0306}
.msb-row{display:flex;flex-wrap:wrap;gap:14px;justify-content:center}
.msb-card{width:min(92vw,560px);padding:22px 24px;background:linear-gradient(180deg,rgba(8,22,38,.94),rgba(4,10,20,.94));
  border:1px solid rgba(80,200,255,.45);clip-path:polygon(18px 0,100% 0,100% calc(100% - 18px),calc(100% - 18px) 100%,0 100%,0 18px);
  box-shadow:0 0 40px rgba(30,160,255,.25)}
.msb-h{margin:0 0 12px;font-size:clamp(20px,3.4vw,30px);font-weight:900;font-style:italic;text-transform:uppercase;letter-spacing:.04em;color:#8ff0ff;
  text-shadow:0 0 14px rgba(60,200,255,.7)}
.msb-p{margin:6px 0;font-size:clamp(14px,2.2vw,17px);line-height:1.45;color:#d6ecff}
.msb-steps{margin:0;padding:0;list-style:none;counter-reset:s}
.msb-steps li{counter-increment:s;position:relative;padding:8px 0 8px 44px;font-size:clamp(14px,2.2vw,17px);line-height:1.4}
.msb-steps li:before{content:counter(s);position:absolute;left:0;top:6px;width:30px;height:30px;display:flex;align-items:center;justify-content:center;
  font-weight:900;color:#04121c;background:#ff5a3c;clip-path:polygon(6px 0,100% 0,calc(100% - 6px) 100%,0 100%);box-shadow:0 0 12px #ff3a20}
.msb-modes{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;width:min(94vw,760px)}
.msb-mode{padding:16px 14px;text-align:left;border:0;color:#eaf6ff;background:linear-gradient(160deg,rgba(14,34,56,.95),rgba(5,12,24,.95));
  border-left:5px solid var(--c);clip-path:polygon(0 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%);transition:transform .12s,box-shadow .12s;
  box-shadow:inset 0 0 0 1px rgba(120,200,255,.18)}
.msb-mode:hover,.msb-mode:focus-visible{transform:translateY(-3px);box-shadow:inset 0 0 0 1px var(--c),0 0 24px -4px var(--c)}
.msb-mode .sym{font-size:30px;font-weight:900;color:var(--c);text-shadow:0 0 12px var(--c)}
.msb-mode .nm{display:block;margin-top:4px;font-size:18px;font-weight:900;font-style:italic;text-transform:uppercase}
.msb-mode .ds{display:block;margin-top:4px;font-size:13px;opacity:.8;line-height:1.3}
.msb-mode .bs{display:block;margin-top:8px;font-size:12px;color:#ffd84a;font-weight:700}
.msb-bar{width:min(70vw,420px);height:10px;background:rgba(40,120,180,.25);clip-path:polygon(6px 0,100% 0,calc(100% - 6px) 100%,0 100%)}
.msb-bar>i{display:block;height:100%;background:linear-gradient(90deg,#20d8ff,#9ff6ff);box-shadow:0 0 12px #20d8ff;transition:width .2s}
.msb-note{font-size:12px;opacity:.7;text-align:center;max-width:520px}

/* ---------- HUD ---------- */
.msb-hud{position:absolute;inset:0;pointer-events:none;font-style:italic;text-transform:uppercase}
.msb-tl{position:absolute;left:max(10px,env(safe-area-inset-left));top:10px;display:flex;gap:10px;align-items:flex-start}
.msb-badge{width:46px;height:46px;background:linear-gradient(160deg,#173b66,#081525);border:2px solid #2fb8ff;display:flex;align-items:center;justify-content:center;
  clip-path:polygon(0 0,100% 0,100% 75%,75% 100%,0 100%);font-size:24px;font-style:normal}
.msb-bars{display:flex;flex-direction:column;gap:5px;padding:6px 12px 7px 8px;background:rgba(4,14,26,.7);clip-path:polygon(0 0,100% 0,calc(100% - 12px) 100%,0 100%)}
.msb-cells{display:flex;gap:3px}
.msb-cells i{width:clamp(10px,2.2vw,18px);height:11px;background:rgba(80,200,255,.15);transform:skewX(-20deg)}
.msb-cells i.on{background:linear-gradient(180deg,#9ff6ff,#20c8ff);box-shadow:0 0 8px #20c8ff}
.msb-cells.low i.on{background:linear-gradient(180deg,#ffb3a8,#ff3a2a);box-shadow:0 0 8px #ff3a2a;animation:msbblink .6s infinite}
.msb-combo{display:flex;gap:3px;align-items:center;font-size:11px;font-weight:800;color:#ffd84a;letter-spacing:.1em}
.msb-combo i{width:clamp(10px,2.2vw,18px);height:6px;background:rgba(255,216,74,.15);transform:skewX(-20deg)}
.msb-combo i.on{background:#ffd84a;box-shadow:0 0 6px #ffc81a}
.msb-tc{position:absolute;left:50%;top:0;transform:translateX(-50%);text-align:center}
.msb-wave{padding:6px 34px 7px;background:linear-gradient(180deg,rgba(20,50,80,.9),rgba(6,16,30,.85));border-bottom:2px solid #2fb8ff;
  clip-path:polygon(0 0,100% 0,calc(100% - 18px) 100%,18px 100%);font-weight:900;font-size:clamp(15px,2.6vw,22px);letter-spacing:.08em}
.msb-left{margin-top:4px;font-weight:800;font-size:14px;font-style:normal;text-shadow:0 0 6px #000}
.msb-tr{position:absolute;right:max(10px,env(safe-area-inset-right));top:10px;display:flex;gap:8px;align-items:center}
.msb-score{padding:6px 16px 6px 22px;background:rgba(4,14,26,.75);border-right:2px solid #ffd84a;clip-path:polygon(12px 0,100% 0,100% 100%,0 100%);
  font-weight:900;font-size:clamp(16px,2.8vw,24px);font-style:normal;font-variant-numeric:tabular-nums}
.msb-score b{color:#ffd84a;text-shadow:0 0 8px #ffb81a;margin-left:6px}
.msb-ico{width:40px;height:40px;border:0;background:rgba(6,20,36,.8);color:#bfefff;font-size:18px;font-style:normal;
  clip-path:polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px);box-shadow:inset 0 0 0 1px rgba(80,200,255,.5)}
.msb-br{position:absolute;right:max(10px,env(safe-area-inset-right));bottom:max(10px,env(safe-area-inset-bottom));display:flex;align-items:flex-end;gap:10px}
.msb-ammo{padding:6px 14px 6px 20px;background:rgba(4,14,26,.75);clip-path:polygon(12px 0,100% 0,100% 100%,0 100%);text-align:right}
.msb-ammo .wn{font-size:11px;font-weight:800;letter-spacing:.15em;color:#8ff0ff}
.msb-ammo .am{font-size:clamp(20px,3.4vw,30px);font-weight:900;font-style:normal;font-variant-numeric:tabular-nums}
.msb-ammo .am small{font-size:.5em;opacity:.7;margin-left:4px}
.msb-ammo .rl{color:#ffd84a;font-size:13px;font-weight:900;animation:msbblink .4s infinite}
.msb-radar{width:clamp(84px,14vw,124px);height:clamp(84px,14vw,124px);border-radius:50%;box-shadow:0 0 0 2px #2fb8ff,0 0 18px rgba(40,200,255,.6)}
.msb-cross{position:absolute;left:50%;top:50%;width:34px;height:34px;transform:translate(-50%,-50%);transition:width .08s,height .08s}
.msb-cross b{position:absolute;background:#fff;box-shadow:0 0 6px #20d8ff}
.msb-cross b.t,.msb-cross b.d{left:50%;width:2px;height:30%;margin-left:-1px}
.msb-cross b.t{top:0}.msb-cross b.d{bottom:0}
.msb-cross b.l,.msb-cross b.r{top:50%;height:2px;width:30%;margin-top:-1px}
.msb-cross b.l{left:0}.msb-cross b.r{right:0}
.msb-cross i{position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px;border-radius:50%;background:#fff}
.msb-cross.on b,.msb-cross.on i{background:#ff5a3c;box-shadow:0 0 8px #ff2a10}
.msb-cross.on{width:44px;height:44px}
.msb-cross.kick{width:48px;height:48px}
.msb-cross.hit i{width:16px;height:16px;margin:-8px;border-radius:0;background:transparent;border:3px solid #7dffb2;transform:rotate(45deg);box-shadow:0 0 10px #20ff90}
.msb-dmg{position:absolute;inset:0;opacity:0;background:radial-gradient(ellipse at center,rgba(255,0,0,0) 45%,rgba(255,30,20,.55) 100%)}
.msb-arrow{position:absolute;width:0;height:0;border-left:18px solid currentColor;border-top:11px solid transparent;border-bottom:11px solid transparent;
  filter:drop-shadow(0 0 6px currentColor)}
.msb-toast{position:absolute;left:50%;top:22%;transform:translateX(-50%);padding:8px 22px;font-weight:900;font-size:clamp(16px,3vw,26px);font-style:italic;
  text-transform:none;white-space:nowrap;max-width:94vw;overflow:hidden;text-overflow:ellipsis;background:rgba(4,12,24,.78);clip-path:polygon(10px 0,100% 0,calc(100% - 10px) 100%,0 100%);
  animation:msbpop .25s ease-out}
.msb-toast.good{color:#7dffb2;text-shadow:0 0 12px #20ff90}
.msb-toast.bad{color:#ffb3a8;text-shadow:0 0 12px #ff3a2a}
.msb-toast.info{color:#bfefff}
.msb-banner{position:absolute;left:0;right:0;top:36%;text-align:center;pointer-events:none;animation:msbsweep 2.6s ease-out forwards}
.msb-banner b{display:inline-block;padding:10px 60px;font-size:clamp(28px,6vw,60px);font-weight:900;font-style:italic;text-transform:uppercase;letter-spacing:.06em;
  background:linear-gradient(90deg,transparent,rgba(255,52,72,.85) 15%,rgba(255,52,72,.85) 85%,transparent);text-shadow:0 0 18px #fff}
.msb-banner.clear b{background:linear-gradient(90deg,transparent,rgba(32,200,140,.85) 15%,rgba(32,200,140,.85) 85%,transparent)}
.msb-banner small{display:block;margin-top:6px;font-size:clamp(13px,2vw,18px);font-weight:800;letter-spacing:.3em}
.msb-lock{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none}
.msb-lock span{padding:12px 26px;background:rgba(4,12,24,.8);border:2px solid #2fb8ff;font-weight:900;font-style:italic;text-transform:uppercase;
  letter-spacing:.08em;animation:msbpulse 1.2s infinite}

/* ---------- touch ---------- */
.msb-stick{position:absolute;left:max(18px,env(safe-area-inset-left));bottom:max(18px,env(safe-area-inset-bottom));width:132px;height:132px;border-radius:50%;
  background:rgba(20,80,120,.25);box-shadow:inset 0 0 0 2px rgba(80,200,255,.5);pointer-events:auto;touch-action:none}
.msb-stick i{position:absolute;left:50%;top:50%;width:56px;height:56px;margin:-28px;border-radius:50%;background:rgba(140,230,255,.55);box-shadow:0 0 14px #20d8ff}
.msb-look{position:absolute;right:0;top:56px;bottom:0;width:62%;pointer-events:auto;touch-action:none}
.msb-fire{position:absolute;right:max(18px,env(safe-area-inset-right));bottom:calc(max(18px,env(safe-area-inset-bottom)) + 140px);width:84px;height:84px;border-radius:50%;
  border:0;background:radial-gradient(circle,#ff7a5c,#ff2a10);color:#fff;font-weight:900;font-size:14px;box-shadow:0 0 22px #ff2a10;pointer-events:auto;touch-action:none}
.msb-fire:active{transform:scale(.94)}
.msb-touchhud .msb-br{bottom:max(10px,env(safe-area-inset-bottom))}

/* ---------- results ---------- */
.msb-stats{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:14px 0}
.msb-stat{padding:10px 12px;background:rgba(20,60,100,.35);clip-path:polygon(8px 0,100% 0,calc(100% - 8px) 100%,0 100%)}
.msb-stat small{display:block;font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.75}
.msb-stat b{font-size:26px;font-style:italic;font-variant-numeric:tabular-nums}
.msb-new{color:#ffd84a;font-weight:900;text-shadow:0 0 12px #ffb81a;animation:msbpulse 1s infinite}

/* ---------- v2: cores, weapon bar, scope, boss, shop, lessons ---------- */
.msb-cores{padding:6px 14px 6px 18px;background:rgba(4,14,26,.75);border-right:2px solid #5fe8ff;clip-path:polygon(10px 0,100% 0,100% 100%,0 100%);
  font-weight:900;font-size:clamp(14px,2.4vw,20px);font-style:normal;font-variant-numeric:tabular-nums}
.msb-cores b{color:#5fe8ff;text-shadow:0 0 8px #20c8ff;margin-left:5px}
.msb-wbar{position:absolute;left:50%;bottom:max(10px,env(safe-area-inset-bottom));transform:translateX(-50%);display:flex;gap:6px}
.msb-wslot{position:relative;width:52px;height:40px;border:0;background:rgba(4,14,26,.72);color:#bfefff;font-size:17px;font-weight:900;font-style:normal;
  clip-path:polygon(8px 0,100% 0,calc(100% - 8px) 100%,0 100%);box-shadow:inset 0 -3px 0 rgba(120,200,255,.25)}
.msb-wslot small{position:absolute;left:12px;top:3px;font-size:10px;opacity:.6}
.msb-wslot.on{background:linear-gradient(180deg,rgba(30,70,110,.95),rgba(8,20,36,.9));color:var(--c);box-shadow:inset 0 -3px 0 var(--c),0 0 14px -2px var(--c)}
.msb-ammo{border-bottom:2px solid var(--c)}
.msb-scope{position:absolute;inset:0;opacity:0;transition:opacity .12s;pointer-events:none;
  background:radial-gradient(circle at center,transparent 0,transparent min(34vw,34vh),rgba(0,0,0,.94) calc(min(34vw,34vh) + 2px))}
.msb-scope.on{opacity:1}
.msb-scope i,.msb-scope b{position:absolute;left:50%;top:50%;background:rgba(120,255,160,.75);box-shadow:0 0 6px #20ff90}
.msb-scope i{width:min(68vw,68vh);height:1px;transform:translate(-50%,-50%)}
.msb-scope b{height:min(68vw,68vh);width:1px;transform:translate(-50%,-50%)}
.msb-cross.scoped{opacity:.85}
.msb-cross.w-shotgun{width:62px;height:62px}
.msb-cross.w-shotgun b{opacity:.8}
.msb-banner.boss b{background:linear-gradient(90deg,transparent,rgba(255,176,32,.9) 15%,rgba(255,176,32,.9) 85%,transparent);color:#1a0d00;text-shadow:none}
.msb-zoombtn{position:absolute;right:max(26px,env(safe-area-inset-right));bottom:calc(max(18px,env(safe-area-inset-bottom)) + 236px);width:62px;height:62px;border-radius:50%;
  border:0;background:rgba(10,40,24,.8);color:#7dffb2;font-size:28px;box-shadow:inset 0 0 0 2px #3adf80;pointer-events:auto;touch-action:none}
.msb-zoombtn.on{background:#3adf80;color:#032010}
.msb-touchhud .msb-wbar{bottom:auto;top:62px;left:auto;right:max(10px,env(safe-area-inset-right));transform:none;flex-direction:column}
.msb-kicker{font-weight:900;font-style:italic;letter-spacing:.2em;text-transform:uppercase;color:#7dffb2;font-size:clamp(12px,2vw,16px)}
.msb-inter{justify-content:flex-start;padding-top:max(16px,4vh)}
.msb-shophead{display:flex;gap:16px;align-items:center;justify-content:space-between;width:min(94vw,860px)}
.msb-wallet{font-weight:900;font-size:clamp(20px,3.6vw,30px);font-variant-numeric:tabular-nums}
.msb-wallet b{color:#5fe8ff;text-shadow:0 0 10px #20c8ff}
.msb-shop{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px;width:min(94vw,860px)}
.msb-item{display:flex;flex-direction:column;gap:6px;padding:12px;background:linear-gradient(160deg,rgba(14,34,56,.95),rgba(5,12,24,.95));
  border-left:4px solid var(--c,#5fe8ff);clip-path:polygon(0 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%)}
.msb-item .nm{font-weight:900;font-style:italic;text-transform:uppercase;font-size:15px}
.msb-item .ds{font-size:13px;opacity:.8;line-height:1.3;flex:1}
.msb-item .pips{display:flex;gap:4px}
.msb-item .pips i{width:18px;height:6px;background:rgba(95,232,255,.18);transform:skewX(-20deg)}
.msb-item .pips i.on{background:#5fe8ff;box-shadow:0 0 6px #20c8ff}
.msb-buy{padding:8px 10px;border:0;font-weight:900;font-style:italic;text-transform:uppercase;color:#04121c;background:linear-gradient(180deg,#8ff6ff,#22c6ff);
  clip-path:polygon(8px 0,100% 0,calc(100% - 8px) 100%,0 100%)}
.msb-buy.ghost{background:rgba(10,30,50,.85);color:#bfefff;box-shadow:inset 0 0 0 2px var(--c,#2fb8ff)}
.msb-buy:disabled{filter:grayscale(.8) brightness(.6);cursor:default}
.msb-lesson{max-width:620px}
.msb-lvizbox{margin:10px 0;padding:12px;background:rgba(2,8,16,.7);border:1px solid rgba(80,200,255,.25);text-align:center}
.msb-lviz{width:100%;max-height:200px}
.msb-leq{margin-top:6px;font-size:clamp(22px,4vw,32px);font-weight:900;color:#ff6a4c;text-shadow:0 0 12px rgba(255,60,30,.7);font-variant-numeric:tabular-nums}
@media (max-width:600px){.msb-cores{padding:5px 8px 5px 12px}.msb-wslot{width:44px;height:36px}}

@keyframes msbblink{50%{opacity:.35}}
@keyframes msbpop{from{transform:translateX(-50%) scale(.6);opacity:0}to{transform:translateX(-50%) scale(1);opacity:1}}
@keyframes msbpulse{50%{opacity:.6}}
@keyframes msbsweep{0%{transform:translateX(-30%) skewX(-12deg);opacity:0}12%{transform:translateX(0) skewX(-12deg);opacity:1}80%{opacity:1}100%{transform:translateX(8%) skewX(-12deg);opacity:0}}
@media (max-width:600px){.msb-tc{top:58px}.msb-badge{display:none}.msb-wave{padding:4px 22px 5px}.msb-score{padding:5px 10px 5px 16px}}
@media (prefers-reduced-motion:reduce){.msb *{animation-duration:.01ms!important;transition:none!important}}
@media (max-height:480px){.msb-logo .l1{font-size:clamp(30px,8vh,80px)}.msb-logo .l2{font-size:clamp(34px,10vh,96px)}.msb-menu{gap:10px}.msb-card{padding:14px 18px}}
`;
