const ease = (s) => (s < 0 ? 0 : s > 1 ? 1 : s * s * (3 - 2 * s));

/** Caméra orbitale autour d'un corps (origine flottante : la mise en scène est relative au point de focus). */
export class CameraRig {
  constructor(dom, camera) {
    this.dom = dom; this.camera = camera;
    this.az = 0.6; this.el = 0.55;
    this.dist = 6e6; this.logD = Math.log(6e6); this.logTarget = this.logD;
    this.minDist = 1; this.maxDist = 1.2e7;
    this.focusIdx = 0;
    this.focusAbs = [0, 0, 0];
    this.trans = null;
    this.enabled = true;
    this.ptrs = new Map(); this.moved = 0; this.pinch = 0;
    this.onClick = null;
    // Vol libre : le point de focus devient un point de l'espace, déplacé aux touches ; la caméra reste à `dist` derrière lui.
    this.libre = false; this.unit = 1; this.touches = new Set(); this.boutons = new Set(); this.vitesse = 1; this.vitesseRef = 1e-3; this.onLibre = null;
    dom.addEventListener('keyup', (e) => this.touches.delete(e.code));
    dom.addEventListener('blur', () => this.touches.clear());
    this.reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; // transitions de caméra instantanées
    dom.addEventListener('keydown', (e) => this.key(e));
    dom.addEventListener('pointerdown', (e) => this.down(e));
    dom.addEventListener('pointermove', (e) => this.move(e));
    dom.addEventListener('pointerup', (e) => this.up(e));
    dom.addEventListener('pointercancel', (e) => this.up(e, true));
    dom.addEventListener('wheel', (e) => { e.preventDefault(); if (this.enabled) this.zoom(e.deltaY * 0.0011); }, { passive: false });
    dom.addEventListener('dblclick', (e) => this.onDouble && this.onDouble(e.clientX, e.clientY));
  }
  /** Clavier (la vue 3D est focalisable) : flèches = tourner (Maj : plus vite), +/− ou Page haut/bas = zoom. */
  key(e) {
    if (!this.enabled || e.ctrlKey || e.metaKey || e.altKey) return;
    if (this.libre && ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyC', 'ShiftLeft', 'ShiftRight'].includes(e.code)) { this.touches.add(e.code); e.preventDefault(); return; }
    const k = e.key, step = e.shiftKey ? 0.25 : 0.08;
    if (k === 'ArrowLeft') this.az += step; else if (k === 'ArrowRight') this.az -= step;
    else if (k === 'ArrowUp') this.el = Math.min(1.55, this.el + step); else if (k === 'ArrowDown') this.el = Math.max(-1.55, this.el - step);
    else if (k === '+' || k === '=' || k === 'PageUp') this.zoom(-0.25); else if (k === '-' || k === '_' || k === 'PageDown') this.zoom(0.25);
    else return;
    e.preventDefault();
  }
  zoom(dl) {
    if (this.libre) { this.vitesse = Math.max(0.02, Math.min(60, this.vitesse * Math.exp(-dl * 2.2))); return; } // en vol libre, la molette règle la vitesse
    this.logTarget = Math.max(Math.log(this.minDist), Math.min(Math.log(this.maxDist), this.logTarget + dl)); }
  down(e) {
    if (!this.enabled) return;
    this.dom.setPointerCapture(e.pointerId);
    this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.moved = 0;
    if (this.ptrs.size === 2) { const [a, b] = [...this.ptrs.values()]; this.pinch = Math.hypot(a.x - b.x, a.y - b.y); }
  }
  move(e) {
    if (!this.enabled) return;
    const p = this.ptrs.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    this.moved += Math.abs(dx) + Math.abs(dy);
    if (this.ptrs.size === 1) {
      this.az -= dx * 0.0055;
      this.el = Math.max(-1.55, Math.min(1.55, this.el + dy * 0.0055));
    } else if (this.ptrs.size === 2) {
      const [a, b] = [...this.ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pinch) this.zoom(-Math.log(d / this.pinch) * 1.0);
      this.pinch = d;
    }
  }
  up(e, cancel) {
    if (!this.enabled) { this.ptrs.delete(e.pointerId); return; }
    const was = this.ptrs.has(e.pointerId);
    this.ptrs.delete(e.pointerId);
    if (this.ptrs.size < 2) this.pinch = 0;
    if (was && !cancel && this.moved < 6 && this.onClick) this.onClick(e.clientX, e.clientY);
  }
  /** Change de cible ; la position de focus glisse de façon continue pendant `dur` secondes. */
  focus(idx, targetPos, radiusUnits, dist) {
    if (this.libre) this.sortirLibre();
    const prev = this.focusAbs.slice();
    this.focusIdx = idx;
    this.trans = { s: 0, dur: this.reduced ? 0.01 : 1.6, off: [prev[0] - targetPos[0], prev[1] - targetPos[1], prev[2] - targetPos[2]] };
    this.minDist = Math.max(1e-3, radiusUnits * 1.25);
    this.logTarget = Math.log(Math.max(this.minDist, dist));
  }
  setMinDist(r) { this.minDist = Math.max(1e-3, r * 1.25); if (this.logTarget < Math.log(this.minDist)) this.logTarget = Math.log(this.minDist); }
  /** Position absolue de la caméra (UA). */
  positionCamera() {
    const c = Math.cos(this.el), d = this.dist / this.unit;
    return [this.focusAbs[0] + d * c * Math.cos(this.az), this.focusAbs[1] + d * c * Math.sin(this.az), this.focusAbs[2] + d * Math.sin(this.el)];
  }
  /** Passe en vol libre à l'endroit où se trouve la caméra, en gardant son orientation. */
  entrerLibre() {
    if (this.libre) return;
    const cam = this.positionCamera(), c = Math.cos(this.el), avant = [-c * Math.cos(this.az), -c * Math.sin(this.az), -Math.sin(this.el)], d = 20 / this.unit;
    this.libre = true; this.trans = null; this.touches.clear(); this.boutons.clear();
    for (let k = 0; k < 3; k++) this.focusAbs[k] = cam[k] + avant[k] * d;
    this.minDist = 1e-3; this.logD = this.logTarget = Math.log(20); this.dist = 20;
    this.onLibre?.(true);
  }
  sortirLibre() { if (!this.libre) return; this.libre = false; this.touches.clear(); this.boutons.clear(); this.onLibre?.(false); }
  /** Déplacement en vol libre : la vitesse suit la distance au corps le plus proche (on freine près d'un astre, on file dans le vide). */
  deplacer(dt) {
    const t = this.touches, b = this.boutons, on = (code, nom) => (t.has(code) || b.has(nom) ? 1 : 0);
    const av = on('KeyW', 'avant') - on('KeyS', 'arriere'), la = on('KeyD', 'droite') - on('KeyA', 'gauche'), hau = on('Space', 'haut') - on('KeyC', 'bas');
    if (!av && !la && !hau) return;
    const c = Math.cos(this.el), f = [-c * Math.cos(this.az), -c * Math.sin(this.az), -Math.sin(this.el)], r = [f[1], -f[0], 0], rn = Math.hypot(r[0], r[1]) || 1;
    const boost = t.has('ShiftLeft') || t.has('ShiftRight') ? 6 : 1, v = this.vitesseRef * 0.5 * this.vitesse * boost * dt;
    for (let k = 0; k < 3; k++) this.focusAbs[k] += (f[k] * av + (r[k] / rn) * la + (k === 2 ? hau : 0)) * v;
  }
  update(dt, targetPos, unit) {
    if (this.libre) {
      this.deplacer(dt);
      const c = Math.cos(this.el), d = this.dist;
      this.camera.up.set(0, 0, 1);
      this.camera.position.set(d * c * Math.cos(this.az), d * c * Math.sin(this.az), d * Math.sin(this.el));
      this.camera.lookAt(0, 0, 0); this.camera.updateMatrixWorld();
      return;
    }
    let w = 0;
    if (this.trans) { this.trans.s += dt / this.trans.dur; w = 1 - ease(this.trans.s); if (this.trans.s >= 1) this.trans = null; }
    for (let k = 0; k < 3; k++) this.focusAbs[k] = targetPos[k] + (this.trans ? this.trans.off[k] * w : 0);
    const rate = this.reduced ? 1e3 : this.trans ? 3.2 : 11;
    this.logD += (this.logTarget - this.logD) * (1 - Math.exp(-dt * rate));
    this.dist = Math.exp(this.logD);
    const c = Math.cos(this.el), d = this.dist;
    this.camera.up.set(0, 0, 1);
    this.camera.position.set(d * c * Math.cos(this.az), d * c * Math.sin(this.az), d * Math.sin(this.el));
    this.camera.lookAt(0, 0, 0);
    this.camera.updateMatrixWorld();
    void unit;
  }
}
