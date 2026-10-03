# Telepítés, futtatás, tesztelés, deploy – KOMÁNOVICS

## 1. Környezet (amin fejlesztve és tesztelve lett, 2026-10-03)
| Elem | Verzió |
|---|---|
| OS | Debian GNU/Linux 13 (trixie), x86_64 |
| Node.js | 20.19.2 (helyben); Renderen 20.20.2 (`NODE_VERSION=20`) – minimum: 20 (`engines`, `.nvmrc`) |
| npm | 9.2.0 |
| express / pg | 4.22.3 / 8.23.1 (`package-lock.json` rögzíti) |
| puppeteer-core (dev) | 25.12.0 |
| Google Chrome (smoke teszthez) | 151.0.7922.169 (`/usr/bin/google-chrome`) |
| Python (csak a fej-kivágó eszközhöz) | 3.13.5 + Pillow 12.3.0, numpy 2.5.3, scipy 1.18.1 |

Build-lépés **nincs**: a `public/` mappa közvetlenül kiszolgált statikus fájlokból áll.

## 2. Telepítés és futtatás helyben
```bash
git clone https://github.com/zsirafmix/komanovics.git
cd komanovics
npm install
npm start                 # http://localhost:3000
# fejlesztés automatikus újraindítással (csak szerverkód változásnál kell):
npm run dev
```
DATABASE_URL nélkül a toplista **memóriában** van (a log: `[store] using memory storage`).

### PostgreSQL-lel helyben
```bash
# pl. Dockerrel:
docker run --rm -d --name komanovics-pg -e POSTGRES_PASSWORD=pw -p 5432:5432 postgres:18
export DATABASE_URL=postgresql://postgres:pw@localhost:5432/postgres
npm start                 # a "scores" tábla automatikusan létrejön
```

## 3. Környezeti változók (lásd `.env.example`)
| Változó | Kötelező | Leírás |
|---|---|---|
| `PORT` | nem (alap 3000) | Renderen a platform adja (10000) |
| `DATABASE_URL` | nem | Postgres kapcsolati string. Hiányában memória-fallback. **Soha ne commitold.** |
| `DATABASE_SSL` | nem | `true` / `false` / üres = automatikus (`*.render.com` host → SSL) |
| `SCORE_RATE_LIMIT_PER_MIN` | nem (alap 5) | IP-nkénti beküldési limit percenként |
| `NODE_VERSION` | csak Renderen | `20` |

A szerver nem tölt be `.env`-et automatikusan: `set -a; . ./.env; set +a; npm start`.

## 4. Tesztek
```bash
npm test          # node:test – test/validate.test.js (unit) + test/api.test.js (integráció, memória-tároló, véletlen port)
npm run smoke     # headless Chrome smoke teszt (tools/smoke.mjs)
CHROME_PATH=/usr/bin/chromium npm run smoke          # más böngésző-útvonal
SCREENSHOT_DIR=/tmp/shots npm run smoke              # képernyőképek helye (alap: ./screenshots, gitignore-olva)
BASE_URL=https://komanovics.onrender.com SUBMIT=0 npm run smoke   # élő oldal, beküldés nélkül
```
A smoke teszt: szervert indít memóriával (ha nincs `BASE_URL`), 390×844-es mobilnézetben megnyitja a játékot,
~9 mp-ig kormányoz, mesterséges jelenetet állít össze minden tárgy/akadály típussal, kecske- és traktor-ütközést
vált ki, game over után nevet küld be, majd **gyorsított szimulációt** futtat (~5 perc játékidő, 18 000 update + draw),
amely ellenőrzi, hogy minden entitástípus megjelent, és nincs futásidejű hiba. Végül 1366×768-as asztali képet készít.
Bukik, ha volt konzolhiba, `pageerror`, sikertelen kérés, vagy nem sikerült a beküldés.

Elvárt kimenet: `[smoke] OK – screenshots in …`; képek: `01-start`, `02-gameplay`, `02b-player-zoom`, `03-crash-goat`, `04-crash-tractor`, `05-gameover`, `06-desktop`.

Kézi teszt (még hiányzik valódi eszközön, lásd KNOWN_ISSUES): iPhone Safari (döntés-engedély, hang a némító kapcsolóval), Android Chrome, érintéses kormányzás.

## 5. A fej-kivágás újragenerálása
```bash
python3 -m venv .venv && .venv/bin/pip install pillow numpy scipy
.venv/bin/python tools/crop_head.py    # a repo gyökeréből futtasd
```
Kimenet: `public/assets/eduard-head.png`, `eduard-head-128.png`, `favicon.png`, `eduard-full.jpg`, valamint ellenőrző kép: `/tmp/head_preview.png`.

## 6. Deploy (Render)
### Jelenlegi éles állapot
| Erőforrás | Név | ID | Megjegyzés |
|---|---|---|---|
| Workspace | My Workspace | `tea-dabfoslcqm1c73dfirs0` | |
| Web service | `komanovics` | `srv-db0asre0tbcc73f1udf0` | free, frankfurt, node, branch `main`, auto-deploy commitra, https://komanovics.onrender.com |
| Postgres | `komanovics-db` | **nem jött létre** | „cannot have more than one active free tier database” – lásd KNOWN_ISSUES KI-1 |

Build: `npm install`, start: `npm start`. Env: `NODE_VERSION=20`, `SCORE_RATE_LIMIT_PER_MIN=5`. **`DATABASE_URL` nincs beállítva → memória-tároló.**

Új deploy: elég pusholni a `main`-re (auto-deploy). Kézi újradeploy: Render MCP `trigger_deploy` vagy Dashboard → Manual Deploy.

### Postgres bekötése később (ha felszabadul az ingyenes slot vagy fizetős DB-t engedélyez a tulajdonos)
1. Render MCP `create_postgres` (`name: komanovics-db`, `plan: free`, `region: frankfurt`) vagy Dashboard → New → Postgres.
2. Várd meg, míg `available`, majd a Dashboardon (Connections → **Internal Database URL**) másold ki a belső URL-t.
3. Render MCP `update_environment_variables` (`serviceId: srv-db0asre0tbcc73f1udf0`, `DATABASE_URL=<internal url>`) – ez újradeployt indít.
4. Ellenőrzés: `curl https://komanovics.onrender.com/healthz` → `"storage":"postgres"`.
A DB és a web service ugyanabban a régióban legyen (frankfurt), különben a belső URL nem működik.

### Blueprint (alternatíva)
`render.yaml` leírja ugyanezt (web + free Postgres, `fromDatabase` bekötéssel). Dashboard → New → Blueprint → repo.
Figyelem: amíg a workspace-ben van másik aktív ingyenes Postgres, a Blueprint szinkron a DB-nél el fog bukni,
és a jelenlegi (MCP-vel létrehozott) `komanovics` szolgáltatással névütközés lehet – előtte egyeztess a tulajdonossal.

## 7. Debug
- Szerver log: Render MCP `list_logs` (`resource: srv-db0asre0tbcc73f1udf0`) vagy Dashboard → Logs.
- Böngészőben a konzolon `window.__ETT.game` elérhető (állapot, entitások, `startCrash('goat')`, `drunk = 100` stb.).
- Hang hibakereséshez: `window.__ETT.sound.ctx.state` (`running` kell legyen gombnyomás után).
