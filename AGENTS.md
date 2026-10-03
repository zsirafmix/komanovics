# AGENTS.md – KOMÁNOVICS

## START HERE FOR NEXT AGENT
1. Olvasd el ezt a fájlt, majd `docs/HANDOFF.md` „Next exact step” részét.
2. Állapot ellenőrzése: `curl https://komanovics.onrender.com/healthz` (ha `"storage":"memory"`, a tartós DB még nincs bekötve – ez a nyitott P0 feladat, ROADMAP R1).
3. Helyben: `npm install && npm test && npm run smoke` (Chrome kell: `/usr/bin/google-chrome` vagy `CHROME_PATH`).
4. A következő feladat: **R1 – tartós Postgres** (tulajdonosi döntés kell, lásd KNOWN_ISSUES KI-1), utána **R2 – valódi eszközös teszt**.
5. Minden változás után frissítsd: CHANGELOG, docs/HANDOFF, ennek a fájlnak a CURRENT STATUS / LAST COMPLETED / NEXT TASK részét (a felhasználó szabálya).

## PROJECT GOAL
Vicces, mobilbarát böngészős játék „KOMÁNOVICS” néven: a felhasználó saját karaktere, **Eduárd** (Eduárd Tanya News) biciklivel teker egy tanyasi földúton,
sört gyűjt (több pont, de részegebb → imbolyog, késik a kormány), kerüli a kecskéket, traktort, kátyút, pocsolyát, tyúkokat. Online top 10 toplista.
Minden játékbeli szöveg magyar. Csak ingyenes Render erőforrások. Build-lépés nélküli frontend, Node 20 + express + pg backend.

## CURRENT STATUS
- ✅ Teljes játék kész és élő: https://komanovics.onrender.com (Render `srv-db0asre0tbcc73f1udf0`, free, frankfurt, branch `main`; pushra NEM deployol automatikusan – KI-12).
- ✅ API (`/healthz`, `GET/POST /api/scores`) működik, validálással és rate limittel. A `/healthz` a játék nevét és a táblát is mutatja (`table: komanovics_scores`).
- ⚠️ Toplista **memóriában** (nincs `DATABASE_URL`): a free Postgres nem jött létre (workspace-limit). Újraindításkor törlődik.
- ⚠️ Valódi telefonon nem tesztelt (csak headless Chrome mobil-emulációban).

## LAST COMPLETED TASK
2026-10-03: 1.1.0 – játék-specifikus `komanovics_scores` tábla (a régi `scores` helyett) a közös Kománovics-adatbázishoz; `SCORES_TABLE` env, `server/gameConfig.js`, táblanév-validálás, tesztek. (Előtte: 1.0.0 első kiadás.)

## CURRENT TASK
Nincs folyamatban lévő munka. Várakozás a tulajdonos döntésére a tartós DB-ről.

## NEXT TASK
ROADMAP R1 (a KÖZÖS Kománovics Postgres bekötése – ugyanaz a `DATABASE_URL`, mint a `komanovics-darts`-nál, lásd SETUP 6.), majd R2 (iOS/Android kézi teszt), R3 (iOS hang-feloldás).

## IMPORTANT FILES
- `public/js/game.js` – a játék magja (állapotgép, részeg-fizika, spawn, ütközés, animációk). Legtöbb gameplay-hangolás itt + `config.js`.
- `public/js/draw.js` – minden grafika. `drawPlayer` = Eduárd.
- `public/js/audio.js` – hangok és zene.
- `public/js/main.js` – UI, HUD, képernyők, toplista.
- `server/app.js`, `server/store.js`, `server/validate.js`, `server/gameConfig.js` – backend (a `gameConfig.js`-ben a játék neve, táblája, validálási határai).
- `tools/smoke.mjs` – a legjobb regressziós teszt (futtasd minden frontend-változás után, és nézd meg a képeket).
- `render.yaml`, `.env.example`, `docs/SETUP.md` (Render ID-k).

## ARCHITECTURE SUMMARY
Egy Express folyamat: statikus `public/` + JSON API. Frontend: ES modulok, canvas 400 logikai egység széles, magasság a képarányból;
rAF ciklus → `Game.update(dt)` → `Game.draw(ctx)`; DOM HUD. Tárolás: `pg` Pool (`komanovics_scores` tábla a közös Kománovics-adatbázisban, induláskor létrehozva; `SCORES_TABLE`-lel felülírható) vagy memória.
Részletek és Mermaid diagramok: `docs/ARCHITECTURE.md`.

## HOW TO BUILD
Nincs build. `npm install` (Renderen is ez a build parancs).

## HOW TO RUN
`npm start` → http://localhost:3000 (opcionálisan `DATABASE_URL=...`). Renderen `npm start`, port a `$PORT`-ból.

## HOW TO TEST
`npm test` (node:test), `npm run smoke` (headless Chrome, képek `./screenshots`-ba), élő: `BASE_URL=https://komanovics.onrender.com SUBMIT=0 npm run smoke`.

## KNOWN ISSUES
Lásd `docs/KNOWN_ISSUES.md`. Legfontosabb: KI-1 memóriabeli toplista; KI-2 elalvó free service; KI-4 gyenge csalásvédelem; KI-6 nincs valódi eszközös teszt.

## IMPORTANT TECHNICAL DECISIONS
- Build nélküli Canvas + ES modulok (kérés + egyszerűség). Ezért a JS/CSS `Cache-Control: no-cache`.
- Eduárd feje a felhasználó saját képéből kivágott PNG (`tools/crop_head.py`, HSV szegmentálás), a test canvas-rajz.
- Részeg kormány = késleltetett puffer + aluláteresztő + szinusz/zaj imbolygás (paraméterek: `game.js` `updatePlayer`).
- Minden hang Web Audio szintézis, nincs hangfájl.
- Postgres memória-fallbackkel; saját rate limiter (nincs extra csomag).
- Render szolgáltatás MCP-vel közvetlenül létrehozva (nem Blueprint-szinkron); a `render.yaml` referencia.

## DO NOT CHANGE / CAUTION AREAS
- **Soha ne commitolj `DATABASE_URL`-t vagy más titkot.** Csak Render env-ben (MCP `update_environment_variables`).
- **Csak ingyenes Render csomag** – fizetős erőforrás csak a tulajdonos kifejezett engedélyével.
- Ne töröld/ne írd át az `allyoutuber` vagy más projekt Render erőforrásait.
- `app.set('trust proxy', 1)` – nélküle a rate limit mindenkit egy IP-ként kezelne Renderen.
- CSP `script-src 'self'`: inline `<script>` nem fog futni – minden JS külön fájlban.
- `window.__ETT` hook – a smoke teszt használja, ne töröld.
- **Push után deployt kézzel kell indítani** (Render MCP `trigger_deploy`, `srv-db0asre0tbcc73f1udf0`) – az auto-deploy webhook nem működik (KI-12).
- A háttér-csempe periodikus elemeinek periódusa osztója legyen `TILE_H`-nak (512), különben varrat látszik.
- A karakter (Eduárd) és a forráskép a felhasználó tulajdona; a játék neve KOMÁNOVICS.

## FAILED APPROACHES
- Render free Postgres létrehozása → 400 „cannot have more than one active free tier database” (T1).
- Véletlen kormányzású szimuláció sérthetetlenség nélkül → sosem jut 2. szintre (T7).
- `page.click` viewport-váltás után → nem kattintható (T2).
- `pkill -f` a parancssor mintájával → megölte a saját shellt (T9).
Részletek: `docs/TROUBLESHOOTING.md`.

## OPEN QUESTIONS
- Melyik tartós DB-megoldást választja a tulajdonos (KI-1 opciók)?
- Megadja-e a tulajdonos a Render GitHub App hozzáférést a repóhoz (KI-12), hogy működjön az auto-deploy?
- Kell-e licenc (jelenleg UNLICENSED, a karakter a tulajdonosé)?
