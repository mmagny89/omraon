// Flux commerciaux sur la scène 3D : un point par convoi en vol (coloré par marchandise) et des rubans entre sites dont la largeur
// croît avec le volume livré. Les extrémités suivent les sites réels à chaque instant ; le profil de vitesse est accélération puis
// freinage à intensité constante (le repos moteur des longs vols n'est pas rendu). Rendu seulement : aucun effet sur la physique.
import * as THREE from 'three';

const MAX_V = 8000, MAX_R = 60;
export const COULEURS_BIENS = { eau: '#6fb4ff', carburant: '#ff9a6b', minerai: '#b08968', metaux: '#c9d1d9', vivres: '#b8f060', equipements: '#f2d95c', luxe: '#f78fd0', tyts: '#6fd3a0' };
export const COULEUR_CONTREBANDE = '#ff4d5e';

export class FluxLayer {
  constructor(world, unit) {
    this.w = world; this.unit = unit; this.data = null; this.mode = 'tout';
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_V * 3), 3));
    pg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX_V * 3), 3));
    this.pts = new THREE.Points(pg, new THREE.PointsMaterial({ size: 7, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, depthTest: true }));
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_R * 6 * 3), 3));
    rg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX_R * 6 * 3), 3));
    this.rub = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false, depthTest: true, side: THREE.DoubleSide }));
    for (const o of [this.rub, this.pts]) { o.frustumCulled = false; o.renderOrder = 6; o.visible = false; world.scene.add(o); }
    this.tmp = { a: new THREE.Vector3(), b: new THREE.Vector3(), v: new THREE.Vector3(), n: new THREE.Vector3(), c: new THREE.Color() };
  }

  /** data : { t0, voyages: [{from,to,tDep,tArr,couleur}], routes: [{from,to,vol,couleur}] } ; mode : 'tout' | 'convois' | 'routes' | 'aucun'. */
  set(data, mode = this.mode) {
    this.data = data; this.mode = mode; this.cache = null;
    if (data) {
      this.vc = data.voyages.map((v) => this.tmp.c.set(v.couleur).toArray());
      const vmax = Math.max(1e-9, ...data.routes.map((r) => r.vol));
      this.rc = data.routes.slice(0, MAX_R).map((r) => ({ ...r, px: 1.5 + 6 * Math.sqrt(r.vol / vmax), rgb: this.tmp.c.set(r.couleur).toArray() }));
    }
    this.applyMode();
  }

  applyMode() {
    const on = !!this.data;
    this.pts.visible = on && (this.mode === 'tout' || this.mode === 'convois');
    this.rub.visible = on && (this.mode === 'tout' || this.mode === 'routes');
  }

  setMode(m) { this.mode = m; this.applyMode(); }

  update(tr, fa) {
    if (!this.data || (!this.pts.visible && !this.rub.visible)) return;
    const { siteEls, camera: cam } = this.w, U = this.unit, sites = (id) => siteEls.get(id)?.st?.pos;
    if (this.pts.visible) {
      const pos = this.pts.geometry.attributes.position.array, col = this.pts.geometry.attributes.color.array, tau = tr - this.data.t0, vs = this.data.voyages;
      let n = 0;
      for (let i = 0; i < vs.length && n < MAX_V; i++) {
        const v = vs[i]; if (tau < v.tDep || tau >= v.tArr) continue;
        const A = sites(v.from), B = sites(v.to); if (!A || !B) continue;
        const p = (tau - v.tDep) / (v.tArr - v.tDep), s = p < 0.5 ? 2 * p * p : 1 - 2 * (1 - p) * (1 - p);
        for (let k = 0; k < 3; k++) { pos[3 * n + k] = (A[k] + (B[k] - A[k]) * s - fa[k]) * U; col[3 * n + k] = this.vc[i][k]; }
        n++;
      }
      this.pts.geometry.setDrawRange(0, n); this.pts.geometry.attributes.position.needsUpdate = true; this.pts.geometry.attributes.color.needsUpdate = true;
    }
    if (this.rub.visible) {
      const pos = this.rub.geometry.attributes.position.array, col = this.rub.geometry.attributes.color.array, { a, b, v, n } = this.tmp;
      const pxPerRad = this.w.h / (2 * Math.tan((cam.fov * Math.PI) / 360));
      let m = 0;
      for (const r of this.rc) {
        const A = sites(r.from), B = sites(r.to); if (!A || !B) continue;
        a.set((A[0] - fa[0]) * U, (A[1] - fa[1]) * U, (A[2] - fa[2]) * U); b.set((B[0] - fa[0]) * U, (B[1] - fa[1]) * U, (B[2] - fa[2]) * U);
        const d = b.clone().sub(a); if (d.lengthSq() < 1e-12) continue;
        v.copy(cam.position).sub(a.clone().add(b).multiplyScalar(0.5)); n.copy(d).cross(v);
        if (n.lengthSq() < 1e-18) continue;
        // largeur constante à l'écran : demi-largeur monde proportionnelle à la distance de chaque extrémité à la caméra (bornée, pour qu'un bout proche ne gonfle pas)
        n.normalize();
        const dm = v.length(), wA = (r.px * Math.min(cam.position.distanceTo(a), dm * 3)) / pxPerRad / 2, wB = (r.px * Math.min(cam.position.distanceTo(b), dm * 3)) / pxPerRad / 2;
        const q = [[a, -wA], [a, wA], [b, wB], [a, -wA], [b, wB], [b, -wB]];
        for (let k = 0; k < 6; k++) { const [P, w] = q[k], o = 18 * m + 3 * k; pos[o] = P.x + w * n.x; pos[o + 1] = P.y + w * n.y; pos[o + 2] = P.z + w * n.z; col[o] = r.rgb[0]; col[o + 1] = r.rgb[1]; col[o + 2] = r.rgb[2]; }
        m++;
      }
      this.rub.geometry.setDrawRange(0, m * 6); this.rub.geometry.attributes.position.needsUpdate = true; this.rub.geometry.attributes.color.needsUpdate = true;
    }
  }
}
