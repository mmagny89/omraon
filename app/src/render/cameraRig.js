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
    this.ptrs = new Map(); this.moved = 0; this.pinch = 0;
    this.onClick = null;
    dom.addEventListener('pointerdown', (e) => this.down(e));
    dom.addEventListener('pointermove', (e) => this.move(e));
    dom.addEventListener('pointerup', (e) => this.up(e));
    dom.addEventListener('pointercancel', (e) => this.up(e, true));
    dom.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom(e.deltaY * 0.0011); }, { passive: false });
    dom.addEventListener('dblclick', (e) => this.onDouble && this.onDouble(e.clientX, e.clientY));
  }
  zoom(dl) { this.logTarget = Math.max(Math.log(this.minDist), Math.min(Math.log(this.maxDist), this.logTarget + dl)); }
  down(e) {
    this.dom.setPointerCapture(e.pointerId);
    this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.moved = 0;
    if (this.ptrs.size === 2) { const [a, b] = [...this.ptrs.values()]; this.pinch = Math.hypot(a.x - b.x, a.y - b.y); }
  }
  move(e) {
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
    const was = this.ptrs.has(e.pointerId);
    this.ptrs.delete(e.pointerId);
    if (this.ptrs.size < 2) this.pinch = 0;
    if (was && !cancel && this.moved < 6 && this.onClick) this.onClick(e.clientX, e.clientY);
  }
  /** Change de cible ; la position de focus glisse de façon continue pendant `dur` secondes. */
  focus(idx, targetPos, radiusUnits, dist) {
    const prev = this.focusAbs.slice();
    this.focusIdx = idx;
    this.trans = { s: 0, dur: 1.6, off: [prev[0] - targetPos[0], prev[1] - targetPos[1], prev[2] - targetPos[2]] };
    this.minDist = Math.max(1e-3, radiusUnits * 1.25);
    this.logTarget = Math.log(Math.max(this.minDist, dist));
  }
  setMinDist(r) { this.minDist = Math.max(1e-3, r * 1.25); if (this.logTarget < Math.log(this.minDist)) this.logTarget = Math.log(this.minDist); }
  update(dt, targetPos, unit) {
    let w = 0;
    if (this.trans) { this.trans.s += dt / this.trans.dur; w = 1 - ease(this.trans.s); if (this.trans.s >= 1) this.trans = null; }
    for (let k = 0; k < 3; k++) this.focusAbs[k] = targetPos[k] + (this.trans ? this.trans.off[k] * w : 0);
    const rate = this.trans ? 3.2 : 11;
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
