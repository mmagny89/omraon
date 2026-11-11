import * as THREE from 'three';
import { makeNoise } from './noise.js';
import { glowTexture } from './textures.js';
import { computeSky } from '../physics/sky.js';
import { AU_KM } from '../physics/constants.js';

const D = 1e8; // distance des astres dans la scène (m) ; ils sont mis à leur diamètre angulaire réel
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (x) => x * x * (3 - 2 * x);
const mixC = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

import { horizonDistance, surfaceDrop } from '../physics/horizon.js';

const PALETTES = {
  kebet: { lo: [0.12, 0.3, 0.1], hi: [0.6, 0.55, 0.22], amp: 7, scale: 400, fog: true },
  sethis: { lo: [0.4, 0.22, 0.11], hi: [0.78, 0.56, 0.33], amp: 4, scale: 260 },
  kalpra: { lo: [0.06, 0.055, 0.055], hi: [0.28, 0.2, 0.16], amp: 2, scale: 140 },
  rock: { lo: [0.2, 0.2, 0.21], hi: [0.55, 0.54, 0.52], amp: 1.6, scale: 90 },
  ice: { lo: [0.62, 0.76, 0.88], hi: [0.96, 0.98, 1], amp: 2.2, scale: 110 },
  cloud: { lo: [0.8, 0.62, 0.4], hi: [1, 0.96, 0.88], amp: 28, scale: 3500, fog: true },
};
const paletteFor = (body, site) => (site.type === 'floating' ? PALETTES.cloud : { kebet: PALETTES.kebet, sethis: PALETTES.sethis, kalpra: PALETTES.kalpra, ice: PALETTES.ice }[body.def.texture] || PALETTES.rock);
const ATM_COLORS = { // [zénith jour, horizon jour]
  earth: [[0.22, 0.45, 0.8], [0.62, 0.78, 0.94]], gas: [[0.45, 0.33, 0.2], [0.85, 0.68, 0.46]], thin: [[0.3, 0.26, 0.22], [0.55, 0.46, 0.36]], none: [[0, 0, 0], [0, 0, 0]],
};

export class GroundView {
  constructor(world) {
    this.world = world; this.active = false; this.yaw = 0; this.pitch = 0; this.fov = 70;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x000000);
    this.camera = new THREE.PerspectiveCamera(this.fov, 1, 0.05, 5e11);
    this.sun = new THREE.DirectionalLight(0xfff2e0, 3); this.shine = new THREE.DirectionalLight(0xffe2b0, 0); this.amb = new THREE.AmbientLight(0xffffff, 0.02);
    this.scene.add(this.sun, this.sun.target, this.shine, this.shine.target, this.amb);
    this.sphere = new THREE.SphereGeometry(1, 64, 32).rotateX(Math.PI / 2);
    // dôme du ciel (couleurs mises à jour à chaque image)
    this.domeGeo = new THREE.SphereGeometry(5e10, 48, 24);
    this.domeGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.domeGeo.attributes.position.count * 3), 3));
    this.dome = new THREE.Mesh(this.domeGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false, fog: false }));
    this.scene.add(this.dome);
    // étoiles lointaines
    const n = 2000, p = new Float32Array(3 * n); let s = 4242; const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < n; i++) { const z = 2 * r() - 1, a = r() * 6.2832, q = Math.sqrt(1 - z * z); p[3 * i] = 4e10 * q * Math.cos(a); p[3 * i + 1] = 4e10 * z; p[3 * i + 2] = 4e10 * q * Math.sin(a); }
    this.stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(p, 3)), new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, color: 0xffffff, transparent: true, depthWrite: false, fog: false }));
    this.scene.add(this.stars);
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })); this.scene.add(this.glow);
    this.bodyMeshes = new Map(); this.terrain = null; this.extra = [];
    this.showNames = false; this.showCards = true; this.lbl = new Map(); this.tmpV = new THREE.Vector3(); this.porthole = false;
    this.noise = makeNoise(77);
    // saisie (souris, tactile)
    const cv = world.canvas; this.ptrs = new Map();
    cv.addEventListener('pointerdown', (e) => { if (!this.active) return; cv.setPointerCapture(e.pointerId); this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); this.pinch = 0; if (this.ptrs.size === 2) { const [a, b] = [...this.ptrs.values()]; this.pinch = Math.hypot(a.x - b.x, a.y - b.y); } });
    cv.addEventListener('pointermove', (e) => {
      if (!this.active) return; const q = this.ptrs.get(e.pointerId); if (!q) return;
      const dx = e.clientX - q.x, dy = e.clientY - q.y; q.x = e.clientX; q.y = e.clientY;
      if (this.ptrs.size === 1) { const k = this.fov * Math.PI / 180 / world.h; this.yaw -= dx * k; this.pitch = clamp(this.pitch + dy * k, -1.5, 1.5); }
      else if (this.ptrs.size === 2) { const [a, b] = [...this.ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (this.pinch) this.fov = clamp(this.fov * this.pinch / d, 20, 110); this.pinch = d; }
    });
    const up = (e) => this.ptrs.delete(e.pointerId); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', (e) => { if (!this.active) return; e.preventDefault(); this.fov = clamp(this.fov * Math.exp(e.deltaY * 0.001), 20, 110); }, { passive: false });
  }

  clearExtras() {
    for (const o of this.extra) { this.scene.remove(o); o.geometry?.dispose(); o.material?.dispose?.(); }
    this.extra = []; this.terrain = null; this.scene.fog = null;
  }

  /** Terrain polaire : anneaux géométriques, courbure réelle du monde (R), relief par bruit. Unités : mètres, œil en y = 0. */
  buildTerrain(R, eye, pal, seedShift = 0) {
    const h0 = horizonDistance(R, eye), L = clamp(h0 * 3, 3000, 1.5e6), rings = 110, sectors = 120, r0 = 0.6;
    const pos = new Float32Array((rings + 1) * sectors * 3), col = new Float32Array((rings + 1) * sectors * 3), idx = [];
    for (let k = 0; k <= rings; k++) {
      const r = r0 * Math.pow(L / r0, k / rings), amp = pal.amp * clamp(r / 40, 0, 1) * (1 - 0.7 * clamp(r / L, 0, 1));
      for (let j = 0; j < sectors; j++) {
        const a = (j / sectors) * Math.PI * 2, x = r * Math.cos(a), z = r * Math.sin(a), i = (k * sectors + j) * 3;
        const n1 = this.noise.fbm(x / pal.scale + seedShift, 0.5, z / pal.scale, 5), n2 = this.noise.noise(x / (pal.scale / 9), 3.3, z / (pal.scale / 9));
        pos[i] = x; pos[i + 1] = -eye - surfaceDrop(R, r) + amp * n1; pos[i + 2] = z;
        const t = clamp(0.5 + 0.7 * n1 + 0.15 * n2, 0, 1), c = mixC(pal.lo, pal.hi, t);
        col[i] = c[0]; col[i + 1] = c[1]; col[i + 2] = c[2];
      }
    }
    for (let k = 0; k < rings; k++) for (let j = 0; j < sectors; j++) { const a = k * sectors + j, b = k * sectors + (j + 1) % sectors, c = (k + 1) * sectors + j, d = (k + 1) * sectors + (j + 1) % sectors; idx.push(a, b, c, b, d, c); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 })); m.frustumCulled = false; this.scene.add(m); this.extra.push(m); this.terrain = m;
    return { horizon: h0, L };
  }

  enter(site, st, siteEls) {
    this.site = site; this.st = st; this.active = true; this.clearExtras();
    const w = this.world, sim = w.sim, body = site.type === 'heliocentric' ? null : sim.bodies[st.idx];
    this.body = body; this.R = body ? body.radiusKm * 1000 : 0;
    this.eye = site.type === 'floating' ? 1.7 : 1.7;
    if (body && (site.type === 'surface' || site.type === 'floating')) {
      const pal = paletteFor(body, site), info = this.buildTerrain(this.R, this.eye, pal, st.idx * 13.7);
      this.horizon = info.horizon; this.pal = pal;
      if (site.type === 'floating') { // plate-forme de la cité au-dessus du plafond nuageux : le sol est à 150 m plus bas
        this.terrain.position.y -= 150;
        const plat = new THREE.Mesh(new THREE.CylinderGeometry(24, 24, 0.5, 48), new THREE.MeshStandardMaterial({ color: 0x555a60, roughness: 0.8, metalness: 0.4 })); plat.position.y = -this.eye - 0.25; this.scene.add(plat); this.extra.push(plat);
        const rail = new THREE.Mesh(new THREE.TorusGeometry(23.5, 0.08, 8, 64), new THREE.MeshStandardMaterial({ color: 0xcdd2d8, roughness: 0.4, metalness: 0.7 })); rail.rotation.x = Math.PI / 2; rail.position.y = -this.eye + 1.0; this.scene.add(rail); this.extra.push(rail);
      }
    } else this.horizon = null;
    // orientation initiale : vers l'étoile si elle est levée, sinon vers la planète parente
    this.yaw = 0; this.pitch = site.type === 'orbit' ? -0.2 : 0.05; this.initDone = false;
    this.porthole = site.type === 'orbit';
    this.world.rig.enabled = false;
  }

  exit() { for (const el of this.lbl.values()) el.remove(); this.lbl.clear(); this.active = false; this.clearExtras(); this.world.rig.enabled = true; for (const m of this.bodyMeshes.values()) this.scene.remove(m); this.bodyMeshes.clear(); }

  lookAt(kind) { this.pendingLook = kind; }

  update() {
    const w = this.world, sim = w.sim, site = this.site, st = w.siteEls.get(site.id)?.st; if (!st) return null;
    const sky = computeSky(sim, site, st), { east, north, up } = sky.frame;
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const toScene = (v) => new THREE.Vector3(dot(v, east), dot(v, up), -dot(v, north)); // x est, y haut, z = −nord
    const atmKind = !this.body ? 'none' : this.body.def.kind === 'gas' ? 'gas' : (this.body.def.habitat?.pressureBar ?? 0) >= 0.3 ? 'earth' : (this.body.def.habitat?.pressureBar ?? 0) > 0 ? 'thin' : 'none';
    const star = sky.objs.find((o) => o.type === 'star'), sunDeg = sky.sunEl * 180 / Math.PI;
    const ecl = sky.eclipse ? sky.eclipse.fraction : 0;
    // regard initial
    if (!this.initDone || this.pendingLook) {
      const kind = this.pendingLook || 'auto'; this.pendingLook = null; this.initDone = true;
      const parent = sky.objs.find((o) => o.name === (this.body?.type === 'moon' ? sim.bodies[this.body.parent].def.name : null));
      const tgt = kind === 'north' ? { az: 0 } : kind === 'parent' && parent ? parent : kind === 'star' ? star : (star && star.el > -0.05 ? star : parent || star);
      this.yaw = -(tgt.az || 0); if (kind !== 'auto') this.pitch = clamp(this.site.type === 'orbit' ? -0.2 : 0.05 + (tgt.el > 0.1 ? Math.min(tgt.el, 0.9) * 0.6 : 0), -1.2, 1.2);
    }
    // astres
    const seen = new Set(), M = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), Mbasis = new THREE.Matrix4().makeBasis(toScene([1, 0, 0]), toScene([0, 1, 0]), toScene([0, 0, 1])), Mq = new THREE.Quaternion().setFromRotationMatrix(Mbasis);
    for (const o of sky.objs) {
      seen.add(o.idx); const src = w.bodies[o.idx];
      let m = this.bodyMeshes.get(o.idx);
      if (!m) {
        const map = src.mesh.material.map;
        m = new THREE.Mesh(this.sphere, o.type === 'star' ? new THREE.MeshBasicMaterial({ color: 0xfff6e8, fog: false }) : new THREE.MeshStandardMaterial({ fog: false, map, roughness: 1, metalness: 0, color: map ? 0xffffff : new THREE.Color(o.color), emissiveMap: src.mesh.material.emissiveMap || null, emissive: src.mesh.material.emissiveMap ? 0xffffff : 0x000000, emissiveIntensity: 0.6 }));
        m.frustumCulled = false; this.scene.add(m); this.bodyMeshes.set(o.idx, m);
      }
      const dir = toScene(o.d).normalize(), r = Math.max(D * Math.tan(o.angR), 1);
      m.position.copy(dir).multiplyScalar(D); m.scale.set(r, r, r * (1 - (src.flat || 0)));
      tmpQ.copy(src.mesh.quaternion); m.quaternion.copy(Mq).multiply(tmpQ);
    }
    for (const [i, m] of this.bodyMeshes) if (!seen.has(i) && !(this.site.type === 'orbit' && i === st.idx)) m.visible = false; else m.visible = true;
    // le corps sous la station : sphère réelle sous l'observateur
    if (this.site.type === 'orbit' && this.body) {
      const i = st.idx; let m = this.bodyMeshes.get(i); const src = w.bodies[i];
      if (!m) { const map = src.mesh.material.map; m = new THREE.Mesh(this.sphere, new THREE.MeshStandardMaterial({ fog: false, map, roughness: 1, metalness: 0, emissiveMap: src.mesh.material.emissiveMap || null, emissive: src.mesh.material.emissiveMap ? 0xffffff : 0x000000, emissiveIntensity: 0.6 })); m.frustumCulled = false; this.scene.add(m); this.bodyMeshes.set(i, m); }
      m.position.copy(toScene([-up[0], -up[1], -up[2]]).multiplyScalar(st.radiusKm * 1000)); m.scale.set(this.R, this.R, this.R * (1 - (src.flat || 0)));
      m.quaternion.copy(Mq).multiply(tmpQ.copy(src.mesh.quaternion)); m.visible = true;
    }
    // lumière
    if (star) {
      const sd = toScene(star.d).normalize(); this.sun.position.copy(sd).multiplyScalar(1000); this.sun.target.position.set(0, 0, 0);
      this.sun.intensity = 3.2 * (1 - ecl);
      this.glow.position.copy(sd).multiplyScalar(D * 0.9); const gs = D * 0.9 * Math.tan(star.angR) * (atmKind === 'none' ? 14 : 40) * (1 - ecl * 0.9); this.glow.scale.set(gs, gs, 1); this.glow.material.opacity = (atmKind === 'none' ? 0.55 : 0.9) * (1 - ecl);
    }
    // lumière de la planète parente (planet-shine) : la nuit, Zirkan éclaire le sol
    const parent = this.body?.type === 'moon' ? sky.objs.find((o) => o.name === sim.bodies[this.body.parent].def.name) : null;
    if (parent) {
      const pd = toScene(parent.d).normalize(); this.shine.position.copy(pd).multiplyScalar(1000); this.shine.target.position.set(0, 0, 0);
      this.shine.color.set(parent.color); this.shine.intensity = 3.2 * (sim.bodies[parent.idx].def.albedo ?? 0.4) * parent.angR * parent.angR * parent.frac * 4;
    } else this.shine.intensity = 0;
    // ciel
    const day = atmKind === 'none' ? 0 : clamp((sunDeg + 6) / 16, 0, 1) * (atmKind === 'thin' ? 0.55 : 1) * (1 - ecl * 0.85);
    const [zen, hor] = ATM_COLORS[atmKind], sunDir = star ? toScene(star.d).normalize() : new THREE.Vector3(0, 1, 0);
    const pa = this.domeGeo.attributes.position, ca = this.domeGeo.attributes.color, v = new THREE.Vector3();
    const twi = atmKind === 'none' ? 0 : clamp(1 - Math.abs(sunDeg) / 10, 0, 1) * (1 - ecl);
    for (let i = 0; i < pa.count; i++) {
      v.set(pa.getX(i), pa.getY(i), pa.getZ(i)).normalize();
      const e = Math.asin(v.y), k = smooth(clamp(e / 0.9, 0, 1));
      let c = mixC(mixC([0.005, 0.007, 0.016], hor, day), mixC([0.002, 0.003, 0.01], zen, day), k);
      if (twi > 0) { const g = Math.exp(-Math.pow(Math.acos(clamp(v.dot(sunDir), -1, 1)) / 0.55, 2)) * twi * (1 - 0.6 * k); c = [c[0] + 1.0 * g, c[1] + 0.5 * g, c[2] + 0.18 * g]; }
      ca.setXYZ(i, c[0], c[1], c[2]);
    }
    ca.needsUpdate = true;
    this.stars.material.opacity = clamp(1 - day * 1.4, 0, 1); this.stars.visible = this.stars.material.opacity > 0.02;
    this.amb.intensity = atmKind === 'none' ? 0.012 : 0.04 + 0.7 * day;
    // brume
    if (atmKind !== 'none' && this.terrain) { const hc = mixC([0.01, 0.012, 0.02], hor, day); const col = new THREE.Color(hc[0], hc[1], hc[2]); this.scene.fog = new THREE.Fog(col, 50, Math.max(this.horizon || 5000, 3000) * (atmKind === 'earth' ? 3 : 2)); } else this.scene.fog = null;
    // caméra
    // hublot : le champ choisi s'étend sur le diamètre de la fenêtre circulaire, pas sur tout l'écran
    const Rpx = this.porthole ? Math.min(0.36 * innerHeight, 0.4 * innerWidth) : 0;
    this.camera.fov = this.porthole ? (2 * Math.atan(Math.tan(this.fov * Math.PI / 360) * w.h / (2 * Rpx)) * 180) / Math.PI : this.fov;
    this.camera.aspect = w.w / w.h; this.camera.updateProjectionMatrix();
    const cp = Math.cos(this.pitch); this.camera.position.set(0, 0, 0);
    this.camera.lookAt(Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
    this.camera.updateMatrixWorld(); this.placeLabels(sky, toScene);
    return { sky, sunDeg, atmKind, azimuth: ((this.yaw * 180 / Math.PI) % 360 + 360) % 360, eclipse: sky.eclipse };
  }

  /** Étiquettes HTML : points cardinaux sur l'horizon et noms des astres (à la demande). */
  placeLabels(sky, toScene) {
    const host = document.getElementById('gh-labels'); if (!host) return;
    const w = this.world, W = w.w, H = w.h, cam = this.camera, used = new Set(), v = this.tmpV;
    const Rp = this.porthole ? Math.min(0.36 * innerHeight, 0.4 * innerWidth) : 0;
    const put = (key, text, cls, p3, dy = 0) => {
      let el = this.lbl.get(key);
      if (!el) { el = document.createElement('div'); el.className = 'gh-lbl ' + cls; el.textContent = text; host.appendChild(el); this.lbl.set(key, el); }
      v.copy(p3).project(cam); const sx = (v.x * 0.5 + 0.5) * W, sy = (-v.y * 0.5 + 0.5) * H + dy;
      let ok = v.z < 1 && v.z > -1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
      if (ok && this.porthole && Math.hypot(sx - W / 2, sy - H / 2) > Rp - 16) ok = false; // hors de la fenêtre
      el.style.display = ok ? '' : 'none'; if (ok) el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, 0)`; used.add(key);
    };
    if (this.showCards) ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'].forEach((n, i) => { const a = (i * Math.PI) / 4; put('c' + n, n, i % 2 ? 'card minor' : 'card', new THREE.Vector3(Math.sin(a) * 1000, 35, -Math.cos(a) * 1000)); });
    if (this.showNames) {
      const ppr = H / (2 * Math.tan((cam.fov * Math.PI) / 360));
      for (const o of sky.objs) put('b' + o.idx, o.name, 'body', toScene(o.d).normalize().multiplyScalar(D), o.angR * ppr + 6);
      if (this.porthole && this.body) put('own', this.body.def.name, 'body', new THREE.Vector3(0, -1000, 0), 4);
    }
    for (const [k, el] of this.lbl) if (!used.has(k)) el.style.display = 'none';
  }

  render() { this.world.renderer.render(this.scene, this.camera); }
}
void AU_KM;
