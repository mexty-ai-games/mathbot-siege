// Dev only (not part of the EdVerse block): a scripted, frame-stepped gameplay run for the store trailer.
// /?shot=video exposes window.__dir.frame(); each call advances the game by exactly 1/30 s so a headless
// browser can screenshot every frame. /?shot=keyart shows the title lineup without buttons for thumbnails.
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const FPS = 30;

function click(prefix: string) {
  const buttons = Array.prototype.slice.call(document.querySelectorAll('button')) as HTMLButtonElement[];
  const b = buttons.filter((x) => (x.textContent || '').trim().indexOf(prefix) === 0)[0];
  if (b) b.click();
  return !!b;
}

function hideBanner() {
  const b = document.querySelector('.msb-banner') as HTMLElement | null;
  if (b) b.style.display = 'none';
}

export async function keyart() {
  while (!(window as any).__msbEngine) await wait(100);
  await wait(1500);
  const st = document.createElement('style');
  st.textContent = '.msb-row{display:none!important}.msb-menu{justify-content:flex-start!important;padding-top:4vh!important}';
  document.head.appendChild(st);
  document.title = 'SHOT_READY';
}

export async function director() {
  while (!(window as any).__msbEngine) await wait(100);
  await wait(1500);
  let e = (window as any).__msbEngine;
  // take over the clock: the page no longer renders on its own
  cancelAnimationFrame(e.raf);
  (window as any).requestAnimationFrame = () => 0;
  let t = 0;
  let step = 0;
  const events: [number, () => void][] = [
    [2.6, () => click('Play')],
    [3.6, () => click('×')],
    [6.4, () => click('Got it')],
    [6.5, () => { e.cores = 34; e.pushHud(true); }],
    [8.4, () => {
      click('Start wave');
      e.pos.set(1, 1.65, 18);
    }],
  ];
  // Titan finale, once the second wave is under way
  const finale = () => {
      e.cores += 80;
      e.buy('weapon', 'sniper');
      // a Titan steps out 22 m ahead for the finale
      e.spawn('titan');
      const titan = e.robots[e.robots.length - 1];
      // clear the stage, then find a spot 16-24 m away with a clear line of sight
      for (let i = e.robots.length - 1; i >= 0; i--) {
        if (e.robots[i] !== titan) { e.robots[i].dispose(); e.robots.splice(i, 1); }
      }
      let placed = false;
      for (let tries = 0; tries < 80 && !placed; tries++) {
        const a = e.yaw + (tries % 2 ? 1 : -1) * Math.floor(tries / 2) * 0.12;
        const dist = 16 + (tries % 5) * 2;
        const p = new V(e.pos.x - Math.sin(a) * dist, 0, e.pos.z - Math.cos(a) * dist);
        const q = p.clone();
        e.w.resolve(q, titan.spec.radius + 0.4);
        if (q.distanceTo(p) < 0.01 && e.w.clearLine(e.pos, p)) {
          titan.root.position.copy(p);
          placed = true;
        }
      }
      titan.speedMul = 0.25;
      bot.focus = titan;
      zoomAt = t + 1.0;
  };
  let zoomAt = 0;
  let finaleDone = false;
  let interT = 0;
  let doneAt = 0;
  const bot = { target: null as any, panel: -1, wait: 0, shots: 0, focus: null as any };
  const V = e.pos.constructor;

  const chooseTarget = () => {
    if (bot.focus && bot.focus.isAlive()) return bot.focus;
    const cam = e.pos.clone();
    const list = e.robots.filter((r: any) => r.isAlive() && r.state !== 'spawning' && r.root.position.distanceTo(e.pos) < 34)
      .filter((r: any) => e.w.clearLine(cam, r.panels[r.correctIndex].getWorldPosition(new V())));
    list.sort((a: any, b: any) => a.root.position.distanceTo(e.pos) - b.root.position.distanceTo(e.pos));
    return list[0] || null;
  };

  const drive = (dt: number) => {
    // click through the lesson and the armory between waves (buy the rifle on the way)
    if (e.phase === 'intermission' && t > 9) {
      interT += dt;
      if (interT > 2.2 && interT - dt <= 2.2) click('Got it');
      if (interT > 3.2 && interT - dt <= 3.2) { e.cores = Math.max(e.cores, 30); e.buy('weapon', 'rifle'); }
      if (interT > 4.4 && interT - dt <= 4.4) { click('Wave'); interT = 0; }
      return;
    }
    if (e.phase !== 'play') return;
    // trailer pacing: freshly spawned robots appear in view, 13-20 m ahead
    for (let i = 0; i < e.robots.length; i++) {
      const r = e.robots[i];
      if (r.state !== 'spawning' || r.__placed || r === bot.focus) continue;
      r.__placed = true;
      const a = e.yaw + (Math.random() - 0.5) * 0.9;
      const dist = 13 + Math.random() * 7;
      r.root.position.set(e.pos.x - Math.sin(a) * dist, r.root.position.y, e.pos.z - Math.cos(a) * dist);
      e.w.resolve(r.root.position, r.spec.radius + 0.3);
    }
    if (e.spawnT > 0.6) e.spawnT = 0.6;
    if (!finaleDone && e.wave >= 2 && t > 37) { finaleDone = true; finale(); }
    if (bot.focus && !bot.focus.isAlive() && !doneAt) { doneAt = t; e.zoomWanted = false; }
    if (zoomAt && t > zoomAt) { e.zoomWanted = true; zoomAt = 0; }
    e.shield = Math.max(e.shield, 5);
    if (bot.wait > 0) { bot.wait -= dt; return; }
    if (!bot.target || !bot.target.isAlive() || !bot.target.problem) {
      bot.target = chooseTarget();
      if (!bot.target) {
        // turn slowly toward the hall while waiting for robots
        e.yaw += (0 - e.yaw) * Math.min(1, dt * 1.5);
        return;
      }
      // the second shot of the run is a deliberate miss, to show the kind feedback
      bot.panel = bot.shots === 1 ? (bot.target.correctIndex + 1) % bot.target.panels.length : bot.target.correctIndex;
    }
    const r = bot.target;
    if (bot.panel !== r.correctIndex && bot.shots !== 1) bot.panel = r.correctIndex;
    const p = r.panels[bot.panel].getWorldPosition(new V());
    const d = p.sub(e.pos);
    const ty = Math.atan2(-d.x, -d.z);
    const tp = Math.atan2(d.y, Math.sqrt(d.x * d.x + d.z * d.z));
    let dy = ty - e.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    const k = Math.min(1, dt * 7);
    e.yaw += dy * k;
    e.pitch += (tp - e.pitch) * k;
    const settled = Math.abs(dy) < 0.02 && Math.abs(tp - e.pitch) < 0.02;
    if (settled) { e.yaw = ty; e.pitch = tp; }
    if (settled && e.fireCd <= 0 && e.reloadT <= 0 && !e.rig.switching() && (!bot.focus || e.zoom > 0.9 || bot.target !== bot.focus)) {
      e.updateCamera(0);
      e.w.camera.updateMatrixWorld();
      e.fire(e.aimNdc.clone().set(0, 0));
      bot.shots++;
      bot.wait = bot.shots === 2 ? 0.9 : 0.35;
      bot.target = r.isAlive() ? r : null;
    }
  };

  (window as any).__dir = {
    frame: () => {
      e = (window as any).__msbEngine;
      const dt = 1 / FPS;
      t += dt;
      step++;
      while (events.length && events[0][0] <= t) (events.shift() as [number, () => void])[1]();
      drive(dt);
      e.last = 0;
      e.loop(1000 / FPS);
      if (t > 8.4 && t < 9.5) hideBanner();
      return doneAt && t > doneAt + 2.5 ? -1 : t;
    },
    time: () => t,
  };
  document.title = 'DIRECTOR_READY';
}
