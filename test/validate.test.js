import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeName, validateScore as validateRaw } from '../server/validate.js';
import { sslConfigFor, assertTableName, createStore } from '../server/store.js';
import { GAME } from '../server/gameConfig.js';

const SCORE_MAX = GAME.limits.scoreMax;
const validateScore = (body) => validateRaw(body, GAME.limits);

test('sanitizeName: HTML és vezérlőkarakterek kiesnek, ékezet marad', () => {
  assert.equal(sanitizeName('<script>alert(1)</script>'), 'scriptalert1scri'); // 16 karakterre vágva
  assert.equal(sanitizeName('  Árvíztűrő   Tükörfúrógép  '), 'Árvíztűrő Tükörf');
  assert.equal(sanitizeName('Eduárd\u0000\n\t!'), 'Eduárd!');
  assert.equal(sanitizeName(42), '');
});

test('validateScore: érvényes beküldés', () => {
  const v = validateScore({ name: 'Teszt', score: 120, level: 2, durationSec: 40 });
  assert.equal(v.ok, true);
  assert.deepEqual(v.value, { name: 'Teszt', score: 120, level: 2, durationSec: 40 });
});

test('validateScore: hibás értékek elutasítva', () => {
  assert.equal(validateScore(null).ok, false);
  assert.equal(validateScore({ name: '', score: 1 }).ok, false);
  assert.equal(validateScore({ name: '<<>>', score: 1 }).ok, false);
  assert.equal(validateScore({ name: 'x'.repeat(65), score: 1 }).ok, false);
  assert.equal(validateScore({ name: 'A', score: -1 }).ok, false);
  assert.equal(validateScore({ name: 'A', score: 1.5 }).ok, false);
  assert.equal(validateScore({ name: 'A', score: '100' }).ok, false);
  assert.equal(validateScore({ name: 'A', score: SCORE_MAX + 1 }).ok, false);
  assert.equal(validateScore({ name: 'A', score: 10, level: 0 }).ok, false);
  // hihetetlen: 1 mp alatt 100000 pont
  assert.equal(validateScore({ name: 'A', score: 100000, durationSec: 1 }).ok, false);
});

test('sslConfigFor: külső render host SSL, belső nem', () => {
  assert.deepEqual(sslConfigFor('postgresql://u:p@dpg-abc.frankfurt-postgres.render.com/db'), { rejectUnauthorized: false });
  assert.equal(sslConfigFor('postgresql://u:p@dpg-abc-a/db'), false);
  assert.equal(sslConfigFor('postgresql://u:p@dpg-abc-a/db', 'true').rejectUnauthorized, false);
});

test('táblanév: játék-specifikus alapértelmezés, SCORES_TABLE felülírás, csak biztonságos azonosító', () => {
  assert.equal(GAME.defaultTable, 'komanovics_scores');
  assert.equal(createStore({}, { defaultTable: GAME.defaultTable }).table, 'komanovics_scores');
  assert.equal(createStore({ SCORES_TABLE: 'proba_scores' }, { defaultTable: GAME.defaultTable }).table, 'proba_scores');
  assert.equal(assertTableName('darts_scores'), 'darts_scores');
  for (const bad of ['', 'Scores', 'x; DROP TABLE y', '1abc', 'a-b', 'a'.repeat(64)]) assert.throws(() => assertTableName(bad));
});
