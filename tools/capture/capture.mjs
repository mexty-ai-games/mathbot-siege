// node capture.mjs <mode> <outDir> [w h]
//   video  → frames/00001.jpg… of the scripted run (1280×720, 30 fps)
//   shot:<scene> → a single PNG (uses /?shot=<scene>), phone:<scene> → 390×844 touch layout
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
const [mode, out, W = '1280', H = '720'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: process.env.GPU ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--mute-audio', '--hide-scrollbars'] : ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--mute-audio', '--hide-scrollbars'],
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('PAGEERR', e.message));
const phone = mode.startsWith('phone:');
await page.setViewport({ width: phone ? 390 : +W, height: phone ? 844 : +H, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone });
if (mode === 'video') {
  await page.goto('http://localhost:5199/?shot=video', { waitUntil: 'load' });
  await page.waitForFunction(() => document.title === 'DIRECTOR_READY', { timeout: 120000 });
  const frames = +(process.env.FRAMES || 1260);
  for (let i = 1; i <= frames; i++) {
    const tt = await page.evaluate(() => window.__dir.frame());
    if (tt < 0) { console.log('finished at frame', i); break; }
    await page.screenshot({ path: path.join(out, String(i).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 92 });
    if (i % 150 === 0) console.log('frame', i);
  }
} else {
  const scene = mode.split(':')[1];
  await page.goto('http://localhost:5199/?shot=' + scene + (phone ? '&touch=1' : ''), { waitUntil: 'load' });
  await page.waitForFunction(() => document.title === 'SHOT_READY', { timeout: 180000 });
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: path.join(out, (phone ? 'phone_' : '') + scene + '_' + (phone ? '390x844' : W + 'x' + H) + '.png') });
}
await browser.close();
console.log('done');
