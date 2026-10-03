# Hibaelhárítás – KOMÁNOVICS

Minden tapasztalt hiba, a kiváltó ok, a kipróbált (sikertelen is!) és a végleges megoldás.

## T1 – Render: nem jön létre az ingyenes Postgres
- **Üzenet:** `received response code 400: cannot have more than one active free tier database`
- **Mikor:** 2026-10-03 ~09:25 (Budapest), Render MCP `create_postgres` (`komanovics-db`, free, frankfurt, v18).
- **Ok:** workspace-enként 1 aktív free Postgres; az `allyoutuber` projekt már használja.
- **Kipróbált:** csak ez az egy hívás; fizetős csomagot szándékosan NEM próbáltunk (a feladat csak free-t engedett).
- **Végleges:** még nincs – a szolgáltatás memóriával fut. Lásd KNOWN_ISSUES KI-1 és SETUP 6.

## T2 – Smoke teszt: `Node is either not clickable or not an Element`
- **Mikor:** `page.click('#btn-again')` a viewport asztali méretre váltása után.
- **Ok:** a gomb a görgethető kártyán kívül/alatt volt, a puppeteer nem talált kattintható pontot.
- **Végleges:** `page.$eval('#btn-again', b => b.click())` (DOM-kattintás).

## T3 – A név-űrlap beküldés után is látszott
- **Ok:** a `#form-score { display:flex }` CSS felülírta a `hidden` attribútumot.
- **Végleges:** globális `[hidden] { display: none !important; }` a `style.css` elején.

## T4 – `pageerror: Cannot read properties of null (reading 't')`
- **Mikor:** smoke teszt, a szimuláció után `game.reset()` hívás.
- **Ok:** a `reset()` nullázta a `crash` objektumot, de az állapot `crash` maradt → a következő képkockában `updateCrash` null-on futott.
- **Végleges:** a `reset()` mindig `state = 'ready'`-re állít (a `start()` utána `play`-re vált).

## T5 – Game over alatt „befagyott” akadályok a görgetett háttéren
- **Ok:** `ready`/`over` állapotban csak a díszletek mozogtak, az entitások nem.
- **Végleges:** az `update()` ezekben az állapotokban is hívja az `updateEntities()`-t.

## T6 – A smoke képernyőképen nem látszott a játékos
- **Ok:** a tesztben `invulnT = 999` → villogó sérthetetlenség; a kép épp a „láthatatlan” fázisban készült (kétszer egymás után).
- **Végleges:** a fotó előtt `invulnT = 0` (a veszélyek messze vannak).

## T7 – A gyorsított szimuláció sosem jutott a 2. szintre
- **Ok:** véletlen kormányzással a játékos 10–20 mp-en belül az árokba borult (45 ütközés / 4 perc, max 1. szint) → traktor, rohamozó kecske, tyúkok sosem spawnoltak.
- **Kipróbált (sikertelen):** csak hosszabb szimuláció (240 s) – ugyanaz.
- **Végleges:** az első 240 s-ben sérthetetlenség, utána 60 s normál ütközéssel → 9. szint, minden típus megjelenik.

## T8 – Unit teszt elvárás hibás volt (`sanitizeName`)
- `'<script>alert(1)</script>'` → `'scriptalert1scri'` (16 karakterre vág – helyes viselkedés), és a `\n\t` nem szóközzé alakul, hanem törlődik (a karakterosztály csak szóközt enged). A tesztet javítottuk, nem a kódot.

## T9 – (agent-környezet) `pkill -f "server/index.js"` a saját shellt is megölte
- **Ok:** a minta illeszkedett a futó shell-parancs saját sorára. **Megoldás:** előbb `ps aux | grep …`, majd PID alapján `kill`.

## T10 – Render build log: „It looks like we don't have access to your repo, but we'll try to clone it anyway.”
- Publikus repónál ártalmatlan; a klónozás sikerült. Privát repóhoz a Render GitHub App hozzáférés kellene.

## T11 – A Render skill fájl nem volt a megadott helyen
- `/home/box/agent-data/plugins/render/plugins/render/skills/...` nem létezett; a tényleges hely: `/home/box/agent-data/plugins/cache/cursor-public/render/<hash>/skills/`.

## T12 – `npm audit` high sérülékenység (basic-ftp) a puppeteer-core 23 miatt
- **Végleges:** `puppeteer-core@25.12.0` → `found 0 vulnerabilities`.

## Általános tippek
- **Fekete/üres vászon:** konzolban `window.__ETT.game.state`; ha `ready`, a kezdőképernyő takarja.
- **Nincs hang:** az `AudioContext` csak gombnyomás után indul; iOS-en a némító kapcsoló is elnémítja. `window.__ETT.sound.ctx.state` → `running`?
- **429 a beküldésnél:** 5 beküldés/perc/IP limit (`SCORE_RATE_LIMIT_PER_MIN`).
- **`/healthz` 503:** a DB nem válaszol (`storage: postgres`, de `ok:false`) – Render Postgres állapot / `DATABASE_URL` ellenőrzése.
- **`storage: memory` pedig van DATABASE_URL:** induláskor 5× elbukott a DB-kapcsolat → a logban `[store] postgres init failed` sorok; a DB rendbetétele után a szolgáltatást újra kell indítani.
