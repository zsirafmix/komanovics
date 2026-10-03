# KOMÁNOVICS

Böngészős, vicces, függőleges görgetésű biciklis játék. A főszereplő **Eduárd** – a felhasználó saját
rajzfilmfigurája (a „Eduárd Tanya News” Facebook-oldalról): pocakos, bozontos vörös hajú és szakállú,
nagy piros orrú, lyukas krémszínű pulóveres, farmeres tanyasi ember, kezében zöld sörösüveggel.
Eduárd egy tanyasi földúton teker felfelé, sört gyűjt (minél részegebb, annál több pont, de annál
jobban imbolyog és annál lassabban reagál a kormány), és kerülgeti a kecskéket, kátyúkat, pocsolyákat,
tyúkcsapatokat és a szembejövő traktort.

- **Élő játék:** https://komanovics.onrender.com (Render, ingyenes csomag – az első betöltés ébredés miatt 30–60 mp is lehet)
- **Repo:** https://github.com/zsirafmix/komanovics
- **Minden játékbeli szöveg magyar.**

![Kezdőképernyő](docs/img/start.png) ![Játék](docs/img/gameplay.png)

## Fő funkciók
- Felülnézetes, lefelé görgetett tanyasi földút (kerítés, árok, fák, napraforgó, szénaboglya, tanyaház, gémeskút).
- Részeg-fizika: szinuszos + zajos imbolygás, a sprite látványosan dől; a részegséggel nő az amplitúdó és a kormány késleltetése.
- Sör (+10 × szorzó, a szorzó 1×–3× a részegség szerint), kávé (−45 részegség), savanyúság (−18).
- Akadályok: álló kecske, átfutó kecske, rohamozó kecske, kátyú (ugrat), pocsolya (csúszás), tyúkcsapat (szétrebben, lassít), szembejövő traktor, és az árok az út szélén.
- 3 élet, vicces ütközés-animációk (árokba borulás, kecske a hasán, traktor-palacsinta), utána rövid sérthetetlenség.
- 30 másodpercenként gyorsul a játék és sűrűsödnek az akadályok.
- Online toplista (top 10) a szerveren validálva (névhossz, szanitizálás, pontszám-határok, rate limit).
- Minden hang Web Audio API-val szintetizálva: csuklás, mekegés, üvegcsilingelés, nyikorgó bicikli, csattanás, harmonikás polka-zene. Némítás gomb (localStorage-ben megmarad).
- Vezérlés: nyilak / A-D, telefonon a képernyő bal/jobb felének nyomva tartása, opcionális döntés (DeviceOrientation, iOS engedélykéréssel). Szünet: P / Esc / gomb. Némítás: M.

## Gyors indítás
```bash
npm install
npm start            # http://localhost:3000  (DATABASE_URL nélkül memóriabeli toplista)
npm test             # unit + API integrációs tesztek
npm run smoke        # headless Chrome smoke teszt + képernyőképek (./screenshots)
```
Részletek: [docs/SETUP.md](docs/SETUP.md). Architektúra: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
Következő agentnek: [AGENTS.md](AGENTS.md) → „START HERE FOR NEXT AGENT”.

## Repository-struktúra
| Útvonal | Mire való |
|---|---|
| `server/index.js` | Belépési pont: tároló inicializálása (5 próbálkozás, majd memória-fallback), HTTP indítás `0.0.0.0:$PORT`-on, SIGTERM kezelés. |
| `server/app.js` | Express app: biztonsági fejlécek (CSP), `/healthz`, `GET/POST /api/scores`, statikus kiszolgálás a `public/`-ból. Tesztelhetőség miatt külön a listen-től. |
| `server/store.js` | Tároló: PostgreSQL (`pg`, tábla automatikus létrehozása) vagy memóriabeli fallback; azonos interfész. SSL-döntés (`sslConfigFor`). |
| `server/validate.js` | Pontszám-beküldés validálása, név szanitizálása (Unicode betű/szám + ` ._-!?`, max 16 karakter), hihetőségi ellenőrzés. |
| `server/rateLimit.js` | Memóriabeli, IP-nkénti fix ablakos rate limiter (alap: 5 beküldés / perc). |
| `public/index.html` | Egyetlen oldal: canvas, HUD, kezdő/szünet/game over képernyők (magyar szövegek). |
| `public/css/style.css` | Teljes UI-stílus; az `#app` álló arányú oszlop (telefonon teljes képernyő). |
| `public/js/main.js` | Bootstrap: méretezés, fő ciklus (rAF), HUD, képernyők, némítás, döntés, toplista UI. |
| `public/js/game.js` | Játékmag: állapotgép, részeg kormány, spawnolás, ütközések, ütközés-animációk, rajzolási sorrend. |
| `public/js/draw.js` | Minden procedurális grafika (háttér-csempe, díszletek, kecske, tyúk, traktor, tárgyak, Eduárd a biciklin). |
| `public/js/audio.js` | Web Audio szintetizátor: effektek + harmonikás polka lookahead ütemezővel. |
| `public/js/input.js` | Billentyűzet, érintés/egér (bal/jobb képernyőfél), DeviceOrientation. |
| `public/js/api.js` | Toplista API kliens. |
| `public/js/config.js` | Világ-geometria és játékállandók (út szélei, sebességek, szintidő). |
| `public/js/util.js` | Segédfüggvények (clamp, súlyozott véletlen, 1D zaj, ütközés). |
| `public/assets/` | `eduard-head.png` (kivágott fej, átlátszó), `eduard-head-128.png`, `favicon.png`, `eduard-full.jpg` (kezdőkép, felirat nélkül). |
| `tools/crop_head.py` | A fej kivágását előállító szkript (Pillow + numpy + scipy). |
| `tools/eduard-source.png` | Eredeti karakterkép (a felhasználó saját figurája). |
| `tools/smoke.mjs` | Headless Chrome (puppeteer-core) smoke teszt képernyőképekkel és gyorsított szimulációval. |
| `test/` | `node:test` unit (validálás) és integrációs (API) tesztek. |
| `render.yaml` | Render Blueprint (web service + ingyenes Postgres). |
| `docs/` | Részletes dokumentáció (lásd lent). |

## Dokumentáció
- [AGENTS.md](AGENTS.md) – gyors handoff, „START HERE FOR NEXT AGENT”
- [CHANGELOG.md](CHANGELOG.md) – fejlesztési történet
- [docs/HANDOFF.md](docs/HANDOFF.md) – legutóbbi munkamenet összefoglalója
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) – architektúra, Mermaid diagramok, API, adatmodell, döntések
- [docs/SETUP.md](docs/SETUP.md) – telepítés, futtatás, tesztelés, deploy
- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) – hibák és megoldások (sikertelen próbálkozásokkal)
- [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md) – ismert problémák
- [docs/ROADMAP.md](docs/ROADMAP.md) – következő feladatok

## Jogok
A karakter (Eduárd) és a forráskép a felhasználó saját alkotása és tulajdona („Eduárd Tanya News”).
A kód nem nyílt licencű (UNLICENSED) – a repó publikus, de felhasználás csak a tulajdonos engedélyével.
