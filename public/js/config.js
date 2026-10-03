// Világ-koordináták (logikai egységek). A vászon szélessége mindig W logikai egység,
// a magasság a képarányból adódik (Game.resize). Minden rajzolás és ütközés ezekben az egységekben megy.
export const W = 400;
export const FENCE_L = 40;
export const FENCE_R = W - 40;
export const DITCH_L = 46; // ennél kijjebb (a középpontja) = árokba borulás
export const DITCH_R = W - 46;
export const SHOULDER_L = 62; // füves útpadka: lassít
export const SHOULDER_R = W - 62;
export const ROAD_L = 90; // földút széle
export const ROAD_R = W - 90;
export const ROAD_C = W / 2;
export const TILE_H = 512; // a háttér-csempe magassága (ismétlődik görgetéskor)

export const PLAYER_SCALE = 1.05;
export const GOAT_SCALE = 1.2;
export const PLAYER_R = 17; // ütközési sugár
export const LEVEL_SECONDS = 30; // ennyi másodpercenként nő a sebesség és a sűrűség
export const BASE_SPEED = 165; // logikai px / s
export const SPEED_GROWTH = 1.11; // szintenkénti szorzó
export const MAX_SPEED = 440;
export const STEER_SPEED = 245;
export const LIVES = 3;
