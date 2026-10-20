import { director, keyart } from './dev-director';
// Dev only (not part of the EdVerse block): ?shot=<scene> drives the game to a scene so a headless browser
// can screenshot it for the README. Scenes: title, lesson, shop, play, hit, sniper, boss, mobile.
const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
const shot = params ? params.get('shot') : null;
const touch = !!params && (params.get('touch') === '1' || shot === 'mobile');

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function click(prefix: string) {
  const buttons = Array.prototype.slice.call(document.querySelectorAll('button')) as HTMLButtonElement[];
  const b = buttons.filter((x) => (x.textContent || '').trim().indexOf(prefix) === 0)[0];
  if (b) b.click();
  return !!b;
}

function step(e: any, seconds: number) {
  for (let i = 0; i < seconds * 20; i++) e.update(0.05);
}

function aimAt(e: any, target: any) {
  const p = target.getWorldPosition(e.pos.clone());
  const d = p.sub(e.pos);
  e.yaw = Math.atan2(-d.x, -d.z);
  e.pitch = Math.atan2(d.y, Math.sqrt(d.x * d.x + d.z * d.z));
  e.updateCamera(0.016);
  e.w.camera.updateMatrixWorld();
}

function visibleRobot(e: any, kind?: string) {
  const cam = e.pos.clone();
  const list = e.robots.filter((r: any) => r.isAlive() && r.state !== 'spawning' && (!kind || r.kind === kind)).filter((r: any) => {
    const p = r.panels[r.correctIndex].getWorldPosition(e.pos.clone());
    return e.w.clearLine(cam, p);
  });
  list.sort((a: any, b: any) => a.root.position.distanceTo(e.pos) - b.root.position.distanceTo(e.pos));
  return list[0];
}

/** Screenshot helper: stand `dist` metres in front of the nearest robot (on the way to the player). */
function approach(e: any, dist: number, kind?: string) {
  const list = e.robots.filter((r: any) => r.isAlive() && (!kind || r.kind === kind));
  list.sort((a: any, b: any) => a.root.position.distanceTo(e.pos) - b.root.position.distanceTo(e.pos));
  const r = list[0];
  if (!r) return null;
  const d = e.pos.clone().sub(r.root.position).setY(0).normalize();
  e.pos.set(r.root.position.x + d.x * dist, e.pos.y, r.root.position.z + d.z * dist);
  e.w.resolve(e.pos, 0.45);
  return r;
}

async function run() {
  while (!(window as any).__msbEngine) await wait(100);
  await wait(1500);
  if (shot === 'title') return finish();
  click('Play');
  await wait(300);
  click(shot === 'mobile' || shot === 'boss' ? '+ − × ÷' : '×');
  await wait(500);
  const e = (window as any).__msbEngine;
  if (shot === 'lesson') return finish();
  click('Got it');
  await wait(300);
  if (shot === 'shop') {
    e.cores = 120;
    e.buy('weapon', 'rifle');
    e.pushHud(true);
    await wait(400);
    return finish();
  }
  if (shot === 'sniper' || shot === 'boss') {
    e.cores = 500;
    e.buy('weapon', 'sniper');
  }
  if (shot === 'boss') {
    e.wave = 4;
  }
  click('Start wave');
  await wait(400);
  step(e, shot === 'sniper' ? 8 : shot === 'boss' ? 50 : 14);
  if (shot === 'play') {
    const r = approach(e, 7);
    if (r) aimAt(e, r.panels[0]);
  }
  if (shot === 'hit') {
    const r = approach(e, 6);
    if (r) {
      aimAt(e, r.panels[r.correctIndex]);
      e.fireCd = 0;
      e.fire(e.aimNdc.clone().set(0, 0));
      step(e, 0.25);
    }
  }
  if (shot === 'sniper') {
    const r = approach(e, 18);
    if (r) aimAt(e, r.panels[r.correctIndex]);
    e.zoomWanted = true;
    e.zoom = 1;
    e.updateCamera(0.016);
    e.pushHud(true);
  }
  if (shot === 'boss') {
    const r = approach(e, 11, 'titan');
    if (r) aimAt(e, r.panels[1]);
  }
  e.paused = true;
  await wait(600);
  finish();
}

function finish() {
  // headless virtual time freezes CSS animations: drop the wave banner so it doesn't ghost the shot
  const b = document.querySelector('.msb-banner') as HTMLElement | null;
  if (b) b.style.display = 'none';
  document.title = 'SHOT_READY';
}

export function setupShots() {
  if (!shot) return;
  if (shot === 'video') { director(); return; }
  if (shot === 'keyart') { keyart(); return; }
  if (touch) {
    const mm = window.matchMedia.bind(window);
    (window as any).matchMedia = (q: string) => (q === '(pointer: coarse)' ? ({ matches: true } as MediaQueryList) : mm(q));
  }
  run();
}
