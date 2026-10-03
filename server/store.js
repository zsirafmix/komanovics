// Ranglista tároló: PostgreSQL (ha van DATABASE_URL), különben memóriabeli fallback.
// Mindkét implementáció ugyanazt az interfészt adja:
//   kind: 'postgres' | 'memory'
//   init(): Promise<void>
//   top(limit): Promise<Array<{name, score, level, created_at}>>
//   add({name, score, level, durationSec}): Promise<{id, rank}>
//   health(): Promise<boolean>
//   close(): Promise<void>
import pg from 'pg';

const TOP_DEFAULT = 10;

export function createMemoryStore() {
  /** @type {Array<{id:number,name:string,score:number,level:number,duration_sec:number|null,created_at:string}>} */
  const rows = [];
  let nextId = 1;
  const sorted = () =>
    [...rows].sort((a, b) => b.score - a.score || a.created_at.localeCompare(b.created_at) || a.id - b.id);
  return {
    kind: 'memory',
    async init() {},
    async top(limit = TOP_DEFAULT) {
      return sorted()
        .slice(0, limit)
        .map(({ name, score, level, created_at }) => ({ name, score, level, created_at }));
    },
    async add({ name, score, level, durationSec }) {
      const row = { id: nextId++, name, score, level, duration_sec: durationSec, created_at: new Date().toISOString() };
      rows.push(row);
      // Memória-korlát: csak a legjobb 1000 sort tartjuk meg.
      if (rows.length > 1000) {
        const keep = sorted().slice(0, 1000);
        rows.length = 0;
        rows.push(...keep);
      }
      const rank = rows.filter((r) => r.score > score).length + 1;
      return { id: row.id, rank };
    },
    async health() {
      return true;
    },
    async close() {},
  };
}

/** SSL döntés: DATABASE_SSL=true/false felülírja; különben külső Render host (*.render.com) => SSL. */
export function sslConfigFor(url, flag) {
  if (flag === 'true') return { rejectUnauthorized: false };
  if (flag === 'false') return false;
  try {
    const host = new URL(url).hostname;
    if (host.endsWith('.render.com')) return { rejectUnauthorized: false };
  } catch {
    /* hibás URL – a pg majd jelzi */
  }
  return false; // Render belső hostnév (dpg-xxxx-a) – nincs SSL
}

export function createPgStore(url, sslFlag) {
  const pool = new pg.Pool({
    connectionString: url,
    ssl: sslConfigFor(url, sslFlag),
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  // Egy tétlen kliens hibája (pl. DB újraindulás) ne döntse le a processzt.
  pool.on('error', (err) => console.error('[pg] pool error:', err.message));

  return {
    kind: 'postgres',
    async init() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS scores (
          id           SERIAL PRIMARY KEY,
          name         VARCHAR(16) NOT NULL,
          score        INTEGER NOT NULL CHECK (score >= 0 AND score <= 1000000),
          level        INTEGER NOT NULL DEFAULT 1,
          duration_sec INTEGER,
          created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS scores_score_idx ON scores (score DESC, created_at ASC);
      `);
    },
    async top(limit = TOP_DEFAULT) {
      const { rows } = await pool.query(
        'SELECT name, score, level, created_at FROM scores ORDER BY score DESC, created_at ASC, id ASC LIMIT $1',
        [limit],
      );
      return rows;
    },
    async add({ name, score, level, durationSec }) {
      const { rows } = await pool.query(
        'INSERT INTO scores (name, score, level, duration_sec) VALUES ($1, $2, $3, $4) RETURNING id',
        [name, score, level, durationSec],
      );
      const r = await pool.query('SELECT COUNT(*)::int AS better FROM scores WHERE score > $1', [score]);
      return { id: rows[0].id, rank: r.rows[0].better + 1 };
    },
    async health() {
      try {
        await pool.query('SELECT 1');
        return true;
      } catch {
        return false;
      }
    },
    async close() {
      await pool.end();
    },
  };
}

export function createStore(env = process.env) {
  if (env.DATABASE_URL && env.DATABASE_URL.trim()) return createPgStore(env.DATABASE_URL.trim(), env.DATABASE_SSL);
  return createMemoryStore();
}
