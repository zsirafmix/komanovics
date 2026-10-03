// Bemenet: billentyűzet (nyilak, A/D), érintés/egér (képernyő bal/jobb fele nyomva tartva),
// opcionális döntés-vezérlés (DeviceOrientation, iOS-en engedélykéréssel).
// Kimenet: input.steer() -> -1..1 (bal..jobb).
export class Input {
  constructor(canvas, { onPause } = {}) {
    this.keys = new Set();
    this.pointers = new Map(); // pointerId -> -1 | 1
    this.tiltEnabled = false;
    this.tiltValue = 0;
    this.onPause = onPause;

    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (['arrowleft', 'arrowright', 'a', 'd'].includes(k)) {
        this.keys.add(k);
        e.preventDefault();
      }
      if ((k === 'p' || k === 'escape') && !e.repeat && this.onPause) {
        // Ne kapja el a név beviteli mezőből (game over képernyő)
        if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
        this.onPause();
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.pointers.clear();
    });

    const side = (e) => {
      const r = canvas.getBoundingClientRect();
      return e.clientX - r.left < r.width / 2 ? -1 : 1;
    };
    canvas.addEventListener('pointerdown', (e) => {
      this.pointers.set(e.pointerId, side(e));
      canvas.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, side(e));
    });
    const up = (e) => this.pointers.delete(e.pointerId);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    this._onOrient = (e) => {
      if (e.gamma == null) return;
      // Fekvő tájolásnál a beta tengely felel a bal-jobb döntésnek.
      const angle = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
      let v = e.gamma;
      if (angle === 90) v = e.beta;
      else if (angle === -90 || angle === 270) v = -e.beta;
      this.tiltValue = Math.max(-1, Math.min(1, v / 22));
    };
  }

  /** Döntés-vezérlés be/ki. iOS 13+ esetén engedélyt kér (felhasználói gesztusból kell hívni!). */
  async setTilt(on) {
    if (!on) {
      this.tiltEnabled = false;
      window.removeEventListener('deviceorientation', this._onOrient);
      return false;
    }
    if (typeof DeviceOrientationEvent === 'undefined') throw new Error('Ez az eszköz nem támogatja a döntés-érzékelést.');
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      const res = await DeviceOrientationEvent.requestPermission();
      if (res !== 'granted') throw new Error('Nem kaptunk engedélyt a mozgásérzékelőhöz.');
    }
    window.addEventListener('deviceorientation', this._onOrient);
    this.tiltEnabled = true;
    return true;
  }

  steer() {
    let s = 0;
    if (this.keys.has('arrowleft') || this.keys.has('a')) s -= 1;
    if (this.keys.has('arrowright') || this.keys.has('d')) s += 1;
    for (const v of this.pointers.values()) s += v;
    if (this.tiltEnabled && Math.abs(this.tiltValue) > 0.08) s += this.tiltValue;
    return Math.max(-1, Math.min(1, s));
  }
}
