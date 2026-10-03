// Belépési pont: vászon méretezése, fő ciklus, képernyők (menü / szünet / game over), HUD, ranglista.
import { W } from './config.js';
import { Game } from './game.js';
import { Sound } from './audio.js';
import { Input } from './input.js';
import { fetchScores, submitScore } from './api.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const canvas = $('#game');
const ctx = canvas.getContext('2d');
const app = $('#app');

const head = new Image();
head.src = 'assets/eduard-head.png';

const sound = new Sound();
const input = new Input(canvas, { onPause: () => togglePause() });

let bannerTimer = 0;
function banner(text) {
  const b = $('#banner');
  b.textContent = text;
  b.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => b.classList.remove('show'), 1800);
}

const game = new Game({ sound, input, head, onGameOver, onBanner: banner });
// Teszt/hibakereső hozzáférés (a smoke teszt használja). Nem tartalmaz titkot.
window.__ETT = { game, sound, input };


// ------------------------------------------------------------------ méretezés
let pixelScale = 1;
function resize() {
  const cssW = app.clientWidth;
  const cssH = app.clientHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  pixelScale = canvas.width / W;
  game.resize((cssH / cssW) * W, pixelScale);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
resize();

// ------------------------------------------------------------------ fő ciklus
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); // tab-váltás után ne ugorjon nagyot
  last = now;
  game.update(dt);
  ctx.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);
  game.draw(ctx);
  updateHud();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ------------------------------------------------------------------ HUD
const heartSvg = (full) =>
  `<svg viewBox="0 0 24 24" class="${full ? 'heart-full' : 'heart-empty'}"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.2 4.3 2.6h2c.7-1.4 2.2-2.6 4.3-2.6 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z"/></svg>`;
const hud = { score: -1, mult: '', lives: -1, level: -1, drunk: -1 };
function updateHud() {
  if (game.state === 'ready') return;
  const s = game.score;
  if (s !== hud.score) $('#hud-score').textContent = String((hud.score = s));
  const m = '×' + game.multiplier.toFixed(1);
  if (m !== hud.mult) $('#hud-mult').textContent = hud.mult = m;
  if (game.lives !== hud.lives) {
    const lost = hud.lives > game.lives;
    hud.lives = game.lives;
    $('#hud-lives').innerHTML = [0, 1, 2].map((i) => heartSvg(i < game.lives)).join('');
    if (lost) $('#hud-lives').children[game.lives]?.classList.add('lost');
  }
  if (game.level !== hud.level) $('#hud-level').textContent = `${(hud.level = game.level)}.`;
  const d = Math.round(game.drunk);
  if (d !== hud.drunk) {
    hud.drunk = d;
    const f = $('#hud-drunk');
    f.style.width = d + '%';
    f.classList.toggle('max', d >= 95);
  }
}

// ------------------------------------------------------------------ képernyők
function show(id) {
  for (const s of $$('.screen')) s.hidden = s.id !== id;
}
function startGame() {
  sound.ensure();
  game.start();
  Object.assign(hud, { score: -1, mult: '', lives: -1, level: -1, drunk: -1 });
  show(null);
  $('#hud').hidden = false;
  sound.startMusic();
  if (matchMedia('(pointer: coarse)').matches && !input.tiltEnabled) {
    const h = $('#touch-hint');
    h.hidden = false;
    h.style.animation = 'none';
    void h.offsetWidth; // animáció újraindítása
    h.style.animation = '';
  }
  canvas.focus?.();
}
function togglePause(force) {
  if (game.state !== 'play' && game.state !== 'crash') return;
  game.paused = force !== undefined ? force : !game.paused;
  show(game.paused ? 'screen-pause' : null);
  sound.duckMusic(game.paused);
}
function toMenu() {
  game.paused = false;
  game.state = 'ready';
  game.reset();
  sound.stopMusic();
  $('#hud').hidden = true;
  show('screen-start');
  refreshBest();
  loadBoard('#lb-start');
}

$('#btn-start').addEventListener('click', startGame);
$('#btn-again').addEventListener('click', startGame);
$('#btn-menu').addEventListener('click', toMenu);
$('#btn-resume').addEventListener('click', () => togglePause(false));
$('#btn-quit').addEventListener('click', toMenu);
$('#btn-pause').addEventListener('click', () => togglePause());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) togglePause(true);
});

// némítás (localStorage-ben megjegyezve)
function syncMute() {
  document.body.classList.toggle('muted', sound.muted);
  for (const b of $$('.js-mute-label')) {
    b.textContent = sound.muted ? 'Hang: KI' : 'Hang: BE';
    b.classList.toggle('on', !sound.muted);
  }
}
function toggleMute() {
  sound.ensure();
  sound.setMuted(!sound.muted);
  syncMute();
}
for (const b of $$('.js-mute')) b.addEventListener('click', toggleMute);
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'm' && document.activeElement?.tagName !== 'INPUT') toggleMute();
  if (e.key === 'Enter' && !$('#screen-start').hidden) startGame();
});
syncMute();

// döntés-vezérlés
function syncTilt() {
  for (const b of $$('.js-tilt')) {
    b.textContent = input.tiltEnabled ? 'Döntés: BE' : 'Döntés: KI';
    b.classList.toggle('on', input.tiltEnabled);
  }
}
for (const b of $$('.js-tilt'))
  b.addEventListener('click', async () => {
    try {
      await input.setTilt(!input.tiltEnabled);
      banner(input.tiltEnabled ? 'Döntsd a telefont balra-jobbra!' : 'Döntés kikapcsolva');
    } catch (err) {
      banner(err.message);
    }
    syncTilt();
  });
syncTilt();

// ------------------------------------------------------------------ ranglista
function renderBoard(sel, scores, highlight) {
  const ol = $(sel);
  ol.textContent = '';
  if (!scores.length) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'Még senki nem tekert. Légy te az első!';
    ol.append(li);
    return;
  }
  scores.forEach((s, i) => {
    const li = document.createElement('li');
    const n = document.createElement('span');
    n.className = 'n';
    n.textContent = s.name; // textContent: a név sosem értelmeződik HTML-ként
    const v = document.createElement('span');
    v.className = 's';
    v.textContent = s.score.toLocaleString('hu-HU');
    li.append(n, v);
    if (highlight && highlight.rank === i + 1 && highlight.name === s.name) li.classList.add('me');
    ol.append(li);
  });
}
async function loadBoard(sel) {
  try {
    const { scores } = await fetchScores();
    renderBoard(sel, scores);
  } catch (err) {
    $(sel).innerHTML = '';
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = err.message || 'A ranglista nem érhető el.';
    $(sel).append(li);
  }
}
function refreshBest() {
  const b = Number(localStorage.getItem('ett_best') || 0);
  $('#best').textContent = b ? `Saját rekordod: ${b.toLocaleString('hu-HU')} pont` : '';
}

let lastResult = null;
function onGameOver(r) {
  lastResult = r;
  const best = Number(localStorage.getItem('ett_best') || 0);
  const isBest = r.score > best;
  if (isBest) localStorage.setItem('ett_best', String(r.score));
  setTimeout(() => {
    $('#hud').hidden = true;
    $('#over-score').textContent = r.score.toLocaleString('hu-HU');
    const st = r.stats || {};
    $('#over-stats').textContent =
      `${r.level}. szint · ${r.durationSec} mp · ${st.beers || 0} sör, ${st.coffees || 0} kávé, ${st.pickles || 0} savanyúság` +
      (isBest ? ' · ÚJ SAJÁT REKORD!' : '');
    $('#name').value = localStorage.getItem('ett_name') || '';
    $('#btn-submit').disabled = false;
    $('#form-score').hidden = r.score <= 0;
    const msg = $('#submit-msg');
    msg.textContent = '';
    msg.className = 'msg';
    show('screen-over');
    loadBoard('#lb-over');
  }, 700);
}

$('#form-score').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!lastResult) return;
  const name = $('#name').value.trim();
  const msg = $('#submit-msg');
  if (!name) {
    msg.textContent = 'Add meg a neved!';
    msg.className = 'msg err';
    return;
  }
  $('#btn-submit').disabled = true;
  msg.textContent = 'Küldés…';
  msg.className = 'msg';
  try {
    const res = await submitScore({ name, score: lastResult.score, level: lastResult.level, durationSec: lastResult.durationSec });
    localStorage.setItem('ett_name', res.name);
    msg.textContent = `Elmentve! Helyezésed: ${res.rank}.`;
    msg.className = 'msg ok';
    $('#form-score').hidden = true;
    renderBoard('#lb-over', res.scores, res);
  } catch (err) {
    msg.textContent = err.message;
    msg.className = 'msg err';
    $('#btn-submit').disabled = false;
  }
});

refreshBest();
loadBoard('#lb-start');
