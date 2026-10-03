# Ismert problémák – KOMÁNOVICS

| ID | Súlyosság | Komponens | Leírás |
|---|---|---|---|
| KI-1 | **Magas** | tárolás / Render | Nincs Postgres: a toplista memóriában van, újraindításkor (deploy, elalvás utáni ébredés) **törlődik** |
| KI-2 | Közepes | Render free web | A szolgáltatás 15 perc tétlenség után elalszik; az első kérés 30–60 mp |
| KI-3 | Közepes | Render free Postgres | Az ingyenes Postgres a létrehozás után 30 nappal lejár (ha majd létrejön) |
| KI-4 | Közepes | API / anti-cheat | A pontszámot a kliens számolja; a szerver csak hihetőségi korlátot alkalmaz |
| KI-5 | Alacsony | rate limit | Memóriabeli, egy példányra érvényes, újraindításkor nullázódik |
| KI-6 | Közepes | kliens | Valódi telefonon (iOS/Android) még nincs kézzel tesztelve |
| KI-7 | Alacsony | grafika | A fej szemből néz, a test hátulnézetből látszik (szándékos rajzfilmes kompromisszum) |
| KI-8 | Alacsony | élő adat | A „Teszt” (42 pont) próbabejegyzés az élő memória-toplistán van, a következő újraindításig |
| KI-9 | Alacsony | infrastruktúra | A `render.yaml` nincs Blueprintként szinkronizálva; a futó szolgáltatás MCP-vel készült |
| KI-10 | Alacsony | grafika | A fej-kivágás bal alsó/jobb szélén pár pixelnyi krémszínű pulóver-maradvány látszik |
| KI-11 | Alacsony | build | `npm install` Renderen a dev függőséget (puppeteer-core, böngésző nélkül) is telepíti |

## KI-1 – Nincs Postgres, memóriabeli toplista
- **Reprodukció:** `curl https://komanovics.onrender.com/healthz` → `"storage":"memory"`. Render MCP `create_postgres` (free) → `400 cannot have more than one active free tier database`.
- **Ok:** Render workspace-enként egy aktív ingyenes Postgres engedélyezett; a My Workspace-ben már van egy: `allyoutuber` (`dpg-datts00u01pc73ah2800-a`, virginia, lejár 2026-10-29).
- **Hatás:** a toplista minden újraindításkor (deploy, ~15 perc tétlenség utáni elalvás) kiürül.
- **Ideiglenes workaround:** nincs; a játék és a beküldés működik, csak nem tartós.
- **Lehetséges végleges megoldások (tulajdonosi döntés kell):**
  1. Megvárni, míg az `allyoutuber` ingyenes DB lejár / a tulajdonos törli, aztán létrehozni a `komanovics-db`-t (lásd SETUP 6.).
  2. Fizetős Render Postgres (`basic_256mb`) – csak kifejezett engedéllyel.
  3. Külső ingyenes Postgres (pl. Neon, Supabase): a `DATABASE_URL`-t beállítani; külső hostnál `DATABASE_SSL=true` kellhet.
  4. Az `allyoutuber` DB-ben egy külön `scores` tábla – NEM ajánlott (más projekt, másik régió, a tulajdonos engedélye kell).

## KI-2 – Elalvó free web service
- Workaround: türelem az első betöltésnél; a kezdőképernyő „Betöltés…” üzenetet mutat a toplistán.
- Végleges: fizetős instance, vagy külső „ébresztő” ping (de az ingyenes órakeret fogy).

## KI-3 – Lejáró free Postgres
- 30 nap után a Render törli/felfüggeszti; előtte exportálni kell (`pg_dump`) vagy fizetősre váltani.

## KI-4 – Gyenge csalásvédelem
- Bárki küldhet `POST /api/scores`-t a korlátokon belül (max 300 + 80 × másodperc pont, 5/perc/IP).
- Lehetséges javítás: szerver által kiadott játék-token (start időbélyeg + HMAC), eseménynapló-visszajátszás – lásd ROADMAP R5.

## KI-6 – Valódi eszközös teszt hiányzik
- Headless Chrome mobil-emulációban tesztelve (érintés-szimuláció nélkül, billentyűvel kormányozva).
- Kockázatok: iOS Safari `DeviceOrientationEvent.requestPermission` (csak HTTPS-en és gesztusból működik – így van implementálva), iOS némító kapcsoló elnémítja a Web Audio-t, `100dvh` régebbi böngészőkön.

## KI-10 – Kivágási maradvány
- `tools/crop_head.py` ovális maszkja (`cx, cy, rx, ry = 292, 222, 192, 205`) kissé szűkíthető alul-oldalt, vagy a szaturáció küszöbe (0.30) emelhető.
