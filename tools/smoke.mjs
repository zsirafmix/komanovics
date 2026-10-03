// Headless smoke teszt (puppeteer-core + helyi Chrome/Chromium).
// - Elindítja a szervert memóriabeli tárolóval egy szabad porton (vagy BASE_URL-t használ),
// - telefon-méretű nézetben végigjátssza: kezdőképernyő -> játék -> ütközés -> game over -> név beküldése,
// - képernyőképeket ment a SCREENSHOT_DIR-be (alapértelmezés: ./screenshots),
// - hibával lép ki, ha konzolhiba / oldalhiba volt, vagy a ranglista beküldés nem sikerült.
// Futtatás: npm run smoke   (CHROME_PATH=/útvonal/chrome, ha nem /usr/bin/google-chrome)
//           BASE_URL=https://... SUBMIT=0 npm run smoke   (élő oldal ellenőrzése beküldés nélkül)
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const OUT = process.env.SCREENSHOT_DIR || 'screenshots';
const SUBMIT = process.env.SUBMIT !== '0';
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let server;
let base = process.env.BASE_URL;
if (!base) {
  const port = 3900 + Math.floor(Math.random() * 90);
  server = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, PORT: String(port), DATABASE_URL: '' }, stdio: 'inherit' });
  base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(base + '/healthz')).ok) break;
    } catch {}
    await sleep(100);
  }
}

const errors = [];
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
});
try {
  const page = await browser.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('console: ' + m.text());
  });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()));
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(base, { waitUntil: 'networkidle0' });
  await sleep(800);
  await page.screenshot({ path: path.join(OUT, '01-start.png') });

  await page.click('#btn-start');
  // ~9 mp játék: váltakozó kormányzás billentyűkkel
  for (let i = 0; i < 9; i++) {
    const key = i % 2 ? 'ArrowLeft' : 'ArrowRight';
    await page.keyboard.down(key);
    await sleep(350);
    await page.keyboard.up(key);
    await sleep(650);
  }
  // Ne crasheljen a teszt közben: sérthetetlenség, majd látványos jelenet beállítása
  await page.evaluate(() => {
    const g = window.__ETT.game;
    g.player.invulnT = 999;
    g.drunk = 70;
    g.level = 3;
    const y = g.player.y;
    g.entities.push(
      { type: 'goat', x: 150, y: y - 330, t: 0, vx: 0, vy: 0, state: 'idle', seed: 0.3 },
      { type: 'beer', x: 250, y: y - 250, t: 0, vx: 0, vy: 0, seed: 0.1 },
      { type: 'coffee', x: 130, y: y - 180, t: 0, vx: 0, vy: 0, seed: 0.1 },
      { type: 'pickle', x: 280, y: y - 120, t: 0, vx: 0, vy: 0, seed: 0.1 },
      { type: 'puddle', x: 230, y: y - 430, t: 0, vx: 0, vy: 0, seed: 0.5 },
      { type: 'pothole', x: 140, y: y - 460, t: 0, vx: 0, vy: 0, seed: 0.5 },
      { type: 'tractor', x: 252, y: y - 560, t: 0, vx: 0, vy: 20, seed: 0.5 },
      { type: 'chickens', x: 170, y: y - 640, t: 0, vx: 0, vy: 0, seed: 0.5, hens: [0, 1, 2, 3, 4].map((i) => ({ ox: i * 12 - 24, oy: (i % 2) * 14, vx: 0, vy: 0, ang: i, brown: i % 2 === 0, peck: i })) },
    );
    g.scroll = 30; // lassan, hogy a képen minden látszódjon
    g.paused = false;
  });
  await page.evaluate(() => {
    // 1 képkockányi léptetés után megállítjuk a görgetést a fotóhoz
    const g = window.__ETT.game;
    g._origBase = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(g), 'baseSpeed');
    Object.defineProperty(g, 'baseSpeed', { get: () => 25, configurable: true });
  });
  await sleep(600);
  // a villogó sérthetetlenség ne rejtse el a játékost a képen (a veszélyek messze vannak)
  await page.evaluate(() => (window.__ETT.game.player.invulnT = 0));
  await page.screenshot({ path: path.join(OUT, '02-gameplay.png') });
  // nagyított kivágás a játékosról (a sprite vizuális ellenőrzéséhez)
  const clip = await page.evaluate(() => {
    const g = window.__ETT.game;
    const r = document.querySelector('#game').getBoundingClientRect();
    const k = r.width / 400;
    return { x: r.left + (g.player.x - 70) * k, y: r.top + (g.player.y - 110) * k, width: 140 * k, height: 170 * k };
  });
  await page.screenshot({ path: path.join(OUT, '02b-player-zoom.png'), clip });
  const st = await page.evaluate(() => ({ state: window.__ETT.game.state, score: window.__ETT.game.score, ctx: window.__ETT.sound.ctx?.state }));
  console.log('[smoke] gameplay state', st);
  if (st.state !== 'play') errors.push('expected play state, got ' + st.state);

  // ütközés-animáció (kecske)
  await page.evaluate(() => {
    const g = window.__ETT.game;
    delete g.baseSpeed;
    g.player.invulnT = 0;
    g.startCrash('goat', null);
  });
  await sleep(1300);
  await page.screenshot({ path: path.join(OUT, '03-crash-goat.png') });
  await sleep(1200);
  // game over kikényszerítése: utolsó élet + traktor-ütközés
  await page.evaluate(() => {
    const g = window.__ETT.game;
    g.lives = 1;
    g.player.invulnT = 0;
    g.startCrash('tractor', null);
  });
  await sleep(700);
  await page.screenshot({ path: path.join(OUT, '04-crash-tractor.png') });
  await sleep(2600);
  const overVisible = await page.$eval('#screen-over', (el) => !el.hidden);
  if (!overVisible) errors.push('game over screen not visible');
  if (SUBMIT) {
    await page.type('#name', 'Smoke Teszt');
    await page.click('#btn-submit');
    await page.waitForFunction(() => /Helyezésed/.test(document.querySelector('#submit-msg').textContent), { timeout: 5000 }).catch(() => errors.push('score submit failed: ' + 'timeout'));
  }
  await sleep(300);
  await page.screenshot({ path: path.join(OUT, '05-gameover.png') });
  const msg = await page.$eval('#submit-msg', (el) => el.textContent);
  console.log('[smoke] submit message:', msg);

  // Gyorsított szimuláció: ~4 perc játékidő véletlen kormányzással, képkockánként update()+draw(),
  // hogy minden entitástípus, szint és ütközés-ág lefusson (futásidejű hibák keresése).
  const sim = await page.evaluate(() => {
    const { game: g, input } = window.__ETT;
    const ctx = document.querySelector('#game').getContext('2d');
    const origSteer = input.steer.bind(input);
    let v = 0;
    input.steer = () => (Math.random() < 0.03 ? (v = [-1, 0, 1][Math.floor(Math.random() * 3)]) : v);
    const seen = {};
    let games = 0;
    let maxLevel = 0;
    let crashes = 0;
    g.start();
    for (let i = 0; i < 60 * 300; i++) {
      // első 240 mp: sérthetetlen (hogy magas szintekig jusson), utána ütközhet is
      if (i < 60 * 240) g.player.invulnT = 1;
      g.update(1 / 60);
      if (i % 4 === 0) g.draw(ctx);
      for (const e of g.entities) seen[e.type] = (seen[e.type] || 0) + 1;
      if (g.state === 'crash' && g.crash && g.crash.t <= 1 / 60 + 1e-9) crashes++;
      maxLevel = Math.max(maxLevel, g.level);
      if (g.state === 'over') {
        games++;
        g.start();
      }
    }
    input.steer = origSteer;
    return { types: Object.keys(seen).sort(), games, maxLevel, crashes };
  });
  console.log('[smoke] simulation', JSON.stringify(sim));
  for (const t of ['beer', 'coffee', 'pickle', 'goat', 'goatRun', 'goatCharge', 'pothole', 'puddle', 'chickens', 'tractor'])
    if (!sim.types.includes(t)) errors.push('simulation never spawned ' + t);
  await page.evaluate(() => window.__ETT.game.reset());

  // asztali nézet
  await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1 });
  await page.$eval('#btn-again', (b) => b.click());
  await sleep(2500);
  await page.screenshot({ path: path.join(OUT, '06-desktop.png') });
} finally {
  await browser.close();
  server?.kill();
}
if (errors.length) {
  console.error('[smoke] FAILED:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('[smoke] OK – screenshots in', OUT);
