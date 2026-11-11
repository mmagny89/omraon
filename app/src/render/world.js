import * as THREE from 'three';
import { AU_KM, DEG, TWO_PI, G } from '../physics/constants.js';
import { stateToElements, ellipsePoints } from '../physics/kepler.js';
import { poleVector } from '../physics/system.js';
import { makeBodyTexture, makeCloudTexture, glowTexture } from './textures.js';
import { CameraRig } from './cameraRig.js';
import { SYSTEM_EDGE_AU } from '../data/omraon.js';
import { siteState } from '../physics/sites.js';

export const UNIT = AU_KM / 1000; // 1 unité de scène = 1000 km
const ORBIT_PTS = 257;
const frac = (x) => x - Math.floor(x);

const atmVert = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vWN; varying vec3 vWP;
void main(){
  vWN = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position,1.0); vWP = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}`;
const atmFrag = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uColor; uniform vec3 uSun; uniform float uStrength;
varying vec3 vWN; varying vec3 vWP;
void main(){
  #include <logdepthbuf_fragment>
  vec3 n = normalize(vWN); vec3 v = normalize(cameraPosition - vWP);
  float f = pow(1.0 - abs(dot(n, v)), 2.6);
  float lit = clamp(dot(n, normalize(uSun)) * 0.9 + 0.35, 0.0, 1.0);
  gl_FragColor = vec4(uColor, f * lit * uStrength);
}`;

export class World {
  constructor(canvas, sim, labelsEl) {
    this.sim = sim; this.canvas = canvas; this.labelsEl = labelsEl;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x02030a);
    this.camera = new THREE.PerspectiveCamera(45, 1, 1e-2, 3e8);
    this.rig = new CameraRig(canvas, this.camera);
    this.opts = { orbits: true, labels: true, belt: true, edge: true };
    this.bodies = [];
    this.tmp = new THREE.Vector3();
    this.q1 = new THREE.Quaternion(); this.q2 = new THREE.Quaternion(); this.q3 = new THREE.Quaternion();
    this.sphereGeo = new THREE.SphereGeometry(1, 96, 48).rotateX(Math.PI / 2);
    this.elBuf = new Float32Array(ORBIT_PTS * 3);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.05));
    this.sun = new THREE.PointLight(0xfff2e0, 1, 0, 2);
    this.scene.add(this.sun);
    this.buildStars();
    this.rig.onClick = (x, y) => { const i = this.pick(x, y); if (i >= 0 && this.onSelect) this.onSelect(i); };
    this.rig.onDouble = (x, y) => { const i = this.pick(x, y); if (i >= 0 && this.onSelect) this.onSelect(i); };
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  buildStars() {
    const n = 3500, p = new Float32Array(3 * n), c = new Float32Array(3 * n);
    let s = 12345;
    const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < n; i++) {
      const z = 2 * r() - 1, a = TWO_PI * r(), q = Math.sqrt(1 - z * z);
      p[3 * i] = 1e8 * q * Math.cos(a); p[3 * i + 1] = 1e8 * q * Math.sin(a); p[3 * i + 2] = 1e8 * z;
      const b = 0.25 + 0.75 * Math.pow(r(), 3), t = r();
      c[3 * i] = b * (0.85 + 0.15 * t); c[3 * i + 1] = b * 0.92; c[3 * i + 2] = b * (1 - 0.2 * t);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.4, sizeAttenuation: false, vertexColors: true, depthWrite: false }));
    this.stars.frustumCulled = false;
    this.scene.add(this.stars);
  }

  async build(progress) {
    const sim = this.sim, defs = sim.bodies;
    const glow = glowTexture();
    for (const b of defs) {
      progress && progress(`Génération de ${b.def.name}…`, b.idx / defs.length);
      await new Promise((r) => setTimeout(r, 0));
      const o = { b, idx: b.idx, name: b.def.name, rUnits: b.radiusKm / 1000, group: new THREE.Group() };
      const seed = 11 + b.idx * 7;
      let mat;
      if (b.type === 'star') {
        const { map } = makeBodyTexture('star', seed, 512, 256);
        mat = new THREE.MeshBasicMaterial({ map });
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(b.def.color), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
        o.glow = sp; this.scene.add(sp);
      } else {
        const big = b.def.kind === 'gas' || b.def.texture === 'kebet';
        const small = b.type === 'moon' && !big && b.radiusKm < 200;
        const tex = makeBodyTexture(b.def.texture, seed, big ? 1024 : small ? 256 : 512, big ? 512 : small ? 128 : 256, b.def.texture === 'kalpra');
        mat = new THREE.MeshStandardMaterial({ map: tex.map, roughness: 0.95, metalness: 0, emissiveMap: tex.emissive, emissive: tex.emissive ? 0xffffff : 0x000000, emissiveIntensity: 0.8 });
      }
      o.mesh = new THREE.Mesh(this.sphereGeo, mat);
      o.group.add(o.mesh);
      if (b.def.atmosphere) {
        o.atm = new THREE.Mesh(this.sphereGeo, new THREE.ShaderMaterial({
          vertexShader: atmVert, fragmentShader: atmFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
          uniforms: { uColor: { value: new THREE.Color(b.def.atmosphere.color) }, uSun: { value: new THREE.Vector3(1, 0, 0) }, uStrength: { value: b.def.atmosphere.strength } },
        }));
        o.atmScale = b.def.kind === 'gas' ? 1.035 : 1.05;
        o.group.add(o.atm);
      }
      if (b.def.clouds) {
        o.clouds = new THREE.Mesh(this.sphereGeo, new THREE.MeshStandardMaterial({ map: makeCloudTexture(seed + 3), transparent: true, depthWrite: false, roughness: 1 }));
        o.group.add(o.clouds);
      }
      this.scene.add(o.group);
      // rotation
      const r = b.def.rotation || {};
      o.phase0 = (b.idx * 1.7) % TWO_PI;
      if (r.periodH) o.protDays = r.periodH / 24;
      else if (r.spinOrbitRatio) {
        const a = b.def.orbit.a, mu = G * (sim.bodies[0].mass + sim.mass[b.idx]);
        o.protDays = TWO_PI * Math.sqrt(a ** 3 / mu) / r.spinOrbitRatio;
      }
      // aplatissement dû à la rotation
      if (o.protDays && b.type === 'planet') {
        const GM = G * sim.mass[b.idx] * (AU_KM * 1000) ** 3 / 86400 ** 2, w = TWO_PI / (o.protDays * 86400), rm = b.radiusKm * 1000;
        o.flat = (b.def.kind === 'gas' ? 0.73 : 1.0) * (w * w * rm ** 3) / GM;
      } else o.flat = 0;
      o.qFrame = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), b.node)
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), b.tilt));
      // orbite
      if (b.type !== 'star') {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ORBIT_PTS * 3), 3));
        o.line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: new THREE.Color(b.def.color), transparent: true, opacity: b.type === 'planet' ? 0.55 : 0.4, depthWrite: false }));
        o.line.frustumCulled = false; this.scene.add(o.line);
      }
      // étiquette
      const el = document.createElement('div');
      el.className = 'lbl ' + b.type; el.textContent = b.def.name;
      this.labelsEl.appendChild(el); o.label = el;
      this.bodies.push(o);
    }
    // ceinture
    const gb = new THREE.BufferGeometry();
    this.beltPos = new Float32Array(3 * 40000); this.beltCol = new Float32Array(3 * 40000);
    this.beltTmpP = new Float64Array(3 * 40000); this.beltTmpB = new Float32Array(40000);
    gb.setAttribute('position', new THREE.BufferAttribute(this.beltPos, 3).setUsage(THREE.DynamicDrawUsage));
    gb.setAttribute('color', new THREE.BufferAttribute(this.beltCol, 3).setUsage(THREE.DynamicDrawUsage));
    this.belt = new THREE.Points(gb, new THREE.PointsMaterial({ size: 1.7, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false }));
    this.belt.frustumCulled = false; this.scene.add(this.belt);
    // limite du système (≈ 35 UA, valeur provisoire du document)
    const ring = new Float32Array(ORBIT_PTS * 3);
    this.edgeRing = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(ring, 3)), new THREE.LineDashedMaterial({ color: 0x5f7aa8, transparent: true, opacity: 0.35, dashSize: 1, gapSize: 1 }));
    this.edgeRing.frustumCulled = false; this.scene.add(this.edgeRing);
    const el = document.createElement('div'); el.className = 'lbl edge'; el.textContent = `Confins · ~${SYSTEM_EDGE_AU} UA`;
    this.labelsEl.appendChild(el); this.edgeLabel = el;
    this.rebuildPosBuffers();
  }

  rebuildPosBuffers() { /* tailles fixes ; rien à faire */ }

  /** Rattache le rendu à une nouvelle simulation (mêmes corps, valeurs modifiées). */
  rebind(sim) {
    this.sim = sim;
    for (const o of this.bodies) {
      const b = sim.bodies[o.idx]; o.b = b; o.rUnits = b.radiusKm / 1000;
      const r = b.def.rotation || {};
      if (r.periodH) o.protDays = r.periodH / 24;
      else if (r.spinOrbitRatio) o.protDays = TWO_PI * Math.sqrt(b.def.orbit.a ** 3 / (G * (sim.bodies[0].mass + sim.mass[b.idx]))) / r.spinOrbitRatio;
      if (o.protDays && b.type === 'planet') {
        const GM = G * sim.mass[b.idx] * (AU_KM * 1000) ** 3 / 86400 ** 2, w = TWO_PI / (o.protDays * 86400), rm = b.radiusKm * 1000;
        o.flat = (b.def.kind === 'gas' ? 0.73 : 1.0) * (w * w * rm ** 3) / GM;
      }
      o.qFrame.setFromAxisAngle(new THREE.Vector3(0, 0, 1), b.node).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), b.tilt));
    }
    this.rig.setMinDist(this.bodies[this.rig.focusIdx].rUnits);
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.w = w; this.h = h;
  }

  absPos(idx, out = [0, 0, 0]) { const p = this.sim.rPos; out[0] = p[3 * idx]; out[1] = p[3 * idx + 1]; out[2] = p[3 * idx + 2]; return out; }

  focusOn(idx, distUnits) {
    const o = this.bodies[idx];
    const d = distUnits ?? o.rUnits * (o.b.type === 'star' ? 6 : 5);
    this.rig.focus(idx, this.absPos(idx), o.rUnits, d);
  }

  pick(cx, cy) {
    const rect = this.canvas.getBoundingClientRect(), x = cx - rect.left, y = cy - rect.top;
    let best = -1, bestScore = 1;
    for (const o of this.bodies) {
      if (!o.sx && o.sx !== 0) continue;
      const d = Math.hypot(o.sx - x, o.sy - y), thr = Math.max(18, o.pxR + 8);
      if (o.visible && d < thr && d / thr < bestScore) { bestScore = d / thr; best = o.idx; }
    }
    return best;
  }

  // ---------- Sites habités ----------
  siteCtx() {
    if (!this._siteCtx || this._siteCtx.sim !== this.sim) {
      const w = this;
      this._siteCtx = {
        sim: this.sim, ang: (i) => w.bodies[i].ang || 0, protDays: (i) => (w.bodies[i].b.type === 'moon' ? 0 : w.bodies[i].protDays || 0),
        bodyIndex: (name) => w.bodies.find((o) => o.name === name).idx, el: (i) => w.bodies[i].el,
      };
    }
    return this._siteCtx;
  }

  setSites(sites, onSelect) {
    this.siteList = sites; this.siteEls = new Map(); this.onSelectSite = onSelect;
    for (const site of sites) {
      const el = document.createElement('button');
      el.className = 'site-marker ' + site.type; el.setAttribute('aria-label', site.name); el.innerHTML = `<span>${site.name}</span>`;
      el.addEventListener('click', (e) => { e.stopPropagation(); this.onSelectSite && this.onSelectSite(site.id); });
      el.addEventListener('pointerdown', (e) => e.stopPropagation());
      this.labelsEl.appendChild(el); this.siteEls.set(site.id, { el, st: null });
    }
  }

  updateSites(tr, fa) {
    if (!this.siteList) return;
    const ctx = this.siteCtx(), cam = this.camera, v = this.tmp;
    for (const site of this.siteList) {
      const rec = this.siteEls.get(site.id), st = siteState(ctx, site, tr);
      rec.st = st;
      const o = this.bodies[st.idx];
      const rx = (st.pos[0] - fa[0]) * UNIT, ry = (st.pos[1] - fa[1]) * UNIT, rz = (st.pos[2] - fa[2]) * UNIT;
      let show = this.opts.sites !== false && (site.type === 'heliocentric' ? true : o.truePx > (site.type === 'orbit' ? 12 : 26));
      if (show && st.normal) { // face cachée du corps
        const bx = o.rel[0], by = o.rel[1], bz = o.rel[2];
        show = (rx - bx) * (cam.position.x - rx) + (ry - by) * (cam.position.y - ry) + (rz - bz) * (cam.position.z - rz) > 0;
      }
      v.set(rx, ry, rz).project(cam);
      show = show && v.z < 1 && v.z > -1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
      rec.el.style.display = show ? 'block' : 'none';
      if (show) rec.el.style.transform = `translate(${((v.x * 0.5 + 0.5) * this.w).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * this.h).toFixed(1)}px)`;
    }
  }

  /** Une image : tr = temps de simulation (jours), dt = durée réelle (s). */
  frame(tr, dt) {
    const sim = this.sim, rig = this.rig, cam = this.camera;
    sim.computeRender(tr);
    const fb = this.bodies[rig.focusIdx];
    rig.update(dt, this.absPos(rig.focusIdx));
    const fa = rig.focusAbs;
    const tanF = Math.tan(cam.fov * DEG / 2), pxPerRad = this.h / (2 * tanF);
    const rp = sim.rPos, rv = sim.rVel, N = sim.N;
    const starRel = [(rp[0] - fa[0]) * UNIT, (rp[1] - fa[1]) * UNIT, (rp[2] - fa[2]) * UNIT];
    // exposition automatique : normalise l'éclairement au niveau du corps suivi
    const dF = Math.max(1e-3, Math.hypot(rp[3 * rig.focusIdx] - rp[0], rp[3 * rig.focusIdx + 1] - rp[1], rp[3 * rig.focusIdx + 2] - rp[2])) * UNIT;
    this.sun.intensity = 1.4 * Math.PI * Math.max(dF, 1e5) ** 2;
    this.sun.position.set(starRel[0], starRel[1], starRel[2]);

    for (const o of this.bodies) {
      const i = o.idx, b = o.b;
      const rx = (rp[3 * i] - fa[0]) * UNIT, ry = (rp[3 * i + 1] - fa[1]) * UNIT, rz = (rp[3 * i + 2] - fa[2]) * UNIT;
      o.rel = [rx, ry, rz];
      const dist = Math.hypot(rx - cam.position.x, ry - cam.position.y, rz - cam.position.z);
      const pxPerUnit = pxPerRad / dist;
      const minPx = b.type === 'star' ? 5 : 2.6;
      const k = Math.max(1, minPx / (o.rUnits * pxPerUnit));
      o.pxR = o.rUnits * pxPerUnit * k; o.truePx = o.rUnits * pxPerUnit; o.scaleK = k; o.dist = dist;
      const s = o.rUnits * k;
      o.group.position.set(rx, ry, rz);
      o.mesh.scale.set(s, s, s * (1 - o.flat));
      // rotation propre
      let ang;
      if (b.type === 'moon') {
        const p = b.parent;
        ang = Math.atan2(rp[3 * i + 1] - rp[3 * p + 1], rp[3 * i] - rp[3 * p] ) + Math.PI + o.phase0 * 0; // rotation synchrone
      } else if (o.protDays) ang = o.phase0 + TWO_PI * frac(tr / o.protDays);
      else ang = o.phase0 + TWO_PI * frac(tr / 25);
      o.ang = ang;
      this.q2.setFromAxisAngle(this.tmp.set(0, 0, 1), ang);
      o.mesh.quaternion.copy(o.qFrame).multiply(this.q2);
      if (o.atm) {
        o.atm.scale.set(s * o.atmScale, s * o.atmScale, s * o.atmScale * (1 - o.flat));
        o.atm.quaternion.copy(o.qFrame);
        o.atm.material.uniforms.uSun.value.set(starRel[0] - rx, starRel[1] - ry, starRel[2] - rz);
      }
      if (o.clouds) {
        o.clouds.scale.set(s * 1.012, s * 1.012, s * 1.012);
        this.q2.setFromAxisAngle(this.tmp.set(0, 0, 1), ang * 1.0 + 0.05 * tr);
        o.clouds.quaternion.copy(o.qFrame).multiply(this.q2);
      }
      if (o.glow) {
        const px = Math.max(90, o.pxR * 7), sc = px / pxPerUnit;
        o.glow.position.set(rx, ry, rz); o.glow.scale.set(sc, sc, 1);
      }
      // éléments osculateurs
      if (b.type !== 'star') {
        const p = b.parent;
        const es = sim.elementState(i); // état exact du dernier pas, pas l'état extrapolé du rendu
        const r = es.r, v = es.v, mu = es.mu;
        o.el = stateToElements(mu, r, v);
        // orbite visible si assez grande à l'écran
        const orbR = o.el.a * UNIT * pxPerRad / Math.max(1, this.bodies[p].dist);
        const show = this.opts.orbits && orbR > (b.type === 'planet' ? 6 : 14) && o.el.e < 0.95;
        o.line.visible = show;
        if (show) {
          const prel = this.bodies[p].rel;
          const org = b.type === 'planet' ? sim.originRender(i) : [rp[3 * p], rp[3 * p + 1], rp[3 * p + 2]];
          const ox = (org[0] - fa[0]) * UNIT, oy = (org[1] - fa[1]) * UNIT, oz = (org[2] - fa[2]) * UNIT;
          void prel;
          ellipsePoints(o.el, ORBIT_PTS, this.elBuf, 0, 0, 0, UNIT);
          const arr = o.line.geometry.attributes.position.array;
          for (let q = 0; q < ORBIT_PTS; q++) { arr[3 * q] = this.elBuf[3 * q] + ox; arr[3 * q + 1] = this.elBuf[3 * q + 1] + oy; arr[3 * q + 2] = this.elBuf[3 * q + 2] + oz; }
          o.line.geometry.attributes.position.needsUpdate = true;
        }
      }
    }
    // ceinture
    const n = sim.particleRender(tr, this.beltTmpP, this.beltTmpB);
    this.belt.visible = this.opts.belt;
    if (this.opts.belt) {
      const m = Math.min(n, 40000);
      for (let i = 0; i < m; i++) {
        this.beltPos[3 * i] = (this.beltTmpP[3 * i] - fa[0]) * UNIT; this.beltPos[3 * i + 1] = (this.beltTmpP[3 * i + 1] - fa[1]) * UNIT; this.beltPos[3 * i + 2] = (this.beltTmpP[3 * i + 2] - fa[2]) * UNIT;
        const c = this.beltTmpB[i]; this.beltCol[3 * i] = c; this.beltCol[3 * i + 1] = c * 0.93; this.beltCol[3 * i + 2] = c * 0.85;
      }
      this.belt.geometry.setDrawRange(0, m);
      this.belt.geometry.attributes.position.needsUpdate = true; this.belt.geometry.attributes.color.needsUpdate = true;
    }
    // limite du système
    this.edgeRing.visible = this.opts.edge;
    if (this.opts.edge) {
      const arr = this.edgeRing.geometry.attributes.position.array, R = SYSTEM_EDGE_AU * UNIT;
      const ox = (rp[0] - fa[0]) * UNIT, oy = (rp[1] - fa[1]) * UNIT, oz = (rp[2] - fa[2]) * UNIT;
      for (let q = 0; q < ORBIT_PTS; q++) { const a = (q / (ORBIT_PTS - 1)) * TWO_PI; arr[3 * q] = ox + R * Math.cos(a); arr[3 * q + 1] = oy + R * Math.sin(a); arr[3 * q + 2] = oz; }
      this.edgeRing.geometry.attributes.position.needsUpdate = true;
      this.edgeRing.computeLineDistances();
      this.edgeRing.material.dashSize = this.edgeRing.material.gapSize = R / 90;
    }
    this.updateSites(tr, fa);
    this.stars.position.copy(cam.position);
    this.renderer.render(this.scene, cam);
    this.updateLabels(fb);
  }

  updateLabels(fb) {
    const cam = this.camera, v = this.tmp;
    for (const o of this.bodies) {
      v.set(o.rel[0], o.rel[1], o.rel[2]).project(cam);
      const inFront = v.z < 1 && v.z > -1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
      o.sx = (v.x * 0.5 + 0.5) * this.w; o.sy = (-v.y * 0.5 + 0.5) * this.h;
      let show = inFront && this.opts.labels;
      o.visible = inFront;
      if (show && o.b.type === 'moon') {
        const p = this.bodies[o.b.parent];
        const near = o.idx === fb.idx || p.idx === fb.idx;
        show = near ? Math.hypot(o.sx - p.sx, o.sy - p.sy) > 22 || o.idx === fb.idx : Math.hypot(o.sx - p.sx, o.sy - p.sy) > 40;
        if (Math.hypot(o.sx - p.sx, o.sy - p.sy) < 10 && o.idx !== fb.idx) o.visible = false;
      }
      o.label.style.display = show ? '' : 'none';
      if (show) {
        o.label.style.transform = `translate(${o.sx.toFixed(1)}px, ${(o.sy + o.pxR + 6).toFixed(1)}px) translateX(-50%)`;
        o.label.classList.toggle('sel', o.idx === fb.idx);
      }
    }
    // étiquette des confins : au point de l'anneau le plus proche de l'axe x projeté
    const r0 = this.bodies[0].rel, R = SYSTEM_EDGE_AU * UNIT;
    v.set(r0[0] + R, r0[1], r0[2]).project(cam);
    const ok = this.opts.edge && this.opts.labels && v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1;
    this.edgeLabel.style.display = ok ? '' : 'none';
    if (ok) this.edgeLabel.style.transform = `translate(${((v.x * 0.5 + 0.5) * this.w).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * this.h).toFixed(1)}px) translate(-100%, -50%)`;
  }
}
void poleVector;
