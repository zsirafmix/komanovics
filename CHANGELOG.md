# Changelog – KOMÁNOVICS

Formátum: dátum (Europe/Budapest) – komponens – leírás – ok – érintett fájlok – teszt – ismert probléma.

## 2026-10-03 – 1.0.0 – első kiadás
### Hozzáadva
- **Játék (frontend):** függőleges görgetésű tanyasi földút, Eduárd biciklin (kivágott saját fej + canvas test, dőlés, pedálozás, sörösláda a csomagtartón).
  Részeg-fizika (imbolygás + késleltetett, simított kormány), sör/kávé/savanyúság, 7 akadálytípus + árok, 3 élet, három vicces ütközés-animáció,
  30 mp-enkénti gyorsulás, HUD (pont, szorzó, szívek, részegség-mérő, szint), szünet, némítás, döntés-vezérlés, magyar szövegek.
  Fájlok: `public/**`. Ok: a felhasználó által jóváhagyott terv.
- **Hang:** Web Audio szintézis – csuklás, mekegés, csilingelés+kortyolás, nyikorgás, csattanás, fröccsenés, boing, kotkodácsolás, kortyolás+sóhaj, ropogás, duda, szintlépés, szomorú harsona, harmonikás polka. Fájl: `public/js/audio.js`.
- **Szerver:** Express app, `/healthz`, `GET/POST /api/scores`, validálás + szanitizálás + hihetőségi korlát, IP rate limit, CSP és biztonsági fejlécek, Postgres-tároló memória-fallbackkel. Fájlok: `server/**`.
- **Eszközök:** `tools/crop_head.py` (fej-kivágás), `tools/smoke.mjs` (headless smoke teszt + szimuláció).
- **Tesztek:** `test/validate.test.js`, `test/api.test.js` (8/8 zöld).
- **Infrastruktúra:** `render.yaml`; Render web service `komanovics` (`srv-db0asre0tbcc73f1udf0`, free, frankfurt) – élő: https://komanovics.onrender.com.
- **Dokumentáció:** README, AGENTS, docs/* (HANDOFF, ARCHITECTURE, SETUP, TROUBLESHOOTING, KNOWN_ISSUES, ROADMAP), `.env.example`.

### Átnevezés
- A projekt munkaneve „Eduárd Tanya Tour” volt; a felhasználó kérésére még az első push előtt **KOMÁNOVICS**-ra nevezve (cím, `<title>`, kezdőképernyő, csomagnév, repó `zsirafmix/komanovics`, Render szolgáltatás `komanovics`). Régi nevű repó / Render erőforrás nem jött létre.

### Tesztelés
- `npm test`: 8/8 pass. `npm run smoke` helyben és az élő URL-en (`SUBMIT=0`): OK, 0 konzolhiba; szimuláció 9. szintig, mind a 10 entitástípus megjelent.
- Élő API: `/healthz` 200 (`storage: memory`), `POST /api/scores` „Teszt” 42 → 201 rank 1, hibás pont → 400, ismeretlen végpont → 404.

### Ismert problémák
- Nincs Postgres (free DB limit) → memóriabeli toplista (KI-1). Valódi eszközös teszt hiányzik (KI-6).
