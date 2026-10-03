// A játék-specifikus szerver-beállítások egy helyen (a KOMÁNOVICS Darts-szal közös szerver-sablon része).
export const GAME = {
  name: 'KOMÁNOVICS',
  // Saját tábla a KÖZÖS Kománovics-adatbázisban (felülírható a SCORES_TABLE env-vel).
  // Korábban (1.0.x) a tábla neve "scores" volt; adatbázis sosem volt bekötve, így migráció nem kellett.
  defaultTable: 'komanovics_scores',
  limits: {
    scoreMax: 1_000_000,
    levelMax: 999,
    durationMaxSec: 6 * 60 * 60, // 6 óra
    // Elméleti maximum pont / másodperc (sör 10 × max 3× szorzó × sűrű spawn + távolságpont),
    // bőséges ráhagyással. Csak durva csalás-szűrő, nem valódi anti-cheat.
    maxPointsPerSec: 80,
    baseAllowance: 300,
    requireDuration: false,
  },
};
