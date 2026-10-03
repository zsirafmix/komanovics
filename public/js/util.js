// Apró, általános segédfüggvények (függőségmentes).
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const TAU = Math.PI * 2;

/** Súlyozott véletlen választás: [{w, v}, ...] -> v */
export function weighted(list) {
  let sum = 0;
  for (const it of list) sum += it.w;
  let r = Math.random() * sum;
  for (const it of list) {
    r -= it.w;
    if (r <= 0) return it.v;
  }
  return list[list.length - 1].v;
}

/**
 * Sima 1D "value noise" (-1..1). A részeg kormány lassú, kiszámíthatatlan sodródásához.
 * Determinisztikus hash, koszinuszos interpoláció.
 */
export function noise1(x) {
  const i = Math.floor(x);
  const f = x - i;
  const h = (n) => {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return (s - Math.floor(s)) * 2 - 1;
  };
  const t = (1 - Math.cos(f * Math.PI)) / 2;
  return h(i) * (1 - t) + h(i + 1) * t;
}

/** Kör–téglalap ütközés (téglalap középpontja cx,cy; fél méretek hw,hh). */
export function circleRect(px, py, r, cx, cy, hw, hh) {
  const dx = Math.max(Math.abs(px - cx) - hw, 0);
  const dy = Math.max(Math.abs(py - cy) - hh, 0);
  return dx * dx + dy * dy < r * r;
}

export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
