// Integrációs teszt: az Express app memóriabeli tárolóval, véletlen porton.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { createMemoryStore } from '../server/store.js';

let server;
let base;

before(async () => {
  const app = createApp({ store: createMemoryStore({ table: 'komanovics_scores' }), rateLimitPerMin: 3 });
  await new Promise((r) => (server = app.listen(0, '127.0.0.1', r)));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const post = (body) =>
  fetch(`${base}/api/scores`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });

test('GET /healthz', async () => {
  const r = await fetch(`${base}/healthz`);
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.ok, true);
  assert.equal(j.storage, 'memory');
  assert.equal(j.game, 'KOMÁNOVICS');
  assert.equal(j.table, 'komanovics_scores');
});

test('GET / kiszolgálja a játékot', async () => {
  const r = await fetch(`${base}/`);
  assert.equal(r.status, 200);
  assert.match(await r.text(), /KOMÁNOVICS/);
});

test('POST + GET /api/scores, rendezés, rate limit', async () => {
  let r = await post({ name: 'Teszt', score: 50, durationSec: 30 });
  assert.equal(r.status, 201);
  r = await post({ name: '<b>Béla</b>', score: 90 });
  assert.equal(r.status, 201);
  const j = await r.json();
  assert.equal(j.name, 'bBélab');
  assert.equal(j.rank, 1);
  r = await post('{nem json');
  assert.equal(r.status, 400);
  r = await post({ name: 'X', score: 1 }); // 4. kérés -> limit (3/perc)
  assert.equal(r.status, 429);
  const g = await (await fetch(`${base}/api/scores`)).json();
  assert.deepEqual(g.scores.map((s) => s.score), [90, 50]);
});

test('ismeretlen API végpont 404', async () => {
  const r = await fetch(`${base}/api/nope`);
  assert.equal(r.status, 404);
});
