// A játék magja: állapotgép, fizika (részeg imbolygás, késleltetett kormány), spawnolás,
// ütközések, ütközés-animációk és a teljes képkocka kirajzolása.
//
// Koordináta-rendszer: x 0..W (W=400), y 0..H (H a képarányból). A "világ" nem mozog: minden
// entitás y-ját a görgetési sebességgel (scroll) toljuk lefelé, így a játékos y-ja állandó.
import * as C from './config.js';
import { clamp, lerp, rand, randInt, pick, weighted, noise1, circleRect, easeOutCubic, TAU } from './util.js';
import * as D from './draw.js';

const CRASH_LINES = {
  ditch: ['Hoppá, az árok!', 'Árokparti pihenő!', 'Ez nem a bicikliút!', 'Csak a fűben ülök...'],
  goat: ['MEKK! Felöklelt!', 'Kecske 1 – Eduárd 0', 'Ez a kecske nem viccel!', 'Jaj, a szarva!'],
  tractor: ['Palacsinta lett belőlem!', 'Ez a traktor nem volt ott!', 'Ki vezet itt részegen?!', 'Lapos lettem...'],
};

const PICKUP_TYPES = new Set(['beer', 'coffee', 'pickle']);

export class Game {
  /**
   * @param {{sound: import('./audio.js').Sound, input: import('./input.js').Input, head: HTMLImageElement,
   *          onGameOver: (r:{score:number, level:number, durationSec:number}) => void,
   *          onBanner: (text:string) => void}} deps
   */
  constructor(deps) {
    Object.assign(this, deps);
    this.H = 700;
    this.state = 'ready'; // 'ready' | 'play' | 'crash' | 'over'
    this.paused = false;
    this.tile = null;
    this.reset();
  }

  /** Új játék kezdőállapota. A díszleteket előre feltöltjük, hogy ne üres képpel induljon. */
  reset() {
    this.state = 'ready';
    this.paused = false;
    this.time = 0;
    this.anim = 0; // valós animációs idő (menüben is fut)
    this.level = 1;
    this.levelTimer = 0;
    this.lives = C.LIVES;
    this.itemScore = 0;
    this.distScore = 0;
    this.drunk = 0;
    this.dist = 0;
    this.scroll = C.BASE_SPEED;
    this.speedFactor = 1;
    this.entities = [];
    this.scenery = [];
    this.particles = [];
    this.floaters = [];
    this.spawnAcc = 0;
    this.nextGap = 140;
    this.sceneryAcc = [0, 0];
    this.sceneryGap = [60, 90];
    this.shake = 0;
    this.crash = null;
    this.inputHist = [];
    this.hiccupTimer = rand(5, 9);
    this.stats = { beers: 0, coffees: 0, pickles: 0 };
    const p = (this.player = {
      x: C.ROAD_C,
      bx: C.ROAD_C,
      y: this.H - 150,
      steer: 0,
      tilt: 0,
      pedal: 0,
      air: 0,
      jumpT: 0,
      jumpDur: 0.55,
      slideT: 0,
      slideV: 0,
      slowT: 0,
      invulnT: 0,
      drinkT: 0,
      jv: 0,
      swayPhase: 0,
      prevX: C.ROAD_C,
      lastHalf: 0,
      onShoulder: false,
    });
    p.y = this.playerY();
    for (let y = -60; y < this.H + 80; y += 70) {
      this.spawnScenery(0, y);
      this.spawnScenery(1, y + 35);
    }
  }

  playerY() {
    return this.H - Math.min(170, this.H * 0.24);
  }

  /** Vászon-méret változás: logikai magasság + háttércsempe újrarenderelése a pixelsűrűséghez. */
  resize(H, pixelScale) {
    this.H = H;
    this.player.y = this.playerY();
    if (!this.tile || this.tileScale !== pixelScale) {
      this.tile = D.buildBackgroundTile(pixelScale);
      this.tileScale = pixelScale;
    }
  }

  start() {
    this.reset();
    this.state = 'play';
    this.onBanner('Indulás! Gyűjtsd a sört, kerüld a kecskéket!');
  }

  get score() {
    return Math.floor(this.itemScore + this.distScore);
  }
  get multiplier() {
    return 1 + this.drunk / 50; // 1x..3x
  }
  get baseSpeed() {
    return Math.min(C.MAX_SPEED, C.BASE_SPEED * Math.pow(C.SPEED_GROWTH, this.level - 1));
  }

  // ================================================================= UPDATE
  update(dt) {
    this.anim += dt;
    if (this.paused) return;
    if (this.state === 'ready' || this.state === 'over') {
      // menü/game over alatt lassú "demó" görgetés a háttérben
      this.scroll = lerp(this.scroll, 60, 1 - Math.exp(-dt * 2));
      this.dist += this.scroll * dt;
      this.updateEntities(dt);
      this.updateScenery(dt);
      this.updateParticles(dt);
      return;
    }
    const p = this.player;
    if (this.state === 'play') {
      this.time += dt;
      this.levelTimer += dt;
      if (this.levelTimer >= C.LEVEL_SECONDS) {
        this.levelTimer -= C.LEVEL_SECONDS;
        this.level++;
        this.sound.levelUp();
        this.onBanner(`Gyorsulás! ${this.level}. szint`);
      }
      // sebesség: alap * lassító hatások (tyúkok, padka)
      let target = 1;
      if (p.slowT > 0) target *= 0.5;
      if (p.onShoulder) target *= 0.78;
      this.speedFactor = lerp(this.speedFactor, target, 1 - Math.exp(-dt * 5));
      this.scroll = this.baseSpeed * this.speedFactor;
      // távolságpont: ~1 pont / 45 egység
      this.distScore += (this.scroll * dt) / 45;
      // a részegség magától is lassan csökken
      this.drunk = Math.max(0, this.drunk - dt * 1.4);
      this.updatePlayer(dt);
    } else if (this.state === 'crash') {
      this.scroll *= Math.exp(-dt * 4);
      this.updateCrash(dt);
    }
    this.dist += this.scroll * dt;

    this.updateSpawning(dt);
    this.updateEntities(dt);
    this.updateScenery(dt);
    if (this.state === 'play') this.checkCollisions();
    this.updateParticles(dt);
    this.shake = Math.max(0, this.shake - dt * 30);
  }

  /**
   * Részeg kormányzás:
   *  1) a nyers bemenetet késleltetjük (delay = részegség * 0.28 s), egy idő-bélyeges pufferből,
   *  2) majd elsőrendű aluláteresztővel simítjuk (tau nő a részegséggel) -> "lusta" kormány,
   *  3) a vezérelt bx-hez hozzáadódik az imbolygás (szinuszok + sima zaj), amplitúdója a részegséggel nő.
   */
  updatePlayer(dt) {
    const p = this.player;
    const d = this.drunk / 100;
    const raw = this.input.steer();
    this.inputHist.push({ t: this.time, v: raw });
    const delay = d * 0.28;
    let delayed = raw;
    for (let i = this.inputHist.length - 1; i >= 0; i--) {
      if (this.inputHist[i].t <= this.time - delay) {
        delayed = this.inputHist[i].v;
        this.inputHist.splice(0, i); // a régebbiek már nem kellenek
        break;
      }
      if (i === 0) delayed = this.inputHist[0].v;
    }
    const tau = 0.05 + d * 0.45;
    p.steer += (delayed - p.steer) * (1 - Math.exp(-dt / tau));

    const control = p.slideT > 0 ? 0.22 : p.air > 0 ? 0.35 : 1;
    p.bx += (p.steer * C.STEER_SPEED * control + p.jv + p.slideV) * dt;
    p.jv *= Math.exp(-dt * 5);
    if (p.slideT > 0) {
      p.slideT -= dt;
      p.slideV *= Math.exp(-dt * 0.7);
      if (p.slideT <= 0) p.slideV = 0;
    }

    // imbolygás
    const amp = 3 + this.drunk * 0.46;
    p.swayPhase += dt * (1.3 + d * 0.9);
    const sway =
      amp * (0.62 * Math.sin(p.swayPhase) + 0.3 * Math.sin(p.swayPhase * 2.3 + 1.7)) + amp * 0.75 * noise1(this.time * 0.35 + 10);
    p.bx = clamp(p.bx, 20, C.W - 20);
    p.x = p.bx + sway;
    const vx = (p.x - p.prevX) / Math.max(dt, 1e-3);
    p.prevX = p.x;
    let tiltT = clamp(vx * 0.0032 + p.steer * 0.1, -0.55, 0.55);
    if (p.slideT > 0) tiltT += Math.sin(this.time * 22) * 0.22;
    p.tilt = lerp(p.tilt, tiltT, 1 - Math.exp(-dt * 10));

    // pedálozás + nyikorgás félfordulatonként (véletlenszerűen, hogy ne legyen idegesítő)
    p.pedal += dt * this.scroll * 0.05;
    const half = Math.floor(p.pedal / Math.PI);
    if (half !== p.lastHalf) {
      p.lastHalf = half;
      if (Math.random() < 0.18) this.sound.squeak(0.6 + d);
    }
    if (Math.random() < dt * 10) this.addParticle('dust', p.x + rand(-4, 4), p.y + 40, rand(-15, 15), rand(20, 50), 0.5, rand(2, 4));

    // ugrás (kátyú után)
    if (p.jumpT > 0) {
      p.jumpT -= dt;
      p.air = Math.sin(Math.PI * clamp(1 - p.jumpT / p.jumpDur, 0, 1));
      if (p.jumpT <= 0) {
        p.air = 0;
        this.shake = 7;
        p.jv += pick([-1, 1]) * rand(50, 90);
        for (let i = 0; i < 10; i++) this.addParticle('dust', p.x + rand(-12, 12), p.y + 38, rand(-60, 60), rand(-20, 40), 0.6, rand(3, 6));
      }
    }
    // csuklás részegen: kis ugrás + rántás
    if (this.drunk > 35) {
      this.hiccupTimer -= dt;
      if (this.hiccupTimer <= 0) {
        this.hiccupTimer = rand(4, 9) * (1.4 - d);
        this.sound.hiccup();
        p.jv += pick([-1, 1]) * rand(25, 45);
        this.floater('hukk!', p.x + 20, p.y - 60, '#fff', 13);
      }
    }
    p.slowT = Math.max(0, p.slowT - dt);
    p.invulnT = Math.max(0, p.invulnT - dt);
    p.drinkT = Math.max(0, p.drinkT - dt);
    p.onShoulder = p.x < C.ROAD_L || p.x > C.ROAD_R;
    if (p.onShoulder && Math.random() < dt * 6) p.jv += rand(-12, 12); // döcögős fű
    if ((p.x < C.DITCH_L || p.x > C.DITCH_R) && p.invulnT <= 0) this.startCrash('ditch');
    else if (p.x < C.DITCH_L || p.x > C.DITCH_R) p.bx += (C.ROAD_C - p.x) * dt * 3; // sérthetetlenül visszaterel
  }

  // ----------------------------------------------------------------- spawn
  updateSpawning(dt) {
    if (this.state !== 'play') return;
    this.spawnAcc += this.scroll * dt;
    if (this.spawnAcc >= this.nextGap) {
      this.spawnAcc = 0;
      const base = Math.max(58, 165 * Math.pow(0.9, this.level - 1));
      this.nextGap = base * rand(0.7, 1.25);
      this.spawnOne();
    }
  }

  spawnOne() {
    const L = this.level;
    const drunkBoost = this.drunk > 60 ? 1.8 : 1;
    let type;
    if (this.time < 4) type = 'beer';
    else
      type = weighted([
        { w: 30, v: 'beer' },
        { w: 3.5 * drunkBoost, v: 'coffee' },
        { w: 5.5 * drunkBoost, v: 'pickle' },
        { w: 10, v: 'goat' },
        { w: L >= 1 && this.time > 10 ? 7 : 0, v: 'goatRun' },
        { w: L >= 2 ? 5 + L : 0, v: 'goatCharge' },
        { w: 11, v: 'pothole' },
        { w: 9, v: 'puddle' },
        { w: this.time > 15 ? 6 : 0, v: 'chickens' },
        { w: L >= 2 ? 3 + L : 0, v: 'tractor' },
      ]);

    const busyNear = (x, w) => this.entities.some((e) => e.y < 60 && Math.abs(e.x - x) < w);
    let x = rand(C.ROAD_L + 18, C.ROAD_R - 18);
    for (let k = 0; k < 6 && busyNear(x, 55); k++) x = rand(C.ROAD_L + 18, C.ROAD_R - 18);
    const e = { type, x, y: -60, t: rand(0, 10), vx: 0, vy: 0, state: 'idle', seed: Math.random(), hit: false };

    switch (type) {
      case 'tractor': {
        if (this.entities.some((o) => o.type === 'tractor' && o.y < this.H * 0.6)) return this.spawnOne();
        e.x = pick([C.ROAD_L + 58, C.ROAD_R - 58]);
        e.y = -130;
        e.vy = 55 + L * 6;
        // a traktor útjából eltakarítjuk a frissen spawnolt dolgokat (fair maradjon)
        this.entities = this.entities.filter((o) => !(o.y < 80 && Math.abs(o.x - e.x) < 70 && !PICKUP_TYPES.has(o.type)));
        break;
      }
      case 'goatRun': {
        const side = pick([-1, 1]);
        e.x = side < 0 ? C.SHOULDER_L - 4 : C.SHOULDER_R + 4;
        e.dir = -side; // a másik oldal felé fut
        e.state = 'wait';
        break;
      }
      case 'chickens': {
        e.hens = [];
        const n = randInt(5, 7);
        for (let i = 0; i < n; i++)
          e.hens.push({ ox: rand(-30, 30), oy: rand(-20, 20), vx: 0, vy: 0, ang: rand(0, TAU), brown: Math.random() < 0.4, peck: rand(0, 5) });
        break;
      }
    }
    this.entities.push(e);
  }

  spawnScenery(side, y) {
    const type = weighted([
      { w: 30, v: 'tree' },
      { w: 20, v: 'bush' },
      { w: 12, v: 'haystack' },
      { w: 14, v: 'sunflowers' },
      { w: 6, v: 'house' },
      { w: 5, v: 'well' },
      { w: 13, v: 'flowers' },
    ]);
    let x = rand(4, 30);
    if (type === 'house') x = 2;
    if (type === 'tree') x = rand(2, 26);
    const d = { type, x: side ? C.W - x : x, y, s: rand(0.85, 1.1), seed: rand(0, 10), flip: !!side, apples: Math.random() < 0.3 };
    if (type === 'house' || type === 'well') d.s = 1;
    this.scenery.push(d);
    return d;
  }

  updateScenery(dt) {
    for (let side = 0; side < 2; side++) {
      this.sceneryAcc[side] += this.scroll * dt;
      if (this.sceneryAcc[side] >= this.sceneryGap[side]) {
        this.sceneryAcc[side] = 0;
        const d = this.spawnScenery(side, -70);
        this.sceneryGap[side] = d.type === 'house' ? 150 : rand(55, 120);
      }
    }
    for (const d of this.scenery) d.y += this.scroll * dt;
    this.scenery = this.scenery.filter((d) => d.y < this.H + 90);
  }

  // ----------------------------------------------------------------- entitások
  updateEntities(dt) {
    const p = this.player;
    for (const e of this.entities) {
      e.t += dt;
      e.y += (this.scroll + e.vy) * dt;
      e.x += e.vx * dt;
      const dy = p.y - e.y; // >0: előttünk van
      switch (e.type) {
        case 'goat':
          if (!e.bleated && dy < 230 && dy > 0) {
            e.bleated = true;
            if (Math.random() < 0.6) this.sound.bleat();
          }
          break;
        case 'goatRun':
          if (e.state === 'wait' && dy < 330 && this.state === 'play') {
            e.state = 'run';
            e.vx = e.dir * (150 + this.level * 12);
            this.sound.bleat();
            e.warn = 1;
          }
          if (e.state === 'run') e.run = (e.run || 0) + dt;
          e.warn = Math.max(0, (e.warn || 0) - dt);
          break;
        case 'goatCharge':
          if (e.state === 'idle' && dy < 260 && dy > 70 && this.state === 'play') {
            e.state = 'charge';
            e.vy = 140;
            this.sound.bleat();
            this.floater('ROHAM!', e.x, e.y - 24, '#ff4d3d', 14);
          }
          if (e.state === 'charge') {
            if (e.y < p.y - 20) e.vx = clamp((p.x - e.x) * 2.2, -150, 150);
            else e.vx *= Math.exp(-dt * 3);
            if (Math.random() < dt * 14) this.addParticle('dust', e.x + rand(-8, 8), e.y - 10, rand(-20, 20), -40, 0.5, rand(2, 4));
          }
          break;
        case 'tractor':
          if (Math.random() < dt * 9) this.addParticle('smoke', e.x + 14, e.y - 6, rand(-8, 8), -60, 1.2, rand(4, 7));
          if (!e.honked && dy < 280 && dy > 0) {
            e.honked = true;
            this.sound.horn();
          }
          break;
        case 'chickens':
          for (const h of e.hens) {
            const hx = e.x + h.ox;
            const hy = e.y + h.oy;
            const dx = hx - p.x;
            const ddy = hy - p.y;
            const dist = Math.hypot(dx, ddy);
            if (!h.scared && dist < 150) {
              h.scared = true;
              const a = Math.atan2(ddy, dx) + rand(-0.6, 0.6);
              const sp = rand(110, 210);
              h.vx = Math.cos(a) * sp + (dx >= 0 ? 60 : -60);
              h.vy = Math.sin(a) * sp * 0.5 - 40;
              h.ang = Math.atan2(h.vy, h.vx);
              if (!e.clucked) {
                e.clucked = true;
                this.sound.cluck();
              }
            }
            h.ox += h.vx * dt;
            h.oy += h.vy * dt;
            h.peck += dt;
          }
          break;
      }
    }
    this.entities = this.entities.filter((e) => e.y < this.H + 160 && e.x > -120 && e.x < C.W + 120);
  }

  // ----------------------------------------------------------------- ütközések
  checkCollisions() {
    const p = this.player;
    const px = p.x;
    const py = p.y;
    for (const e of this.entities) {
      if (e.hit) continue;
      const dx = e.x - px;
      const dy = e.y - py;
      switch (e.type) {
        case 'beer':
          if (dx * dx + dy * dy < 30 * 30) {
            e.hit = true;
            e.dead = true;
            const pts = Math.round(10 * this.multiplier);
            this.itemScore += pts;
            this.drunk = Math.min(100, this.drunk + 13);
            this.stats.beers++;
            p.drinkT = 0.6;
            this.sound.clink();
            this.sound.hiccup(0.45);
            this.floater(`+${pts}`, e.x, e.y - 20, '#ffe066', 18);
            for (let i = 0; i < 12; i++) this.addParticle('spark', e.x, e.y, rand(-80, 80), rand(-80, 40), 0.6, rand(2, 4), '#fff3a0');
            if (this.drunk >= 100 && !this._fullDrunkMsg) {
              this._fullDrunkMsg = true;
              this.onBanner('Teljesen elázott! (x3 pont)');
            }
          }
          break;
        case 'coffee':
          if (dx * dx + dy * dy < 30 * 30) {
            e.hit = e.dead = true;
            this.drunk = Math.max(0, this.drunk - 45);
            this._fullDrunkMsg = false;
            this.itemScore += 5;
            this.stats.coffees++;
            this.sound.sip();
            this.floater('Kávé! Kijózanodás', e.x, e.y - 20, '#ffd8a8', 15);
          }
          break;
        case 'pickle':
          if (dx * dx + dy * dy < 30 * 30) {
            e.hit = e.dead = true;
            this.drunk = Math.max(0, this.drunk - 18);
            this._fullDrunkMsg = false;
            this.itemScore += 5;
            this.stats.pickles++;
            this.sound.crunch();
            this.floater('Savanyúság! Ropp!', e.x, e.y - 20, '#c8f7a0', 15);
          }
          break;
        case 'goat':
        case 'goatRun':
        case 'goatCharge':
          if (p.invulnT <= 0 && circleRect(px, py, C.PLAYER_R, e.x, e.y + 2, 17 * C.GOAT_SCALE, 13 * C.GOAT_SCALE)) return this.startCrash('goat', e);
          break;
        case 'tractor':
          if (p.invulnT <= 0 && circleRect(px, py, C.PLAYER_R, e.x, e.y, 56, 50)) return this.startCrash('tractor', e);
          break;
        case 'pothole':
          if (p.air <= 0 && (dx / 22) ** 2 + (dy / 13) ** 2 < 1) {
            e.hit = true;
            p.jumpT = p.jumpDur = 0.55;
            this.sound.boing();
            this.shake = 5;
            this.floater('Kátyú! Huppsz!', px, py - 70, '#fff', 15);
          }
          break;
        case 'puddle':
          if (p.air <= 0 && (dx / 32) ** 2 + (dy / 18) ** 2 < 1) {
            e.hit = true;
            p.slideT = 1.3;
            p.slideV = (Math.sign(p.steer + rand(-0.3, 0.3)) || 1) * rand(75, 120);
            this.sound.splash();
            this.floater('Pocsolya! Csúszik!', px, py - 70, '#bfe3ff', 15);
            for (let i = 0; i < 18; i++) this.addParticle('drop', px + rand(-14, 14), py + 30, rand(-110, 110), rand(-160, -40), 0.7, rand(2, 4), '#a9d2ec');
          }
          break;
        case 'chickens':
          if (p.air <= 0)
            for (const h of e.hens) {
              const hx = e.x + h.ox - px;
              const hy = e.y + h.oy - py;
              if (hx * hx + hy * hy < 22 * 22) {
                e.hit = true;
                p.slowT = 1.6;
                this.sound.cluck();
                this.floater('Tyúkcsapat! Lassítás!', px, py - 70, '#fff', 15);
                for (let i = 0; i < 16; i++)
                  this.addParticle('feather', px + rand(-15, 15), py + rand(-15, 15), rand(-90, 90), rand(-90, 60), 1.2, rand(3, 5), Math.random() < 0.5 ? '#ffffff' : '#c98b4f');
                break;
              }
            }
          break;
      }
    }
    this.entities = this.entities.filter((e) => !e.dead);
  }

  // ----------------------------------------------------------------- ütközés-animáció
  startCrash(kind, e) {
    const p = this.player;
    this.state = 'crash';
    this.lives--;
    this.sound.crash();
    if (kind === 'goat') setTimeout(() => this.sound.bleat(), 350);
    this.shake = 14;
    this.crash = {
      kind,
      t: 0,
      dur: 2.2,
      x0: p.x,
      y0: p.y,
      side: kind === 'ditch' ? (p.x < C.ROAD_C ? -1 : 1) : p.x < C.ROAD_C ? -1 : 1,
      line: pick(CRASH_LINES[kind]),
      goatDir: e && e.type === 'goatRun' ? (e.vx < 0 ? 'left' : 'right') : 'down',
    };
    if (e) this.entities = this.entities.filter((o) => o !== e);
    for (let i = 0; i < 16; i++) this.addParticle('dust', p.x + rand(-15, 15), p.y + rand(0, 30), rand(-120, 120), rand(-120, 30), 0.8, rand(4, 8));
  }

  updateCrash(dt) {
    const c = this.crash;
    c.t += dt;
    const p = this.player;
    if (c.kind === 'ditch' && c.t > 0.55 && !c.splashed) {
      c.splashed = true;
      for (let i = 0; i < 14; i++) this.addParticle('drop', c.side < 0 ? 52 : C.W - 52, p.y + 10, rand(-80, 80), rand(-150, -40), 0.7, rand(2, 4), '#88b6d6');
    }
    if (c.t >= c.dur) {
      if (this.lives <= 0) {
        this.state = 'over';
        this.sound.stopMusic();
        this.sound.gameOver();
        this.onGameOver({ score: this.score, level: this.level, durationSec: Math.round(this.time), stats: this.stats });
        return;
      }
      this.state = 'play';
      this.crash = null;
      p.invulnT = 2.4;
      p.bx = clamp(p.bx, C.ROAD_L + 40, C.ROAD_R - 40);
      if (p.x < C.ROAD_L || p.x > C.ROAD_R) p.bx = C.ROAD_C;
      p.jv = p.slideV = p.slideT = p.jumpT = p.air = 0;
      p.steer = 0;
      this.inputHist.length = 0;
      this.drunk *= 0.7; // a sokk kicsit kijózanít
      // a játékos előtti közvetlen veszélyek eltűnnek, hogy ne jöjjön azonnal újabb ütközés
      this.entities = this.entities.filter((o) => PICKUP_TYPES.has(o.type) || o.y < p.y - 280 || o.y > p.y + 80);
    }
  }

  // ----------------------------------------------------------------- részecskék / lebegő szövegek
  addParticle(kind, x, y, vx, vy, life, size, color) {
    if (this.particles.length > 400) return;
    this.particles.push({ kind, x, y, vx, vy, life, max: life, size, color, rot: rand(0, TAU), vr: rand(-6, 6) });
  }
  floater(text, x, y, color = '#fff', size = 16) {
    this.floaters.push({ text, x: clamp(x, 70, C.W - 70), y, color, size, life: 1.1, max: 1.1 });
  }
  updateParticles(dt) {
    for (const q of this.particles) {
      q.life -= dt;
      q.x += q.vx * dt;
      q.y += (q.vy + this.scroll) * dt;
      q.rot += q.vr * dt;
      if (q.kind === 'drop') q.vy += 420 * dt;
      else if (q.kind === 'feather') {
        q.vx *= Math.exp(-dt * 2);
        q.vy = lerp(q.vy, 30, 1 - Math.exp(-dt * 2));
      } else if (q.kind === 'smoke') {
        q.size += dt * 6;
        q.vy *= Math.exp(-dt * 1.2);
      } else {
        q.vx *= Math.exp(-dt * 3);
        q.vy *= Math.exp(-dt * 3);
      }
    }
    this.particles = this.particles.filter((q) => q.life > 0);
    for (const f of this.floaters) {
      f.life -= dt;
      f.y -= dt * 40;
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);
  }

  // ================================================================= DRAW
  draw(ctx) {
    const H = this.H;
    const t = this.anim;
    ctx.save();
    if (this.shake > 0) ctx.translate(rand(-this.shake, this.shake) * 0.5, rand(-this.shake, this.shake) * 0.5);
    // részegen az egész világ finoman ring
    const d = this.drunk / 100;
    if (d > 0.05) {
      ctx.translate(C.W / 2, H / 2);
      ctx.rotate(Math.sin(t * 0.9) * d * 0.035);
      ctx.translate(-C.W / 2, -H / 2);
    }
    // háttér-csempe (két-három példány egymás alatt)
    const off = this.dist % C.TILE_H;
    for (let y = off - C.TILE_H; y < H + C.TILE_H; y += C.TILE_H) ctx.drawImage(this.tile, -2, y - 2, C.W + 4, C.TILE_H + 4);

    for (const s of this.scenery) if (s.type !== 'tree') D.drawScenery(ctx, s, t);
    // talajszintű akadályok
    for (const e of this.entities) {
      if (e.type === 'pothole') D.drawPothole(ctx, e.x, e.y, e.seed);
      else if (e.type === 'puddle') D.drawPuddle(ctx, e.x, e.y, t, e.seed);
    }
    for (const q of this.particles) if (q.kind === 'dust') this.drawParticle(ctx, q);
    // tárgyak + állatok (y szerint rendezve, hogy a takarás jó legyen)
    const mids = this.entities.filter((e) => e.type !== 'pothole' && e.type !== 'puddle' && e.type !== 'tractor').sort((a, b) => a.y - b.y);
    for (const e of mids) this.drawEntity(ctx, e, t);

    if (this.state === 'crash') this.drawCrash(ctx, t);
    else if (this.state === 'play' || this.state === 'ready') {
      const p = this.player;
      const blink = p.invulnT > 0 && Math.floor(p.invulnT * 10) % 2 === 0;
      if (!blink) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(C.PLAYER_SCALE, C.PLAYER_SCALE);
        D.drawPlayer(ctx, 0, 0, { tilt: p.tilt, pedal: p.pedal, air: p.air, drink: p.drinkT, steer: p.steer }, this.head, t);
        ctx.restore();
      }
    }
    for (const e of this.entities) if (e.type === 'tractor') D.drawTractor(ctx, e.x, e.y, e.t);
    for (const s of this.scenery) if (s.type === 'tree') D.drawScenery(ctx, s, t);
    for (const q of this.particles) if (q.kind !== 'dust') this.drawParticle(ctx, q);

    // figyelmeztetés a futó kecskére a képernyő szélén
    for (const e of this.entities)
      if (e.type === 'goatRun' && e.warn > 0) {
        const wx = e.dir > 0 ? 18 : C.W - 18;
        ctx.save();
        ctx.globalAlpha = Math.min(1, e.warn * 2);
        ctx.fillStyle = '#ff4d3d';
        ctx.beginPath();
        ctx.arc(wx, clamp(e.y, 30, H - 30), 13, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('!', wx, clamp(e.y, 30, H - 30) + 6);
        ctx.restore();
      }

    for (const f of this.floaters) {
      const a = clamp(f.life / f.max, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = `bold ${f.size}px "Trebuchet MS", sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = 'rgba(40,25,10,0.85)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }
    ctx.restore();

    // részeg vignetta
    if (d > 0.15) {
      const g = ctx.createRadialGradient(C.W / 2, H / 2, H * 0.25, C.W / 2, H / 2, H * 0.75);
      g.addColorStop(0, 'rgba(255,170,90,0)');
      g.addColorStop(1, `rgba(190,70,40,${(d - 0.15) * 0.45})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, C.W, H);
    }
  }

  drawEntity(ctx, e, t) {
    switch (e.type) {
      case 'beer':
        return D.drawBeer(ctx, e.x, e.y, e.t);
      case 'coffee':
        return D.drawCoffee(ctx, e.x, e.y, e.t);
      case 'pickle':
        return D.drawPickle(ctx, e.x, e.y, e.t);
      case 'goat':
        return D.drawGoat(ctx, e.x, e.y, { t: e.t, s: C.GOAT_SCALE });
      case 'goatRun':
        return D.drawGoat(ctx, e.x, e.y, { dir: e.dir < 0 ? 'left' : 'right', t: e.t, run: e.run || e.t * 0.2, s: C.GOAT_SCALE });
      case 'goatCharge':
        if (e.state === 'idle') {
          // kapál: előre-hátra billeg, gőzölög az orra
          if (Math.random() < 0.08) this.addParticle('smoke', e.x + rand(-4, 4), e.y + 14, rand(-10, 10), 10, 0.5, 2);
          return D.drawGoat(ctx, e.x, e.y + Math.sin(e.t * 12) * 1.2, { t: e.t, angry: true, s: C.GOAT_SCALE });
        }
        return D.drawGoat(ctx, e.x, e.y, { t: e.t * 3, angry: true, s: C.GOAT_SCALE * 1.08 });
      case 'chickens':
        for (const h of e.hens) {
          const peck = h.scared ? 0 : Math.max(0, Math.sin(h.peck * 4)) * 2;
          D.drawChicken(ctx, e.x + h.ox, e.y + h.oy + peck, { t: e.t, ang: h.scared ? h.ang : h.ang + Math.sin(e.t + h.peck) * 0.3, flap: h.scared, brown: h.brown });
        }
        return;
    }
  }

  drawParticle(ctx, q) {
    const a = clamp(q.life / q.max, 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    switch (q.kind) {
      case 'dust':
        ctx.fillStyle = 'rgba(205,170,115,0.7)';
        ctx.beginPath();
        ctx.arc(q.x, q.y, q.size * (1.6 - a * 0.6), 0, TAU);
        ctx.fill();
        break;
      case 'smoke':
        ctx.fillStyle = 'rgba(90,90,90,0.45)';
        ctx.beginPath();
        ctx.arc(q.x, q.y, q.size, 0, TAU);
        ctx.fill();
        break;
      case 'feather':
        ctx.translate(q.x, q.y);
        ctx.rotate(q.rot);
        ctx.fillStyle = q.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, q.size, q.size * 0.4, 0, 0, TAU);
        ctx.fill();
        break;
      case 'star':
        D.drawStar(ctx, q.x, q.y, q.size, q.rot);
        break;
      default:
        ctx.fillStyle = q.color || '#fff';
        ctx.beginPath();
        ctx.arc(q.x, q.y, q.size, 0, TAU);
        ctx.fill();
    }
    ctx.restore();
  }

  /** Vicces ütközés-animációk: árokba borulás, kecske a hasán, traktor-palacsinta. */
  drawCrash(ctx, t) {
    const c = this.crash;
    const p = this.player;
    const k = clamp(c.t / c.dur, 0, 1);
    const pose = { tilt: 0, pedal: 0, air: 0, drink: 0, steer: 0 };
    let x = c.x0;
    let y = c.y0;
    let rot = 0;
    let sx = 1;
    let sy = 1;
    let headX = 0;
    let headY = -40;
    if (c.kind === 'ditch') {
      const k1 = clamp(c.t / 0.6, 0, 1);
      const ditchX = c.side < 0 ? 52 : C.W - 52;
      x = lerp(c.x0, ditchX, easeOutCubic(k1));
      y = c.y0 - Math.sin(Math.PI * k1) * 40;
      rot = c.side * (k1 * TAU * 1.25);
      if (k1 >= 1) rot = c.side * (Math.PI / 2 + Math.sin(c.t * 3) * 0.05);
      headX = c.side * 30;
      headY = -10;
    } else if (c.kind === 'goat') {
      const k1 = clamp(c.t / 0.7, 0, 1);
      y = c.y0 - Math.sin(Math.PI * k1) * 90;
      sx = sy = 1 + Math.sin(Math.PI * k1) * 0.35;
      rot = k1 * Math.PI * 3; // 1,5 fordulat -> a hátán landol (fejjel lefelé)
      headY = 40;
    } else {
      // traktor: kilapul
      const k1 = clamp(c.t / 0.25, 0, 1);
      sy = lerp(1, 0.28, k1);
      sx = lerp(1, 1.45, k1);
      if (k > 0.85) {
        const b = (k - 0.85) / 0.15;
        sy = lerp(0.28, 1, easeOutCubic(b)) + Math.sin(b * Math.PI * 3) * 0.1 * (1 - b);
        sx = lerp(1.45, 1, easeOutCubic(b));
      }
      headY = -12;
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(sx * C.PLAYER_SCALE, sy * C.PLAYER_SCALE);
    D.drawPlayer(ctx, 0, 0, pose, this.head, t);
    ctx.restore();
    if (c.kind === 'tractor' && c.t > 0.2) {
      // keréknyom rajta
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#3a2a1a';
      for (let i = -3; i <= 3; i++) ctx.fillRect(x - 22, y - 8 + i * 5, 44, 2);
      ctx.restore();
    }
    if (c.kind === 'goat' && c.t > 0.75) {
      // a kecske odaáll a hasára, és diadalmasan mekeg
      const gk = clamp((c.t - 0.75) / 0.4, 0, 1);
      const gx = lerp(x + (c.side < 0 ? 80 : -80), x, easeOutCubic(gk));
      D.drawGoat(ctx, gx, y - 6 - Math.abs(Math.sin(c.t * 8)) * 3 * (1 - gk), { t: c.t, dir: gk < 1 ? (c.side < 0 ? 'left' : 'right') : 'down', run: c.t, angry: gk >= 1, s: C.GOAT_SCALE });
    }
    // szédült csillagok a feje körül
    if (c.t > 0.6) {
      for (let i = 0; i < 3; i++) {
        const a = c.t * 4 + (i * TAU) / 3;
        D.drawStar(ctx, x + headX + Math.cos(a) * 22, y + headY * 0.85 - 25 + Math.sin(a) * 8, 6, a);
      }
    }
    if (c.t > 0.5) D.drawBubble(ctx, clamp(x, 90, C.W - 90), y - 70, c.line, clamp((c.t - 0.5) * 4, 0, 1));
  }
}
