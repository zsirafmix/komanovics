# Roadmap – KOMÁNOVICS

| # | Prioritás | Feladat | Függőség | Érintett fájlok | Kész, ha… |
|---|---|---|---|---|---|
| R1 | **P0** | Tartós Postgres bekötése a toplistához | Tulajdonosi döntés (KI-1 opciói) | Render env, docs | `/healthz` → `"storage":"postgres"`, és egy beküldött pont túléli a `trigger_deploy`-t |
| R2 | P1 | Valódi eszközös teszt: iPhone Safari + Android Chrome (érintés, döntés-engedély, hang, álló tájolás, teljesítmény ≥ 50 FPS) | – | `public/js/input.js`, `audio.js`, `style.css` | Mindhárom vezérlés működik, nincs görgetés/zoom, a hang szól; eredmény a CHANGELOG-ban |
| R3 | P1 | iOS hang-feloldás: az első `touchend`-re is `sound.ensure()` (nem csak gombnyomásra), és figyelmeztetés, ha a némító kapcsoló miatt nincs hang | R2 | `public/js/main.js` | iOS-en az első érintés után megszólal a zene |
| R4 | P2 | Fej-kivágás finomítása: krém maradvány eltüntetése (ovális `ry` 205→198 vagy szaturáció-küszöb 0.30→0.34), újragenerálás | – | `tools/crop_head.py`, `public/assets/*` | `/tmp/head_preview.png`-n nincs krémszínű folt a szakáll mellett |
| R5 | P2 | Erősebb csalásvédelem: `POST /api/session` ad egy HMAC-aláírt tokent (start idő), a beküldés ezt igényli, a szerver a tényleges eltelt időből számolja a hihetőségi korlátot | – | `server/app.js`, `server/validate.js`, `public/js/api.js`, `main.js`, új `SESSION_SECRET` env | Token nélküli vagy hamis idejű beküldés 400-at kap; tesztek frissítve |
| R6 | P3 | Napi/heti toplista fül (`?period=day|week`) | R1 | `server/store.js`, `app.js`, `index.html`, `main.js` | A GET paraméterrel szűr, UI-ban váltható |
| R7 | P3 | Admin törlés végpont (`DELETE /api/scores/:id`, `ADMIN_TOKEN` env-vel) a próbabejegyzések eltávolításához | R1 | `server/app.js`, `store.js` | Tokennel 204, nélküle 401 |
| R8 | P3 | PWA (manifest + service worker offline játékhoz, toplista nélkül) | – | `public/manifest.webmanifest`, `public/sw.js` | Lighthouse „installable” |
| R9 | P3 | Hangerő-csúszka zene/effekt külön | – | `audio.js`, `index.html` | Beállítás localStorage-ben megmarad |
