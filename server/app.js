// Express alkalmazás összeállítása (a listen külön van az index.js-ben, hogy tesztelhető legyen).
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateScore } from './validate.js';
import { createRateLimiter } from './rateLimit.js';
import { GAME } from './gameConfig.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PUBLIC_DIR = path.join(__dirname, '..', 'public');

/**
 * @param {{store: ReturnType<import('./store.js').createStore>, rateLimitPerMin?: number, limits?: object}} opts
 */
export function createApp({ store, rateLimitPerMin = 5, limits = GAME.limits }) {
  const app = express();
  // Render (és a legtöbb PaaS) reverse proxy mögött fut: az első proxy X-Forwarded-For-ját fogadjuk el,
  // különben minden kérés a proxy IP-jéről jönne és a rate limit mindenkit együtt korlátozna.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'SAMEORIGIN',
      'Content-Security-Policy':
        "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; media-src 'self' blob: data:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'",
    });
    next();
  });

  app.get('/healthz', async (req, res) => {
    const dbOk = await store.health();
    res.status(dbOk ? 200 : 503).json({ ok: dbOk, game: GAME.name, storage: store.kind, table: store.table, time: new Date().toISOString() });
  });

  app.get('/api/scores', async (req, res) => {
    try {
      const scores = await store.top(10);
      res.set('Cache-Control', 'no-store');
      res.json({ storage: store.kind, scores });
    } catch (err) {
      console.error('[api] GET /api/scores failed:', err.message);
      res.status(500).json({ error: 'A ranglista most nem érhető el.' });
    }
  });

  app.post(
    '/api/scores',
    createRateLimiter({ limit: rateLimitPerMin }),
    express.json({ limit: '2kb' }),
    async (req, res) => {
      const v = validateScore(req.body, limits);
      if (!v.ok) return res.status(400).json({ error: v.error });
      try {
        const { id, rank } = await store.add(v.value);
        const scores = await store.top(10);
        res.status(201).json({ id, rank, name: v.value.name, score: v.value.score, scores });
      } catch (err) {
        console.error('[api] POST /api/scores failed:', err.message);
        res.status(500).json({ error: 'Nem sikerült menteni a pontszámot.' });
      }
    },
  );

  app.use('/api', (req, res) => res.status(404).json({ error: 'Nincs ilyen végpont.' }));

  app.use(
    express.static(PUBLIC_DIR, {
      extensions: ['html'],
      setHeaders(res, filePath) {
        // A JS/CSS/HTML legyen mindig friss (nincs build-lépés / fájlnév-hash); a képek cache-elhetők.
        if (/\.(png|jpg|jpeg|webp)$/.test(filePath)) res.set('Cache-Control', 'public, max-age=86400');
        else res.set('Cache-Control', 'no-cache');
      },
    }),
  );

  // Rossz JSON body -> 400 (az express.json SyntaxError-t dob)
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Hibás JSON.' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Túl nagy kérés.' });
    console.error('[app] unhandled error:', err);
    res.status(500).json({ error: 'Szerverhiba.' });
  });

  return app;
}
