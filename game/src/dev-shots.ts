// Dev only (not part of the EdVerse block): ?shot=title|play|hit|mobile drives the game to a scene
// so a headless browser can screenshot it for the README.
const shot = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('shot') : null;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function click(prefix: string) {
  const buttons = Array.prototype.slice.call(document.querySelectorAll('button')) as HTMLButtonElement[];
  const b = buttons.filter((x) => (x.textContent || '').trim().indexOf(prefix) === 0)[0];
  if (b) b.click();
}

async function run() {
  while (!(window as any).__msbEngine) await wait(100);
  await wait(1500);
  if (shot === 'title') return finish();
  click('Play');
  await wait(300);
  click(shot === 'mobile' ? '+ − × ÷' : '×');
  await wait(500);
  const e = (window as any).__msbEngine;
  for (let i = 0; i < (shot === 'mobile' ? 760 : 720); i++) e.update(0.05);
  if (shot === 'hit') {
    const r = e.robots.filter((x: any) => x.isAlive())[0];
    if (r) {
      const p = r.panels[r.correctIndex].getWorldPosition(e.pos.clone());
      const d = p.sub(e.pos);
      e.yaw = Math.atan2(-d.x, -d.z);
      e.pitch = Math.atan2(d.y, Math.sqrt(d.x * d.x + d.z * d.z));
      e.updateCamera(0.016);
      e.w.camera.updateMatrixWorld();
      e.fireCd = 0;
      e.fire(e.aimNdc.clone().set(0, 0));
      for (let i = 0; i < 5; i++) e.update(0.05);
    }
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
  if (shot === 'mobile') {
    const mm = window.matchMedia.bind(window);
    (window as any).matchMedia = (q: string) => (q === '(pointer: coarse)' ? ({ matches: true } as MediaQueryList) : mm(q));
  }
  run();
}
