# Handoff – KOMÁNOVICS

## Date
2026-10-03 (Europe/Budapest), kb. 10:10–10:20 – 1.1.0 (játék-specifikus tábla)

## Goal of this session
A toplista táblájának átnevezése játék-specifikusra (`komanovics_scores`), hogy a Kománovics-játékok
(KOMÁNOVICS + az új KOMÁNOVICS Darts → `darts_scores`) később egyetlen Postgres adatbázison osztozhassanak.

## What was changed
- `server/store.js`: konfigurálható, validált táblanév (`SCORES_TABLE` vagy a játék alapértelmezése), táblanév-előtagos index.
- Új `server/gameConfig.js` (név `KOMÁNOVICS`, tábla `komanovics_scores`, a régi validálási határok változatlanul).
- `server/validate.js`: `validateScore(body, limits)`; `server/app.js`: `/healthz` → `game`, `table`; `server/index.js`: tábla a logban.
- Tesztek, `.env.example`, `render.yaml`, README, ARCHITECTURE (adatmodell + közös DB), SETUP, KNOWN_ISSUES, ROADMAP, AGENTS, CHANGELOG.

## Files modified
`server/{app,index,store,validate}.js`, `server/gameConfig.js` (új), `test/{validate,api}.test.js`, `.env.example`, `render.yaml`,
`README.md`, `AGENTS.md`, `CHANGELOG.md`, `docs/{ARCHITECTURE,SETUP,KNOWN_ISSUES,ROADMAP,HANDOFF}.md`.

## What currently works
Minden, ami 1.0.0-ban; a frontend nem változott. A `/healthz` most `{"ok":true,"game":"KOMÁNOVICS","storage":"memory","table":"komanovics_scores",…}`.

## What does not work
Továbbra sincs adatbázis (KI-1) – a memóriabeli toplista újraindításkor törlődik.

## Tests performed / results
- `npm test`: 9/9 zöld (új teszt: táblanév-alapértelmezés, `SCORES_TABLE` felülírás, veszélyes nevek elutasítása; healthz `table`).
- Élő: deploy `dep-db0bgq60tbcc73f4b910` (commit `412cbd1`) után `/healthz` → `{"ok":true,"game":"KOMÁNOVICS","storage":"memory","table":"komanovics_scores"}` (2026-10-03 10:12 CEST). A memóriabeli toplista a deploy miatt kiürült.

## Important discoveries
Migráció nem kellett (DB sosem volt). A régi `scores` név túl általános lett volna egy közös adatbázisban.

## Failed attempts
Nincs.

## Known risks
Ha valaki mégis egy régi `scores` táblás adatbázist kötne be, az adatok nem látszanának – akkor `SCORES_TABLE=scores` vagy `ALTER TABLE scores RENAME TO komanovics_scores` kell.

## Next exact step
Közös Postgres bekötése (ROADMAP R1): ugyanaz a `DATABASE_URL` a `komanovics` és a `komanovics-darts` szolgáltatásra, majd `trigger_deploy` és `/healthz` ellenőrzés.

---

# Előző munkamenet (1.0.0)

## Date
2026-10-03 (Europe/Budapest), kb. 09:00–09:45

## Goal of this session
A jóváhagyott terv szerinti teljes játék megépítése (Eduárd biciklis vertikális scroller, magyar szövegekkel),
online toplista szerverrel, dokumentálás, GitHub push és Render deploy (csak ingyenes csomagok).
Menet közben a felhasználó átnevezte a játékot „Eduárd Tanya Tour”-ról **KOMÁNOVICS**-ra (a karakter továbbra is Eduárd).

## What was changed
- Új repó: https://github.com/zsirafmix/komanovics (publikus, `main`).
- Teljes frontend (`public/`), szerver (`server/`), tesztek (`test/`), eszközök (`tools/`), `render.yaml`, minden kötelező dokumentum.
- Render: web service `komanovics` létrehozva és élesítve.

## Files modified
Minden fájl új – lásd README „Repository-struktúra”.

## What currently works
- Élő játék: https://komanovics.onrender.com – kezdőképernyő (teljes Eduárd-kép), játék, HUD, ütközések, game over, név beküldése, top 10.
- Minden tervezett mechanika: imbolygás + késleltetett kormány, sör szorzóval, kávé/savanyúság, álló/átfutó/rohamozó kecske, kátyú-ugrás, pocsolya-csúszás, tyúkcsapat-lassítás, traktor, árok, 3 élet + animációk + sérthetetlenség, 30 mp-es szintek.
- Szintetizált hangok + polka-zene, némítás (localStorage), szünet (P/Esc/gomb, tab-váltáskor automatikus), billentyű/érintés/döntés vezérlés.
- API: `/healthz`, `GET/POST /api/scores` validálással, rate limittel.

## What does not work
- **Tartós tárolás nincs:** a Render ingyenes Postgres nem hozható létre (már van egy aktív free DB a workspace-ben: `allyoutuber`). A toplista memóriában van, újraindításkor törlődik. `DATABASE_URL` nincs beállítva.

## Tests performed
1. `npm test` (unit + API integráció).
2. `npm run smoke` helyben (memória-tároló) – képek: `/workspace/komanovics-shots/` (a box gépen).
3. `BASE_URL=https://komanovics.onrender.com SUBMIT=0 npm run smoke` – képek: `/workspace/komanovics-shots/live/`.
4. Élő `curl`: `/healthz`, `GET /api/scores`, `POST /api/scores` (Teszt, 42), hibás pontszám, ismeretlen végpont, CSP fejléc.
5. Render build/app logok átnézése (MCP `list_logs`).

## Test results
- 8/8 unit/API teszt zöld. Smoke helyben és élőben: OK, 0 konzol-/oldalhiba; szimuláció 9. szintig, mind a 10 entitástípus.
- Élő: `/healthz` → `{"ok":true,"storage":"memory"}`; POST → 201, rank 1; hibás → 400; 404 JSON.
- Render: build 1 s (`npm install`, 0 vulnerabilities), Node 20.20.2, „Your service is live”, `KOMÁNOVICS listening on :10000`.

## Important discoveries
- Render workspace-enként **csak 1 aktív ingyenes Postgres** lehet.
- A Render MCP `query_render_postgres` csak olvasó tranzakcióban fut → SQL-lel törölni nem lehet vele.
- Pushra nem indul auto-deploy (nincs Render GitHub App hozzáférés) → kézi `trigger_deploy` kell (KI-12).
- A dokumentációs commit utáni kézi újradeploy kiürítette a memória-toplistát, így a „Teszt” próbabejegyzés törlődött (ellenőrizve `GET /api/scores`-szal).
- A Render MCP `create_web_service` nem kezel `healthCheckPath`-ot; a `render.yaml`-ban benne van, a futó szolgáltatáson nincs beállítva.

## Failed attempts
- `create_postgres` (free, frankfurt) → 400 (T1). Részletek és egyéb hibák: docs/TROUBLESHOOTING.md (T1–T12).

## Known risks
- Elalváskor/deploykor elvesző toplista; free web service hidegindulás; kliens-oldali pontszám (gyenge anti-cheat); valódi telefonon nem tesztelt.

## Next exact step
1. Kérdezd meg a tulajdonost, melyik opció legyen a tartós DB-re (KNOWN_ISSUES KI-1: várni/törölni az `allyoutuber` free DB-t, fizetős `basic_256mb`, vagy külső Neon/Supabase).
2. Ha van DB: Render MCP `update_environment_variables` → `serviceId: srv-db0asre0tbcc73f1udf0`, `DATABASE_URL=<internal url>`; utána `curl https://komanovics.onrender.com/healthz` → `"storage":"postgres"`; frissítsd SETUP 6., KNOWN_ISSUES KI-1, AGENTS, CHANGELOG.
3. Utána ROADMAP R2 (valódi eszközös teszt).
