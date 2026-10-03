// Pontszám-beküldés validálása és a név szanitizálása.
// Szándékosan függőségmentes, hogy unit tesztelhető legyen (test/validate.test.js).

export const NAME_MAX = 16;
export const NAME_MIN = 1;
export const SCORE_MAX = 1_000_000;
export const LEVEL_MAX = 999;
export const DURATION_MAX_SEC = 6 * 60 * 60; // 6 óra

// Elméleti maximum pont / másodperc (sör 10 * max 3x szorzó * sűrű spawn + távolságpont),
// bőséges ráhagyással. Csak durva csalás-szűrő, nem valódi anti-cheat.
export const MAX_POINTS_PER_SEC = 80;
export const BASE_ALLOWANCE = 300;

/**
 * Név tisztítása: Unicode betűk/számok, szóköz és néhány írásjel marad,
 * minden más (HTML, vezérlőkarakterek, emoji) kiesik. Szóközök összevonva.
 * @param {unknown} raw
 * @returns {string} a tisztított név (lehet üres string)
 */
export function sanitizeName(raw) {
  if (typeof raw !== 'string') return '';
  return raw
    .normalize('NFC')
    .replace(/[^\p{L}\p{N} ._\-!?]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX);
}

/**
 * @param {any} body a POST /api/scores JSON body-ja
 * @returns {{ok: true, value: {name: string, score: number, level: number, durationSec: number|null}} | {ok: false, error: string}}
 */
export function validateScore(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Hiányzó vagy hibás JSON törzs.' };

  if (typeof body.name !== 'string') return { ok: false, error: 'A név kötelező.' };
  if (body.name.length > 64) return { ok: false, error: `A név legfeljebb ${NAME_MAX} karakter lehet.` };
  const name = sanitizeName(body.name);
  if (name.length < NAME_MIN) return { ok: false, error: 'A név üres vagy csak nem engedélyezett karaktereket tartalmaz.' };

  const score = body.score;
  if (typeof score !== 'number' || !Number.isInteger(score)) return { ok: false, error: 'A pontszámnak egész számnak kell lennie.' };
  if (score < 0 || score > SCORE_MAX) return { ok: false, error: `A pontszám 0 és ${SCORE_MAX} között lehet.` };

  let level = 1;
  if (body.level !== undefined) {
    if (!Number.isInteger(body.level) || body.level < 1 || body.level > LEVEL_MAX) return { ok: false, error: 'Érvénytelen szint.' };
    level = body.level;
  }

  let durationSec = null;
  if (body.durationSec !== undefined) {
    const d = body.durationSec;
    if (typeof d !== 'number' || !Number.isFinite(d) || d < 0 || d > DURATION_MAX_SEC) return { ok: false, error: 'Érvénytelen játékidő.' };
    durationSec = Math.round(d);
    // Hihetőségi ellenőrzés: ennyi idő alatt nem lehet ennyi pontot szerezni.
    if (score > BASE_ALLOWANCE + durationSec * MAX_POINTS_PER_SEC) return { ok: false, error: 'A pontszám nem hihető ennyi játékidőhöz.' };
  }

  return { ok: true, value: { name, score, level, durationSec } };
}
