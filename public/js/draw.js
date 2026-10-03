// Procedurális (canvas) grafika: háttér-csempe, díszletek, akadályok, tárgyak, Eduárd a biciklin.
// Minden függvény logikai koordinátákban rajzol; a hívó (Game.draw) állítja be a skálázást.
import { W, TILE_H, FENCE_L, FENCE_R, DITCH_L, DITCH_R, SHOULDER_L, SHOULDER_R, ROAD_L, ROAD_R, ROAD_C } from './config.js';
import { TAU } from './util.js';

// Determinisztikus PRNG, hogy a háttér-csempe minden újrarajzolásnál ugyanolyan legyen.
function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
}
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
}

/**
 * A görgetett háttér egy TILE_H magas, függőlegesen varrat nélkül ismétlődő csempéje.
 * Varratmentesség: minden periodikus elem a TILE_H-val osztható periódusú, a véletlen pöttyök
 * pedig y-TILE_H és y+TILE_H eltolással is kirajzolódnak.
 */
export function buildBackgroundTile(scale) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(W * scale);
  c.height = Math.ceil(TILE_H * scale);
  const g = c.getContext('2d');
  g.scale(scale, scale);
  const rnd = mulberry32(1234);
  const wrap = (fn) => {
    fn(0);
    fn(-TILE_H);
    fn(TILE_H);
  };

  // mező (szántóföld-szerű sávok mindkét oldalon)
  g.fillStyle = '#69a843';
  g.fillRect(0, 0, W, TILE_H);
  for (let x = 0; x < FENCE_L; x += 8) {
    g.fillStyle = (x / 8) % 2 ? '#629f3d' : '#71b14a';
    g.fillRect(x, 0, 8, TILE_H);
    g.fillRect(W - x - 8, 0, 8, TILE_H);
  }
  // árok
  const ditch = g.createLinearGradient(FENCE_L, 0, SHOULDER_L, 0);
  ditch.addColorStop(0, '#4f8a36');
  ditch.addColorStop(0.5, '#3f7a3a');
  ditch.addColorStop(1, '#5c9a3f');
  g.fillStyle = ditch;
  g.fillRect(FENCE_L, 0, SHOULDER_L - FENCE_L, TILE_H);
  const ditchR = g.createLinearGradient(SHOULDER_R, 0, FENCE_R, 0);
  ditchR.addColorStop(0, '#5c9a3f');
  ditchR.addColorStop(0.5, '#3f7a3a');
  ditchR.addColorStop(1, '#4f8a36');
  g.fillStyle = ditchR;
  g.fillRect(SHOULDER_R, 0, FENCE_R - SHOULDER_R, TILE_H);
  // padka (világosabb fű)
  g.fillStyle = '#7dbb52';
  g.fillRect(SHOULDER_L, 0, ROAD_L - SHOULDER_L, TILE_H);
  g.fillRect(ROAD_R, 0, SHOULDER_R - ROAD_R, TILE_H);

  // földút szabálytalan széllel (periódus: TILE_H/k)
  const edge = (y, side) => {
    const a = Math.sin((y / TILE_H) * TAU * 3 + side) * 4 + Math.sin((y / TILE_H) * TAU * 7 + side * 2) * 2.5;
    return a;
  };
  g.fillStyle = '#c9a36b';
  g.beginPath();
  g.moveTo(ROAD_L + edge(0, 0), 0);
  for (let y = 0; y <= TILE_H; y += 8) g.lineTo(ROAD_L + edge(y, 0), y);
  for (let y = TILE_H; y >= 0; y -= 8) g.lineTo(ROAD_R + edge(y, 1.3), y);
  g.closePath();
  g.fill();
  // keréknyomok (két sötétebb vályú) + középső füves sáv
  for (const cx of [ROAD_C - 52, ROAD_C + 52]) {
    const rut = g.createLinearGradient(cx - 18, 0, cx + 18, 0);
    rut.addColorStop(0, 'rgba(120,85,45,0)');
    rut.addColorStop(0.5, 'rgba(120,85,45,0.35)');
    rut.addColorStop(1, 'rgba(120,85,45,0)');
    g.fillStyle = rut;
    g.fillRect(cx - 18, 0, 36, TILE_H);
  }
  // pöttyök: kavics, rög
  for (let i = 0; i < 520; i++) {
    const x = ROAD_L + 4 + rnd() * (ROAD_R - ROAD_L - 8);
    const y = rnd() * TILE_H;
    const r = 0.6 + rnd() * 1.8;
    const col = rnd() < 0.5 ? 'rgba(90,60,30,0.35)' : 'rgba(240,215,170,0.45)';
    wrap((o) => {
      g.fillStyle = col;
      ellipse(g, x, y + o, r, r * 0.8);
      g.fill();
    });
  }
  // gumiabroncs-mintázat a keréknyomokban
  g.strokeStyle = 'rgba(95,65,35,0.28)';
  g.lineWidth = 1.2;
  for (const cx of [ROAD_C - 52, ROAD_C + 52]) {
    for (let y = 0; y < TILE_H; y += 9) {
      g.beginPath();
      g.moveTo(cx - 6, y);
      g.lineTo(cx, y + 4);
      g.lineTo(cx + 6, y);
      g.stroke();
    }
  }
  // fűcsomók: út közepén ritkán, padkán sűrűn, mezőn
  const tuft = (x, y, s, col) =>
    wrap((o) => {
      g.strokeStyle = col;
      g.lineWidth = 1.3;
      g.beginPath();
      for (let k = -2; k <= 2; k++) {
        g.moveTo(x + k * 1.5 * s, y + o);
        g.lineTo(x + k * 2.6 * s, y + o - 6 * s);
      }
      g.stroke();
    });
  for (let i = 0; i < 26; i++) tuft(ROAD_C + (rnd() - 0.5) * 14, rnd() * TILE_H, 0.7 + rnd() * 0.4, '#7a9b3c');
  for (let i = 0; i < 70; i++) {
    const left = rnd() < 0.5;
    const x = left ? SHOULDER_L + 4 + rnd() * (ROAD_L - SHOULDER_L - 6) : ROAD_R + 2 + rnd() * (SHOULDER_R - ROAD_R - 6);
    tuft(x, rnd() * TILE_H, 0.8 + rnd() * 0.5, rnd() < 0.5 ? '#5e9a38' : '#93c95f');
  }
  for (let i = 0; i < 60; i++) {
    const left = rnd() < 0.5;
    const x = left ? rnd() * (FENCE_L - 4) : FENCE_R + 4 + rnd() * (W - FENCE_R - 4);
    tuft(x, rnd() * TILE_H, 0.8 + rnd() * 0.4, '#4f8f30');
  }
  // nád az árokban
  for (let i = 0; i < 40; i++) {
    const left = rnd() < 0.5;
    const x = left ? DITCH_L + rnd() * 10 : DITCH_R - 10 + rnd() * 10;
    tuft(x, rnd() * TILE_H, 1.1, '#3c6e2c');
  }
  // apró virágok a mezőn
  for (let i = 0; i < 46; i++) {
    const left = rnd() < 0.5;
    const x = left ? 3 + rnd() * (FENCE_L - 8) : FENCE_R + 5 + rnd() * (W - FENCE_R - 8);
    const y = rnd() * TILE_H;
    const col = ['#fff7c2', '#ffd23f', '#e9584a', '#c9a0ff'][Math.floor(rnd() * 4)];
    wrap((o) => {
      g.fillStyle = col;
      ellipse(g, x, y + o, 1.6, 1.6);
      g.fill();
    });
  }

  // kerítés: két léc + oszlopok 64 egységenként (TILE_H / 64 = 8, varrat nélkül)
  for (const fx of [FENCE_L, FENCE_R]) {
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(fx + 2, 0, 3, TILE_H);
    g.fillStyle = '#9b7447';
    g.fillRect(fx - 3, 0, 2.5, TILE_H);
    g.fillRect(fx + 1, 0, 2.5, TILE_H);
    for (let y = 0; y < TILE_H; y += 64) {
      g.fillStyle = 'rgba(0,0,0,0.22)';
      g.fillRect(fx - 2, y + 3, 9, 9);
      g.fillStyle = '#7a5530';
      g.fillRect(fx - 5, y, 9, 9);
      g.fillStyle = '#a77d4f';
      g.fillRect(fx - 5, y, 9, 3);
    }
  }
  return c;
}

// ------------------------------------------------------------------ díszletek
export function drawScenery(ctx, d, t) {
  const { x, y, s = 1 } = d;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * (d.flip ? -1 : 1), s);
  switch (d.type) {
    case 'tree': {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ellipse(ctx, 8, 8, 30, 26);
      ctx.fill();
      ctx.fillStyle = '#6b4a2b';
      rrect(ctx, -4, 0, 8, 22, 3);
      ctx.fill();
      const sway = Math.sin(t * 1.3 + d.seed) * 1.5;
      const blobs = [
        [0, -14, 26, '#3f7f2d'],
        [-14, -6, 18, '#3a7629'],
        [14, -6, 18, '#3a7629'],
        [-6, -22, 16, '#4c9235'],
        [9, -18, 15, '#52993a'],
        [-3, -10, 12, '#5aa441'],
      ];
      for (const [bx, by, r, col] of blobs) {
        ctx.fillStyle = col;
        ellipse(ctx, bx + sway, by, r, r * 0.92);
        ctx.fill();
      }
      if (d.apples) {
        ctx.fillStyle = '#e23b2e';
        for (const [ax, ay] of [[-10, -12], [8, -24], [12, -4], [-2, -2], [-16, -20]]) {
          ellipse(ctx, ax + sway, ay, 2.6, 2.6);
          ctx.fill();
        }
      }
      break;
    }
    case 'bush': {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ellipse(ctx, 4, 6, 16, 9);
      ctx.fill();
      for (const [bx, by, r, col] of [[-8, 0, 9, '#3d7a2b'], [7, 0, 9, '#3d7a2b'], [0, -5, 10, '#4b8f34'], [0, 1, 7, '#57a03d']]) {
        ctx.fillStyle = col;
        ellipse(ctx, bx, by, r, r * 0.85);
        ctx.fill();
      }
      break;
    }
    case 'haystack': {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ellipse(ctx, 6, 10, 22, 12);
      ctx.fill();
      const grd = ctx.createRadialGradient(-5, -8, 2, 0, 0, 22);
      grd.addColorStop(0, '#f6d77a');
      grd.addColorStop(1, '#c99a35');
      ctx.fillStyle = grd;
      ellipse(ctx, 0, 0, 20, 18);
      ctx.fill();
      ctx.strokeStyle = 'rgba(140,100,30,0.6)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 6, Math.sin(a) * 5);
        ctx.lineTo(Math.cos(a) * 18, Math.sin(a) * 16);
        ctx.stroke();
      }
      break;
    }
    case 'sunflowers': {
      for (let i = 0; i < 5; i++) {
        const fx = (i % 3) * 10 - 10;
        const fy = Math.floor(i / 3) * 14 - 6;
        const bob = Math.sin(t * 2 + i + d.seed) * 0.8;
        ctx.fillStyle = '#3f8a2a';
        ellipse(ctx, fx + 4, fy + 4, 4, 2);
        ctx.fill();
        ctx.fillStyle = '#ffcc1a';
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * TAU;
          ellipse(ctx, fx + Math.cos(a) * 5 + bob, fy + Math.sin(a) * 5, 2.6, 1.6, a);
          ctx.fill();
        }
        ctx.fillStyle = '#6b3d14';
        ellipse(ctx, fx + bob, fy, 3.4, 3.4);
        ctx.fill();
      }
      break;
    }
    case 'house': {
      // tanyasi ház felülnézetből: fehér fal, piros cserepes nyeregtető, kémény
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(-26, -38, 60, 84);
      ctx.fillStyle = '#f3efe4';
      ctx.fillRect(-30, -42, 56, 82);
      ctx.fillStyle = '#c4472e';
      ctx.fillRect(-34, -46, 32, 90);
      ctx.fillStyle = '#a93a24';
      ctx.fillRect(-2, -46, 32, 90);
      ctx.strokeStyle = 'rgba(80,20,10,0.35)';
      ctx.lineWidth = 1;
      for (let yy = -42; yy < 44; yy += 6) {
        ctx.beginPath();
        ctx.moveTo(-34, yy);
        ctx.lineTo(30, yy);
        ctx.stroke();
      }
      ctx.fillStyle = '#7d2818';
      ctx.fillRect(-3, -46, 3, 90);
      ctx.fillStyle = '#8a7a6a';
      ctx.fillRect(8, -20, 9, 9);
      ctx.fillStyle = 'rgba(200,200,200,0.5)';
      ellipse(ctx, 12 + Math.sin(t * 2) * 2, -28 - ((t * 10) % 12), 4, 3);
      ctx.fill();
      break;
    }
    case 'well': {
      // gémeskút: kávájú kút + ágas + hosszú gém
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ellipse(ctx, 3, 4, 12, 10);
      ctx.fill();
      ctx.fillStyle = '#8b8b8b';
      ellipse(ctx, 0, 0, 10, 10);
      ctx.fill();
      ctx.fillStyle = '#2c4b6b';
      ellipse(ctx, 0, 0, 6.5, 6.5);
      ctx.fill();
      ctx.strokeStyle = '#6b4a2b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-14, -40);
      ctx.lineTo(22, 26);
      ctx.stroke();
      ctx.fillStyle = '#5a3d22';
      ellipse(ctx, 10, 4, 3.5, 3.5);
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#4a3420';
      ctx.beginPath();
      ctx.moveTo(-14, -40);
      ctx.lineTo(0, 0);
      ctx.stroke();
      break;
    }
    case 'flowers': {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU + d.seed;
        ctx.fillStyle = ['#ff6b6b', '#ffd93d', '#ffffff', '#b28dff'][i % 4];
        ellipse(ctx, Math.cos(a) * 9, Math.sin(a) * 7, 2.4, 2.4);
        ctx.fill();
      }
      break;
    }
  }
  ctx.restore();
}

// ------------------------------------------------------------------ tárgyak (felvehető)
function halo(ctx, r, col, t) {
  const p = 1 + Math.sin(t * 5) * 0.12;
  const g = ctx.createRadialGradient(0, 0, 2, 0, 0, r * p);
  g.addColorStop(0, col);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ellipse(ctx, 0, 0, r * p, r * p);
  ctx.fill();
}

export function drawBeer(ctx, x, y, t, s = 1) {
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 4) * 2);
  ctx.scale(s, s);
  halo(ctx, 26, 'rgba(255,240,140,0.55)', t);
  ctx.rotate(Math.sin(t * 2.5) * 0.12);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ellipse(ctx, 2, 17, 8, 3);
  ctx.fill();
  // üveg
  ctx.fillStyle = '#1f7a2e';
  rrect(ctx, -7, -4, 14, 21, 4);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-7, -2);
  ctx.quadraticCurveTo(-7, -9, -3, -11);
  ctx.lineTo(-3, -18);
  ctx.lineTo(3, -18);
  ctx.lineTo(3, -11);
  ctx.quadraticCurveTo(7, -9, 7, -2);
  ctx.fill();
  // címke
  ctx.fillStyle = '#f2e3b3';
  rrect(ctx, -6, 2, 12, 9, 2);
  ctx.fill();
  ctx.fillStyle = '#c0392b';
  ellipse(ctx, 0, 6.5, 3.6, 2.6);
  ctx.fill();
  // kupak
  ctx.fillStyle = '#e8c547';
  ctx.fillRect(-3.5, -21, 7, 3.5);
  // csillanás
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillRect(-5, -2, 2, 16);
  ctx.restore();
}

export function drawCoffee(ctx, x, y, t) {
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 4 + 1) * 2);
  halo(ctx, 26, 'rgba(255,200,140,0.5)', t);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ellipse(ctx, 2, 12, 11, 3.5);
  ctx.fill();
  ctx.strokeStyle = '#f4f4f4';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(10, 2, 5, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  rrect(ctx, -10, -6, 20, 18, 4);
  ctx.fill();
  ctx.fillStyle = '#d64545';
  ctx.fillRect(-10, 2, 20, 3);
  ctx.fillStyle = '#e6e6e6';
  ellipse(ctx, 0, -6, 10, 3.5);
  ctx.fill();
  ctx.fillStyle = '#5b3417';
  ellipse(ctx, 0, -6, 8, 2.6);
  ctx.fill();
  // gőz
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 1.8;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    const ph = t * 3 + i;
    ctx.moveTo(i * 4, -10);
    ctx.bezierCurveTo(i * 4 + Math.sin(ph) * 4, -15, i * 4 - Math.sin(ph) * 4, -19, i * 4, -24);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawPickle(ctx, x, y, t) {
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 4 + 2) * 2);
  halo(ctx, 26, 'rgba(190,255,150,0.5)', t);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ellipse(ctx, 2, 14, 11, 3.5);
  ctx.fill();
  // befőttesüveg
  ctx.fillStyle = 'rgba(200,235,220,0.85)';
  rrect(ctx, -11, -10, 22, 24, 5);
  ctx.fill();
  ctx.fillStyle = '#d9c46a';
  ctx.fillRect(-11, -4, 22, 18);
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#4e8a2a';
  for (const [px, rot] of [[-5, 0.2], [0, -0.1], [5, 0.15]]) {
    ellipse(ctx, px, 3, 3, 9, rot);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-9, 4, 18, 6);
  ctx.fillStyle = '#2f6b1c';
  ctx.font = 'bold 4.5px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SAVANYÚ', 0, 8.6);
  ctx.fillStyle = '#e8b923';
  rrect(ctx, -12, -15, 24, 6, 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillRect(-9, -8, 2, 18);
  ctx.restore();
}

// ------------------------------------------------------------------ talajakadályok
export function drawPothole(ctx, x, y, seed = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#e0c08a';
  ellipse(ctx, 0, 1.5, 25, 15);
  ctx.fill();
  ctx.fillStyle = '#6a4724';
  ellipse(ctx, 0, 0, 22, 13);
  ctx.fill();
  ctx.fillStyle = '#3f2a14';
  ellipse(ctx, 1, 2, 16, 8.5);
  ctx.fill();
  ctx.strokeStyle = '#6a4724';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(20, -3);
  ctx.lineTo(28, -7 + seed * 3);
  ctx.moveTo(-19, 5);
  ctx.lineTo(-27, 9);
  ctx.lineTo(-30, 7);
  ctx.stroke();
  ctx.fillStyle = '#a58660';
  for (const [px, py] of [[-12, -9], [14, 9], [-3, 12]]) {
    ellipse(ctx, px, py, 2, 1.5);
    ctx.fill();
  }
  ctx.restore();
}

export function drawPuddle(ctx, x, y, t, seed = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#8a6b43';
  for (const [px, py, rx, ry] of [[0, 0, 34, 19], [-18, 5, 18, 12], [17, -4, 19, 12]]) {
    ellipse(ctx, px, py + 1.5, rx + 2, ry + 2);
    ctx.fill();
  }
  const grd = ctx.createLinearGradient(-30, -18, 30, 18);
  grd.addColorStop(0, '#9fc0d4');
  grd.addColorStop(1, '#5d7f96');
  ctx.fillStyle = grd;
  for (const [px, py, rx, ry] of [[0, 0, 34, 19], [-18, 5, 18, 12], [17, -4, 19, 12]]) {
    ellipse(ctx, px, py, rx, ry);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.ellipse(-8, -6, 12, 4, -0.2, Math.PI * 1.1, Math.PI * 1.7);
  ctx.stroke();
  // fodrozódás
  const r = ((t * 14 + seed * 10) % 16) + 2;
  ctx.strokeStyle = `rgba(255,255,255,${0.5 - r / 36})`;
  ctx.lineWidth = 1;
  ellipse(ctx, 8, 4, r, r * 0.5);
  ctx.stroke();
  ctx.restore();
}

// ------------------------------------------------------------------ állatok
/**
 * Kecske. dir: 'down' (szembe néz), 'left' / 'right' (oldalnézet, fut). angry: rohamozó kecske.
 */
export function drawGoat(ctx, x, y, { dir = 'down', t = 0, run = 0, angry = false, s = 1, upsideDown = false } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  const body = angry ? '#d8cfc2' : '#f1ece2';
  const patch = '#8b6a4a';
  const horn = '#b7a27a';
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ellipse(ctx, 3, 16, 22, 7);
  ctx.fill();
  if (dir === 'down') {
    const bob = Math.sin(t * 3) * 1;
    // lábak
    ctx.fillStyle = '#5b4636';
    for (const lx of [-13, -6, 6, 13]) ctx.fillRect(lx - 2, 6, 4, 10);
    // test
    ctx.fillStyle = body;
    ellipse(ctx, 0, 0, 19, 13);
    ctx.fill();
    ctx.fillStyle = patch;
    ellipse(ctx, 8, -4, 6, 4, 0.4);
    ctx.fill();
    // fej
    ctx.save();
    ctx.translate(0, 4 + bob);
    ctx.fillStyle = horn;
    ctx.beginPath();
    ctx.moveTo(-5, -10);
    ctx.quadraticCurveTo(-12, -20, -16, -12);
    ctx.lineTo(-13, -11);
    ctx.quadraticCurveTo(-10, -15, -6, -7);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(5, -10);
    ctx.quadraticCurveTo(12, -20, 16, -12);
    ctx.lineTo(13, -11);
    ctx.quadraticCurveTo(10, -15, 6, -7);
    ctx.fill();
    ctx.fillStyle = body;
    ellipse(ctx, -11, -4, 6, 3, -0.5);
    ctx.fill();
    ellipse(ctx, 11, -4, 6, 3, 0.5);
    ctx.fill();
    ellipse(ctx, 0, 0, 8.5, 10);
    ctx.fill();
    ctx.fillStyle = '#e8b4a8';
    ellipse(ctx, 0, 7, 5, 3.5);
    ctx.fill();
    // szemek (vízszintes pupilla – kecskésen)
    ctx.fillStyle = angry ? '#ffdf5a' : '#f7e9a8';
    ellipse(ctx, -4, -2, 2.8, 2.4);
    ctx.fill();
    ellipse(ctx, 4, -2, 2.8, 2.4);
    ctx.fill();
    ctx.fillStyle = '#1b1b1b';
    ctx.fillRect(-5.8, -2.6, 3.6, 1.2);
    ctx.fillRect(2.2, -2.6, 3.6, 1.2);
    if (angry) {
      ctx.strokeStyle = '#3b2a1a';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-7, -6);
      ctx.lineTo(-2, -4);
      ctx.moveTo(7, -6);
      ctx.lineTo(2, -4);
      ctx.stroke();
    }
    // szakáll
    ctx.fillStyle = '#d9d0c0';
    ctx.beginPath();
    ctx.moveTo(-3, 9);
    ctx.lineTo(0, 17 + Math.sin(t * 6) * 1);
    ctx.lineTo(3, 9);
    ctx.fill();
    ctx.restore();
  } else {
    const f = dir === 'left' ? -1 : 1;
    ctx.scale(f, 1);
    const leg = Math.sin(run * 18) * 5;
    ctx.fillStyle = '#5b4636';
    ctx.save();
    for (const [lx, ph] of [[-12, 1], [-7, -1], [8, -1], [13, 1]]) {
      ctx.save();
      ctx.translate(lx, 6);
      ctx.rotate((leg * ph) / 14);
      ctx.fillRect(-1.8, 0, 3.6, 11);
      ctx.restore();
    }
    ctx.restore();
    ctx.fillStyle = body;
    ellipse(ctx, 0, 0, 20, 10);
    ctx.fill();
    ctx.fillStyle = patch;
    ellipse(ctx, -6, -3, 6, 4);
    ctx.fill();
    // farok
    ctx.fillStyle = body;
    ellipse(ctx, -20, -6 + Math.sin(run * 20) * 2, 4, 2.5, -0.6);
    ctx.fill();
    // fej
    ctx.save();
    ctx.translate(20, -6);
    ctx.fillStyle = horn;
    ctx.beginPath();
    ctx.moveTo(-2, -6);
    ctx.quadraticCurveTo(-10, -16, -14, -6);
    ctx.lineTo(-11, -6);
    ctx.quadraticCurveTo(-8, -11, -3, -3);
    ctx.fill();
    ctx.fillStyle = body;
    ellipse(ctx, 3, 0, 9, 6.5, 0.3);
    ctx.fill();
    ellipse(ctx, -4, -2, 5, 2.4, -0.8);
    ctx.fill();
    ctx.fillStyle = '#e8b4a8';
    ellipse(ctx, 10, 3, 3, 2.5);
    ctx.fill();
    ctx.fillStyle = '#f7e9a8';
    ellipse(ctx, 3, -2, 2.4, 2.2);
    ctx.fill();
    ctx.fillStyle = '#1b1b1b';
    ctx.fillRect(1.6, -2.5, 3, 1.1);
    ctx.fillStyle = '#d9d0c0';
    ctx.beginPath();
    ctx.moveTo(6, 5);
    ctx.lineTo(7, 12);
    ctx.lineTo(9, 5);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

export function drawChicken(ctx, x, y, { t = 0, ang = Math.PI / 2, flap = 0, brown = false } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ellipse(ctx, 2, 4, 8, 4);
  ctx.fill();
  ctx.rotate(ang - Math.PI / 2);
  const body = brown ? '#b5733a' : '#fbfbf6';
  const wing = brown ? '#9a5d2a' : '#e6e3d6';
  const fl = flap ? Math.sin(t * 40) * 4 : 0;
  ctx.fillStyle = wing;
  ellipse(ctx, -6 - Math.abs(fl), -1, 4 + Math.abs(fl) * 0.6, 6, 0.3);
  ctx.fill();
  ellipse(ctx, 6 + Math.abs(fl), -1, 4 + Math.abs(fl) * 0.6, 6, -0.3);
  ctx.fill();
  ctx.fillStyle = body;
  ellipse(ctx, 0, 0, 6.5, 8);
  ctx.fill();
  ctx.fillStyle = brown ? '#7d4a1d' : '#ece8da';
  ellipse(ctx, 0, -9, 3.5, 3); // farok
  ctx.fill();
  ctx.fillStyle = body;
  ellipse(ctx, 0, 8, 4, 4);
  ctx.fill();
  ctx.fillStyle = '#e2312b';
  ellipse(ctx, 0, 6.5, 1.8, 2.4);
  ctx.fill();
  ctx.fillStyle = '#f2a516';
  ctx.beginPath();
  ctx.moveTo(-1.6, 11);
  ctx.lineTo(0, 14);
  ctx.lineTo(1.6, 11);
  ctx.fill();
  ctx.fillStyle = '#111';
  ellipse(ctx, -2, 9, 0.9, 0.9);
  ctx.fill();
  ellipse(ctx, 2, 9, 0.9, 0.9);
  ctx.fill();
  ctx.restore();
}

// ------------------------------------------------------------------ traktor (szembejön)
export function drawTractor(ctx, x, y, t) {
  ctx.save();
  ctx.translate(x, y);
  const vib = Math.sin(t * 40) * 0.6;
  ctx.translate(vib, 0);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  rrect(ctx, -56, -52, 120, 112, 12);
  ctx.fill();
  // hátsó nagy kerekek
  const wheel = (wx, wy, w, h) => {
    ctx.fillStyle = '#1e1e1e';
    rrect(ctx, wx - w / 2, wy - h / 2, w, h, 5);
    ctx.fill();
    ctx.strokeStyle = '#3c3c3c';
    ctx.lineWidth = 2;
    const off = (t * 60) % 8;
    for (let yy = -h / 2 + off; yy < h / 2; yy += 8) {
      ctx.beginPath();
      ctx.moveTo(wx - w / 2 + 2, wy + yy);
      ctx.lineTo(wx + w / 2 - 2, wy + yy + 3);
      ctx.stroke();
    }
  };
  wheel(-46, -24, 24, 50);
  wheel(46, -24, 24, 50);
  wheel(-34, 34, 13, 24);
  wheel(34, 34, 13, 24);
  // sárvédők
  ctx.fillStyle = '#b3241c';
  rrect(ctx, -60, -40, 18, 36, 6);
  ctx.fill();
  rrect(ctx, 42, -40, 18, 36, 6);
  ctx.fill();
  // motorháztető
  const hood = ctx.createLinearGradient(-24, 0, 24, 0);
  hood.addColorStop(0, '#a11d16');
  hood.addColorStop(0.5, '#e0362b');
  hood.addColorStop(1, '#a11d16');
  ctx.fillStyle = hood;
  rrect(ctx, -22, -14, 44, 64, 8);
  ctx.fill();
  // hűtőrács + lámpák
  ctx.fillStyle = '#d9d9d9';
  rrect(ctx, -15, 38, 30, 12, 3);
  ctx.fill();
  ctx.strokeStyle = '#777';
  ctx.lineWidth = 1;
  for (let i = -12; i <= 12; i += 4) {
    ctx.beginPath();
    ctx.moveTo(i, 39);
    ctx.lineTo(i, 49);
    ctx.stroke();
  }
  ctx.fillStyle = '#fff6b0';
  ellipse(ctx, -17, 46, 4, 4);
  ctx.fill();
  ellipse(ctx, 17, 46, 4, 4);
  ctx.fill();
  const glow = ctx.createRadialGradient(0, 60, 2, 0, 60, 46);
  glow.addColorStop(0, 'rgba(255,250,190,0.35)');
  glow.addColorStop(1, 'rgba(255,250,190,0)');
  ctx.fillStyle = glow;
  ellipse(ctx, 0, 66, 46, 24);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('MTZ', 0, 24);
  // kipufogó
  ctx.fillStyle = '#222';
  ellipse(ctx, 14, -4, 3.5, 3.5);
  ctx.fill();
  // fülke teteje
  ctx.fillStyle = '#e9e4da';
  rrect(ctx, -34, -54, 68, 42, 6);
  ctx.fill();
  ctx.fillStyle = '#5b86a8';
  rrect(ctx, -28, -18, 56, 7, 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(-34, -54, 68, 5);
  ctx.restore();
}

// ------------------------------------------------------------------ Eduárd a biciklin
/**
 * Hátulnézetes biciklis Eduárd, a fejét (a felhasználó saját rajzolt karaktere, kivágott PNG)
 * hátrafordítva mutatja. Origó: a test közepe. A billenés (tilt) a hátsó kerék talppontja körül forgat.
 * p: {tilt, pedal, air, drink, steer}
 */
export function drawPlayer(ctx, x, y, p, head, t) {
  ctx.save();
  ctx.translate(x, y);
  // árnyék (nem forog), ugráskor kisebb és halványabb
  ctx.fillStyle = `rgba(0,0,0,${0.28 - p.air * 0.12})`;
  ellipse(ctx, 0, 40, 20 - p.air * 6, 7 - p.air * 2);
  ctx.fill();
  ctx.translate(0, -p.air * 22);
  const sc = 1 + p.air * 0.18;
  ctx.scale(sc, sc);
  ctx.translate(0, 40);
  ctx.rotate(p.tilt);
  ctx.translate(0, -40);

  const legA = Math.sin(p.pedal);
  // hátsó kerék
  ctx.fillStyle = '#1d1d1d';
  rrect(ctx, -4.5, 14, 9, 30, 4);
  ctx.fill();
  ctx.fillStyle = '#9aa0a6';
  rrect(ctx, -5.5, 14, 11, 16, 4); // sárvédő
  ctx.fill();
  // csomagtartó + sörösláda
  ctx.fillStyle = '#8a5a2b';
  rrect(ctx, -12, 16, 24, 14, 2);
  ctx.fill();
  ctx.strokeStyle = '#5e3b19';
  ctx.lineWidth = 1;
  ctx.strokeRect(-12, 16, 24, 14);
  ctx.fillStyle = '#1f7a2e';
  for (const bx of [-7, 0, 7]) {
    ellipse(ctx, bx, 20, 2.8, 2.8);
    ctx.fill();
  }
  ctx.fillStyle = '#e8c547';
  for (const bx of [-7, 0, 7]) {
    ellipse(ctx, bx, 20, 1.3, 1.3);
    ctx.fill();
  }
  // első kerék (a fej fölött kilátszik), kormányzás szerint elfordítva
  ctx.save();
  ctx.translate(0, -52);
  ctx.rotate(p.steer * 0.35);
  ctx.fillStyle = '#1d1d1d';
  rrect(ctx, -4, -16, 8, 28, 4);
  ctx.fill();
  ctx.fillStyle = '#9aa0a6';
  rrect(ctx, -5, -16, 10, 9, 4);
  ctx.fill();
  ctx.restore();
  // váz
  ctx.strokeStyle = '#b0302a';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 16);
  ctx.lineTo(0, -46);
  ctx.stroke();
  // lábak (farmer), pedálozó mozgás
  ctx.lineWidth = 9;
  ctx.strokeStyle = '#3d5f98';
  for (const sd of [-1, 1]) {
    const ph = sd * legA;
    ctx.beginPath();
    ctx.moveTo(sd * 10, 8);
    ctx.lineTo(sd * 21, 4 + ph * 5);
    ctx.lineTo(sd * 14, 20 + ph * 7);
    ctx.stroke();
    ctx.fillStyle = '#4a3020';
    ellipse(ctx, sd * 14, 22 + ph * 7, 4.8, 3.6);
    ctx.fill();
  }
  // pulóver-test (krém, lyukakkal, rojtos alj)
  ctx.fillStyle = '#efe6cf';
  ellipse(ctx, 0, 0, 22, 17);
  ctx.fill();
  ctx.fillStyle = '#efe6cf';
  ctx.beginPath();
  ctx.moveTo(-19, 8);
  for (let i = 0; i <= 10; i++) ctx.lineTo(-19 + i * 3.8, 13 + (i % 2) * 4);
  ctx.lineTo(19, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(160,140,100,0.5)';
  ctx.lineWidth = 1.2;
  ellipse(ctx, 0, 0, 22, 17);
  ctx.stroke();
  for (const [hx, hy, hr, rot] of [[-10, 4, 4, 0.4], [9, -6, 3.2, -0.3], [12, 8, 2.5, 0.8]]) {
    ctx.fillStyle = '#c99a7e';
    ellipse(ctx, hx, hy, hr + 1, hr * 0.75 + 1, rot);
    ctx.fill();
    ctx.fillStyle = '#eba58c';
    ellipse(ctx, hx, hy, hr, hr * 0.7, rot);
    ctx.fill();
  }
  // karok a kormányhoz (könyök kifelé)
  ctx.lineWidth = 8.5;
  ctx.strokeStyle = '#e8dec4';
  const drinking = p.drink > 0;
  for (const sd of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sd * 17, -6);
    if (sd === 1 && drinking) {
      ctx.lineTo(sd * 28, -20);
      ctx.lineTo(sd * 14, -34);
    } else {
      ctx.lineTo(sd * 27, -24);
      ctx.lineTo(sd * 21, -44);
    }
    ctx.stroke();
  }
  // kormány
  ctx.strokeStyle = '#3b3b3b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-24, -45);
  ctx.quadraticCurveTo(0, -50, 24, -45);
  ctx.stroke();

  // fej (kivágott PNG) – enyhe bólogatás pedálozás közben
  const bob = Math.sin(p.pedal * 2) * 0.8;
  if (head && head.complete && head.naturalWidth) {
    const hh = 56;
    const hw = (head.naturalWidth / head.naturalHeight) * hh;
    ctx.drawImage(head, -hw / 2, -53 + bob, hw, hh);
  } else {
    drawFallbackHead(ctx, 0, -24 + bob);
  }
  // kezek + sörösüveg a jobb kézben (elöl)
  ctx.fillStyle = '#eeb39a';
  ellipse(ctx, -21, -44, 4.5, 4.5);
  ctx.fill();
  if (drinking) {
    ctx.save();
    ctx.translate(12, -30);
    ctx.rotate(-2.2);
    ctx.fillStyle = '#1f7a2e';
    rrect(ctx, -3.5, -2, 7, 14, 3);
    ctx.fill();
    ctx.fillRect(-1.6, -8, 3.2, 7);
    ctx.restore();
    ctx.fillStyle = '#eeb39a';
    ellipse(ctx, 14, -34, 4.5, 4.5);
    ctx.fill();
  } else {
    ctx.save();
    ctx.translate(24, -48);
    ctx.rotate(0.25);
    ctx.fillStyle = '#1f7a2e';
    rrect(ctx, -3.5, -10, 7, 14, 3);
    ctx.fill();
    ctx.fillRect(-1.6, -16, 3.2, 7);
    ctx.fillStyle = '#e8c547';
    ctx.fillRect(-1.8, -18, 3.6, 2.2);
    ctx.restore();
    ctx.fillStyle = '#eeb39a';
    ellipse(ctx, 21, -44, 4.5, 4.5);
    ctx.fill();
  }
  ctx.restore();
}

/** Tartalék fej, ha a PNG nem töltődött be: vörös haj, szakáll, nagy piros orr. */
export function drawFallbackHead(ctx, x, y, s = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = '#b8481f';
  ellipse(ctx, 0, -4, 24, 24);
  ctx.fill();
  ctx.fillStyle = '#f0bfa0';
  ellipse(ctx, 0, -4, 17, 18);
  ctx.fill();
  ctx.fillStyle = '#b8481f';
  ellipse(ctx, 0, 12, 20, 14);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ellipse(ctx, -6, -8, 3.5, 3);
  ctx.fill();
  ellipse(ctx, 6, -8, 3.5, 3);
  ctx.fill();
  ctx.fillStyle = '#222';
  ellipse(ctx, -6, -8, 1.6, 1.6);
  ctx.fill();
  ellipse(ctx, 6, -8, 1.6, 1.6);
  ctx.fill();
  ctx.fillStyle = '#e8525a';
  ellipse(ctx, 0, 0, 7, 6);
  ctx.fill();
  ctx.restore();
}

/** Szövegbuborék (ütközés-animációkhoz) */
export function drawBubble(ctx, x, y, text, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = 'bold 15px "Trebuchet MS", sans-serif';
  const w = ctx.measureText(text).width + 18;
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  rrect(ctx, x - w / 2, y - 30, w, 26, 10);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 6, y - 5);
  ctx.lineTo(x, y + 6);
  ctx.lineTo(x + 6, y - 5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y - 12);
  ctx.restore();
}

export function drawStar(ctx, x, y, r, rot = 0, col = '#ffd93d') {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = col;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = (i / 10) * TAU - Math.PI / 2;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
