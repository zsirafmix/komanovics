// Belépési pont: tároló inicializálása, majd HTTP szerver indítása a $PORT-on (Render: 0.0.0.0:$PORT).
import { createApp } from './app.js';
import { createStore, createMemoryStore } from './store.js';
import { GAME } from './gameConfig.js';

const PORT = Number(process.env.PORT) || 3000;
const RATE = Number(process.env.SCORE_RATE_LIMIT_PER_MIN) || 5;

async function main() {
  let store = createStore(process.env, { defaultTable: GAME.defaultTable });
  // A DB induláskor lehet, hogy épp ébred / újraindul: 5 próbálkozás 3 mp szünettel.
  // Ha így sem megy, ne haljon meg a szolgáltatás: memóriára esünk vissza, és ezt hangosan logoljuk
  // (a /healthz "storage" mezője is mutatja). Ilyenkor a szolgáltatás újraindítása kell a DB-hez.
  for (let attempt = 1; ; attempt++) {
    try {
      await store.init();
      break;
    } catch (err) {
      console.error(`[store] ${store.kind} init failed (attempt ${attempt}/5): ${err.message}`);
      if (attempt >= 5) {
        console.error('[store] falling back to in-memory store');
        await store.close().catch(() => {});
        store = createMemoryStore({ table: store.table });
        break;
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  console.log(`[store] using ${store.kind} storage (table ${store.table})${store.kind === 'memory' ? ' (scores are lost on restart!)' : ''}`);

  const app = createApp({ store, rateLimitPerMin: RATE });
  const server = app.listen(PORT, '0.0.0.0', () => console.log(`[http] ${GAME.name} listening on :${PORT}`));

  const shutdown = (sig) => {
    console.log(`[http] ${sig} received, shutting down`);
    server.close(() => store.close().finally(() => process.exit(0)));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();
