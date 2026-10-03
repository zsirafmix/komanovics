import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeName, validateScore, SCORE_MAX } from '../server/validate.js';
import { sslConfigFor } from '../server/store.js';

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
