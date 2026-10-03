// Minden hang Web Audio API-val, futásidőben szintetizálva (nincs külső hangfájl).
// Az AudioContext csak felhasználói gesztus után indulhat (böngésző-szabály) -> ensure() a gombnyomásokra.
// Hangerő-lánc: [hangforrások] -> sfxGain / musicGain -> master -> destination.
// A némítás a master gain-t állítja, és localStorage-ben ('ett_muted') megmarad.

const NOTE = (() => {
  const names = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  return (n) => {
    const m = /^([A-G]#?)(\d)$/.exec(n);
    const midi = (Number(m[2]) + 1) * 12 + names[m[1]];
    return 440 * Math.pow(2, (midi - 69) / 12);
  };
})();

// Vidám "tanyasi polka" 2/4-ben: [hang, hossz nyolcadokban]; 'R' = szünet. 16 ütem.
const MELODY = [
  ['G4', 1], ['C5', 1], ['E5', 1], ['G5', 1],
  ['E5', 2], ['C5', 2],
  ['D5', 1], ['F5', 1], ['D5', 1], ['B4', 1],
  ['G4', 2], ['R', 1], ['G4', 1],
  ['B4', 1], ['D5', 1], ['F5', 1], ['D5', 1],
  ['G5', 1], ['F5', 1], ['E5', 1], ['D5', 1],
  ['E5', 1], ['G5', 1], ['E5', 1], ['C5', 1],
  ['C5', 2], ['R', 1], ['G4', 1],
  ['A4', 1], ['C5', 1], ['F5', 1], ['A5', 1],
  ['A5', 1], ['G5', 1], ['F5', 1], ['A4', 1],
  ['G4', 1], ['C5', 1], ['E5', 1], ['G5', 1],
  ['E5', 1], ['D5', 1], ['C5', 1], ['E5', 1],
  ['D5', 1], ['E5', 1], ['F5', 1], ['D5', 1],
  ['B4', 1], ['C5', 1], ['D5', 1], ['B4', 1],
  ['C5', 1], ['E5', 1], ['G5', 1], ['E5', 1],
  ['C5', 2], ['R', 2],
];
// Ütemenkénti akkord: [basszus, akkordhangok]
const CH = {
  C: ['C3', ['E4', 'G4', 'C5']],
  G: ['G2', ['D4', 'G4', 'B4']],
  G7: ['G2', ['D4', 'F4', 'B4']],
  F: ['F2', ['F4', 'A4', 'C5']],
};
const CHORDS = ['C', 'C', 'G', 'G', 'G7', 'G7', 'C', 'C', 'F', 'F', 'C', 'C', 'G', 'G7', 'C', 'C'];
const ALT_BASS = { C: 'G2', G: 'D3', G7: 'D3', F: 'C3' }; // polkás váltóbasszus

export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem('ett_muted') === '1';
    this.musicOn = false;
    this._timer = null;
    this.bpm = 132;
  }

  /** AudioContext létrehozása / folytatása. Felhasználói gesztusból hívd. */
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      const ctx = (this.ctx = new AC());
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      // Enyhe kompresszor, hogy a sok egyszerre szóló effekt ne torzuljon.
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master.connect(comp).connect(ctx.destination);
      this.sfx = ctx.createGain();
      this.sfx.gain.value = 0.9;
      this.sfx.connect(this.master);
      this.music = ctx.createGain();
      this.music.gain.value = 0.22;
      this.music.connect(this.master);
      // 1 mp fehérzaj puffer (csattanás, fröccsenés, ropogás)
      const len = ctx.sampleRate;
      this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }

  setMuted(m) {
    this.muted = m;
    localStorage.setItem('ett_muted', m ? '1' : '0');
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.03);
  }

  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  // ---- alacsony szintű építőkockák ----
  _env(g, t, a, peak, d, sustain = 0, rel = 0.05, hold = 0) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    if (sustain > 0) {
      g.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t + a + d);
      g.gain.setValueAtTime(Math.max(sustain, 0.0001), t + a + d + hold);
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + d + hold + rel);
    } else {
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    }
  }
  _osc(type, freq, t, dur, dest) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  }
  _noise(t, dur, dest) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    s.connect(dest);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.05);
    return s;
  }
  _gain(dest = this.sfx) {
    const g = this.ctx.createGain();
    g.connect(dest);
    return g;
  }
  _filter(type, freq, q, dest) {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    f.connect(dest);
    return f;
  }
  _ok() {
    return this.ctx && this.ctx.state === 'running';
  }

  // ---- effektek ----
  hiccup(delay = 0) {
    if (!this._ok()) return;
    const t = this.ctx.currentTime + delay;
    const g = this._gain();
    this._env(g, t, 0.006, 0.5, 0.16);
    const o = this._osc('triangle', 280, t, 0.2, g);
    o.frequency.exponentialRampToValueAtTime(980, t + 0.05);
    o.frequency.exponentialRampToValueAtTime(420, t + 0.16);
    // torok-"kattanás": rövid sávszűrt zaj
    const g2 = this._gain();
    this._env(g2, t, 0.002, 0.35, 0.05);
    this._noise(t, 0.06, this._filter('bandpass', 1500, 2, g2));
  }

  bleat() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    const dur = 0.55 + Math.random() * 0.2;
    const base = 480 + Math.random() * 120;
    const g = this._gain();
    this._env(g, t, 0.04, 0.32, 0.1, 0.22, 0.18, dur - 0.3);
    const bp = this._filter('bandpass', 1150, 2.5, g);
    const o = this._osc('sawtooth', base, t, dur, bp);
    o.frequency.linearRampToValueAtTime(base * 0.85, t + dur);
    // "mekk-ekk-ekk": gyors amplitúdó-remegés (tremoló) + vibrato
    const trem = this.ctx.createOscillator();
    trem.frequency.value = 17 + Math.random() * 6;
    const tg = this.ctx.createGain();
    tg.gain.value = 0.12;
    trem.connect(tg).connect(g.gain);
    trem.start(t);
    trem.stop(t + dur + 0.1);
    const vib = this.ctx.createOscillator();
    vib.frequency.value = 9;
    const vg = this.ctx.createGain();
    vg.gain.value = 25;
    vib.connect(vg).connect(o.frequency);
    vib.start(t);
    vib.stop(t + dur + 0.1);
  }

  clink() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    [0, 0.07].forEach((dt, i) => {
      [2650, 3970, 5310].forEach((f, k) => {
        const g = this._gain();
        this._env(g, t + dt, 0.002, (0.18 / (k + 1)) * (i ? 0.5 : 1), 0.35 - k * 0.08);
        this._osc('sine', f * (1 + i * 0.03), t + dt, 0.4, g);
      });
    });
    // kortyolás: 3 mély "glugy"
    for (let i = 0; i < 3; i++) {
      const tt = t + 0.12 + i * 0.09;
      const g = this._gain();
      this._env(g, tt, 0.01, 0.25, 0.07);
      const o = this._osc('sine', 260, tt, 0.08, g);
      o.frequency.exponentialRampToValueAtTime(130, tt + 0.07);
    }
  }

  squeak(intensity = 1) {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    const g = this._gain();
    this._env(g, t, 0.02, 0.05 * intensity, 0.12);
    const f0 = 1300 + Math.random() * 300;
    const o = this._osc('triangle', f0, t, 0.16, this._filter('bandpass', 1800, 4, g));
    o.frequency.linearRampToValueAtTime(f0 * 1.35, t + 0.06);
    o.frequency.linearRampToValueAtTime(f0 * 1.1, t + 0.14);
  }

  crash() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    // zaj-robaj, lefelé söpört aluláteresztővel
    const g = this._gain();
    this._env(g, t, 0.005, 0.7, 0.55);
    const lp = this._filter('lowpass', 2500, 1, g);
    lp.frequency.exponentialRampToValueAtTime(200, t + 0.5);
    this._noise(t, 0.6, lp);
    // tompa puffanás
    const g2 = this._gain();
    this._env(g2, t, 0.005, 0.8, 0.3);
    const o = this._osc('sine', 140, t, 0.35, g2);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.3);
    // biciklicsengő-szerű fémes csilingelés
    [760, 1210, 1790].forEach((f, i) => {
      const gg = this._gain();
      this._env(gg, t + 0.05, 0.002, 0.09 / (i + 1), 0.7);
      this._osc('square', f, t + 0.05, 0.75, this._filter('bandpass', f, 8, gg));
    });
  }

  splash() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    const g = this._gain();
    this._env(g, t, 0.01, 0.45, 0.45);
    const bp = this._filter('bandpass', 1400, 1.2, g);
    bp.frequency.exponentialRampToValueAtTime(300, t + 0.45);
    this._noise(t, 0.5, bp);
  }

  boing() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    const g = this._gain();
    this._env(g, t, 0.005, 0.4, 0.35);
    const o = this._osc('sine', 120, t, 0.4, g);
    o.frequency.exponentialRampToValueAtTime(520, t + 0.08);
    o.frequency.exponentialRampToValueAtTime(180, t + 0.35);
    const g2 = this._gain();
    this._env(g2, t + 0.45, 0.003, 0.5, 0.15);
    this._noise(t + 0.45, 0.15, this._filter('lowpass', 400, 1, g2));
  }

  cluck() {
    if (!this._ok()) return;
    const t0 = this.ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const t = t0 + i * 0.09 + Math.random() * 0.03;
      const g = this._gain();
      this._env(g, t, 0.003, 0.16, 0.06);
      const f = 650 + Math.random() * 350;
      const o = this._osc('square', f, t, 0.07, this._filter('bandpass', 1300, 3, g));
      o.frequency.exponentialRampToValueAtTime(f * 1.6, t + 0.05);
    }
  }

  sip() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    const g = this._gain();
    this._env(g, t, 0.05, 0.2, 0.25);
    this._noise(t, 0.3, this._filter('bandpass', 2500, 3, g));
    // "Áhh" – elégedett sóhaj: formáns-szerű szűrt fűrészfog
    const g2 = this._gain();
    this._env(g2, t + 0.3, 0.05, 0.18, 0.1, 0.12, 0.25, 0.15);
    const o = this._osc('sawtooth', 190, t + 0.3, 0.6, this._filter('bandpass', 800, 4, g2));
    o.frequency.linearRampToValueAtTime(150, t + 0.85);
  }

  crunch() {
    if (!this._ok()) return;
    const t0 = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const t = t0 + i * 0.11;
      const g = this._gain();
      this._env(g, t, 0.002, 0.35, 0.07);
      this._noise(t, 0.08, this._filter('highpass', 2200, 1, g));
    }
  }

  horn() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    [0, 0.32].forEach((dt) => {
      const g = this._gain();
      this._env(g, t + dt, 0.02, 0.18, 0.05, 0.16, 0.06, 0.18);
      const lp = this._filter('lowpass', 1400, 1, g);
      this._osc('square', 233, t + dt, 0.3, lp);
      this._osc('square', 294, t + dt, 0.3, lp);
    });
  }

  levelUp() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    ['C5', 'E5', 'G5', 'C6'].forEach((n, i) => {
      const g = this._gain();
      this._env(g, t + i * 0.08, 0.005, 0.16, 0.22);
      this._osc('square', NOTE(n), t + i * 0.08, 0.25, this._filter('lowpass', 3000, 1, g));
    });
  }

  gameOver() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    // "Vá-vá-vá-váááá" szomorú harsona
    ['G3', 'F#3', 'F3', 'E3'].forEach((n, i) => {
      const st = t + i * 0.42;
      const dur = i === 3 ? 1.1 : 0.36;
      const g = this._gain();
      this._env(g, st, 0.03, 0.3, 0.05, 0.26, 0.2, dur - 0.1);
      const lp = this._filter('lowpass', 900, 2, g);
      lp.frequency.setValueAtTime(500, st);
      lp.frequency.linearRampToValueAtTime(1300, st + 0.15);
      const o = this._osc('sawtooth', NOTE(n), st, dur + 0.2, lp);
      if (i === 3) {
        const vib = this.ctx.createOscillator();
        vib.frequency.value = 5;
        const vg = this.ctx.createGain();
        vg.gain.value = 6;
        vib.connect(vg).connect(o.frequency);
        vib.start(st);
        vib.stop(st + dur + 0.2);
      }
    });
  }

  // ---- zene: harmonika-szerű polka, lookahead ütemezővel ----
  // Harmonika-hangszín: 3 enyhén elhangolt fűrészfog/négyszög ("musette" lebegés) + aluláteresztő.
  _accordion(freq, t, dur, vol) {
    const g = this.ctx.createGain();
    g.connect(this.music);
    this._env(g, t, 0.02, vol, 0.06, vol * 0.75, 0.06, Math.max(0, dur - 0.12));
    const lp = this._filter('lowpass', 2300, 0.8, g);
    [-9, 0, 9].forEach((cents, i) => {
      const o = this._osc(i === 1 ? 'square' : 'sawtooth', freq, t, dur, lp);
      o.detune.value = cents;
    });
  }
  _bass(freq, t, dur) {
    const g = this.ctx.createGain();
    g.connect(this.music);
    this._env(g, t, 0.01, 0.5, dur * 0.8);
    this._osc('triangle', freq, t, dur, g);
  }
  _chord(notes, t, dur) {
    notes.forEach((n) => this._accordion(NOTE(n), t, dur, 0.06));
  }

  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    this.music.gain.cancelScheduledValues(this.ctx.currentTime);
    this.music.gain.setTargetAtTime(0.22, this.ctx.currentTime, 0.1);
    const eighth = 60 / this.bpm / 2;
    // előre kiszámolt eseménylista egy körre (16 ütem * 4 nyolcad)
    const events = [];
    let pos = 0;
    for (const [n, len] of MELODY) {
      if (n !== 'R') events.push({ at: pos, kind: 'mel', n, len });
      pos += len;
    }
    const loopLen = pos; // 64 nyolcad
    CHORDS.forEach((c, bar) => {
      const [bass, notes] = CH[c];
      events.push({ at: bar * 4, kind: 'bass', n: bar % 2 ? ALT_BASS[c] : bass });
      events.push({ at: bar * 4 + 2, kind: 'chord', notes });
    });
    events.sort((a, b) => a.at - b.at);
    this._loopStart = this.ctx.currentTime + 0.1;
    this._nextIdx = 0;
    this._loopN = 0;
    const tick = () => {
      if (!this.musicOn) return;
      const ahead = this.ctx.currentTime + 0.25;
      for (;;) {
        const ev = events[this._nextIdx];
        const t = this._loopStart + (this._loopN * loopLen + ev.at) * eighth;
        if (t > ahead) break;
        if (t > this.ctx.currentTime - 0.05) {
          if (ev.kind === 'mel') this._accordion(NOTE(ev.n), t, ev.len * eighth * 0.92, 0.11);
          else if (ev.kind === 'bass') this._bass(NOTE(ev.n), t, eighth * 1.6);
          else this._chord(ev.notes, t, eighth * 0.9);
        }
        this._nextIdx++;
        if (this._nextIdx >= events.length) {
          this._nextIdx = 0;
          this._loopN++;
        }
      }
    };
    tick();
    this._timer = setInterval(tick, 50);
  }

  stopMusic() {
    this.musicOn = false;
    clearInterval(this._timer);
    if (this.ctx) this.music.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.08);
  }

  /** Szünet közben halkabb zene */
  duckMusic(on) {
    if (!this.ctx) return;
    this.music.gain.setTargetAtTime(on ? 0.06 : 0.22, this.ctx.currentTime, 0.1);
  }
}
