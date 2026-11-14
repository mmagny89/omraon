import { G, C_AU_DAY, TWO_PI, DEG, R_SUN_KM, AU_KM } from './constants.js';
import { stateToElements, elementsToState, railState } from './kepler.js';
import { BELT, COLD_BELT, COMETS, ROUSHAN_TROJANS } from '../data/omraon.js';

const PARTICLE_STEP_DAYS = 3;

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export class Simulation {
  constructor(sys, { particleCount = 4000, trojans = false, seed = 1 } = {}) {
    Object.assign(this, sys); // bodies, N, pos, vel, mass, mEff, planetIdx, nHeavy
    this.t = 0; // temps du dernier sous-pas massif (jours)
    this.tier = 1; // 1 = N-corps complet ; 2 = planètes N-corps, lunes sur rails
    this.gr = true;
    this.autoTier = true;
    this.order4 = true;
    this.acc = new Float64Array(3 * this.N);
    this.rails = new Map();
    this.rPos = new Float64Array(3 * this.N); // positions de rendu (extrapolées)
    this.rVel = new Float64Array(3 * this.N);
    this.measuredSpeed = 0;
    this.limited = false;
    this.impacts = 0;
    // pas
    let h1 = Infinity, h2 = Infinity;
    for (const b of this.bodies) {
      if (b.type === 'star') continue;
      const par = this.bodies[b.parent];
      const o = b.def.orbit;
      const a = b.type === 'moon' ? o.a / AU_KM : o.a;
      const mu = G * ((b.type === 'moon' ? this.mass[par.idx] : this.bodies[0].mass) + this.mass[b.idx]);
      const P = TWO_PI * Math.sqrt(a ** 3 / mu) * Math.pow(1 - o.e, 1.5);
      h1 = Math.min(h1, P / 80);
      if (b.type === 'planet') h2 = Math.min(h2, P / 160); // ordre 4 : précession parasite de Kalpra ≈ 0,006°/an (leapfrog P/64 : 3,7°/an)
    }
    this.h1 = h1; this.h2 = h2;
    this.computeAcc(this.pos, this.mass, this.N, this.acc);
    this.tPart = 0;
    this.makeParticles(particleCount, trojans, seed);
    this.resetDiagnostics();
  }

  // ---------- Gravité ----------
  computeAcc(pos, m, n, a) {
    a.fill(0, 0, 3 * n);
    for (let i = 0; i < n; i++) {
      const ix = 3 * i;
      for (let j = i + 1; j < n; j++) {
        const jx = 3 * j;
        const dx = pos[jx] - pos[ix], dy = pos[jx + 1] - pos[ix + 1], dz = pos[jx + 2] - pos[ix + 2];
        const r2 = dx * dx + dy * dy + dz * dz;
        const f = G / (r2 * Math.sqrt(r2));
        const fi = f * m[j], fj = f * m[i];
        a[ix] += dx * fi; a[ix + 1] += dy * fi; a[ix + 2] += dz * fi;
        a[jx] -= dx * fj; a[jx + 1] -= dy * fj; a[jx + 2] -= dz * fj;
      }
    }
  }

  // Correction relativiste 1PN (Schwarzschild, étoile centrale) appliquée aux planètes.
  // Kick par point milieu implicite (3 itérations) : symétrique, donc le pas complet reste réversible dans le temps.
  kickGR(h) {
    const n = this.tier === 1 ? this.N : this.nHeavy;
    const c2 = C_AU_DAY * C_AU_DAY, GM = G * this.mass[0];
    const p = this.pos, v = this.vel;
    for (let i = 1; i < n; i++) {
      if (this.bodies[i].type === 'moon') continue;
      const k = 3 * i;
      const x = p[k] - p[0], y = p[k + 1] - p[1], z = p[k + 2] - p[2];
      const r2 = x * x + y * y + z * z, r = Math.sqrt(r2), f = GM / (c2 * r2 * r);
      let wx = v[k], wy = v[k + 1], wz = v[k + 2]; // vitesse après le kick (itérée)
      for (let it = 0; it < 3; it++) {
        const ux = 0.5 * (v[k] + wx) - v[0], uy = 0.5 * (v[k + 1] + wy) - v[1], uz = 0.5 * (v[k + 2] + wz) - v[2];
        const u2 = ux * ux + uy * uy + uz * uz, rv = x * ux + y * uy + z * uz, A = 4 * GM / r - u2;
        wx = v[k] + h * f * (A * x + 4 * rv * ux); wy = v[k + 1] + h * f * (A * y + 4 * rv * uy); wz = v[k + 2] + h * f * (A * z + 4 * rv * uz);
      }
      v[k] = wx; v[k + 1] = wy; v[k + 2] = wz;
    }
  }

  get masses() { return this.tier === 1 ? this.mass : this.mEff; }
  get nAct() { return this.tier === 1 ? this.N : this.nHeavy; }

  // Composition d'ordre 4 (Yoshida) de pas symétriques : supprime la précession parasite du leapfrog
  // (≈ 1,7°/an pour Kalpra avec h = P/64) tout en restant réversible dans le temps.
  substep(h) {
    if (!this.order4) { this.stepBase(h); return; }
    const w1 = 1.3512071919596578, w0 = -1.7024143839193153;
    this.stepBase(w1 * h); this.stepBase(w0 * h); this.stepBase(w1 * h);
  }

  // Pas symétrique K_N K_GR D K_GR K_N : réversible dans le temps (h négatif = pas inverse exact).
  stepBase(h) {
    const n = this.nAct, m = this.masses, v = this.vel, p = this.pos, a = this.acc, hh = 0.5 * h;
    for (let k = 0; k < 3 * n; k++) v[k] += hh * a[k];
    if (this.gr) this.kickGR(hh);
    for (let k = 0; k < 3 * n; k++) p[k] += h * v[k];
    this.computeAcc(p, m, n, a);
    if (this.gr) this.kickGR(hh);
    for (let k = 0; k < 3 * n; k++) v[k] += hh * a[k];
    this.t += h;
  }

  // ---------- Bascule N-corps complet <-> lunes sur rails ----------
  enterRails() {
    if (this.tier === 2) return;
    for (const pi of this.planetIdx) {
      const moons = this.bodies.filter((b) => b.parent === pi && b.type === 'moon');
      if (!moons.length) continue;
      const Mt = this.mEff[pi], p = this.pos, v = this.vel;
      const bp = [0, 0, 0], bv = [0, 0, 0];
      for (let k = 0; k < 3; k++) {
        bp[k] = (this.mass[pi] * p[3 * pi + k] + moons.reduce((s, q) => s + q.mass * p[3 * q.idx + k], 0)) / Mt;
        bv[k] = (this.mass[pi] * v[3 * pi + k] + moons.reduce((s, q) => s + q.mass * v[3 * q.idx + k], 0)) / Mt;
      }
      for (const q of moons) {
        const r = [0, 1, 2].map((k) => p[3 * q.idx + k] - p[3 * pi + k]);
        const w = [0, 1, 2].map((k) => v[3 * q.idx + k] - v[3 * pi + k]);
        const el = stateToElements(G * (this.mass[pi] + q.mass), r, w);
        this.rails.set(q.idx, { a: el.a, e: el.e, b: el.a * Math.sqrt(1 - el.e ** 2), n: el.n, M0: el.M, t0: this.t, P: el.P, Q: el.Q });
      }
      for (let k = 0; k < 3; k++) { p[3 * pi + k] = bp[k]; v[3 * pi + k] = bv[k]; }
    }
    this.tier = 2;
    this.computeAcc(this.pos, this.mEff, this.nHeavy, this.acc);
    this.resetDiagnostics();
  }

  exitRails() {
    if (this.tier === 1) return;
    const r = [0, 0, 0], w = [0, 0, 0], p = this.pos, v = this.vel;
    for (const pi of this.planetIdx) {
      const moons = this.bodies.filter((b) => b.parent === pi && b.type === 'moon');
      if (!moons.length) continue;
      const Mt = this.mEff[pi];
      const rel = moons.map((q) => { const R = [0, 0, 0], V = [0, 0, 0]; railState(this.rails.get(q.idx), this.t, R, V); return { q, R, V }; });
      for (let k = 0; k < 3; k++) {
        const pk = p[3 * pi + k] - rel.reduce((s, o) => s + o.q.mass * o.R[k], 0) / Mt;
        const vk = v[3 * pi + k] - rel.reduce((s, o) => s + o.q.mass * o.V[k], 0) / Mt;
        p[3 * pi + k] = pk; v[3 * pi + k] = vk;
        for (const o of rel) { p[3 * o.q.idx + k] = pk + o.R[k]; v[3 * o.q.idx + k] = vk + o.V[k]; }
      }
    }
    void r; void w;
    this.tier = 1;
    this.computeAcc(this.pos, this.mass, this.N, this.acc);
    this.resetDiagnostics();
  }

  // ---------- Particules test (ceinture, troyens) ----------
  makeParticles(count, trojans, seed) {
    this.pParams = { count, trojans, seed };
    const rnd = mulberry32(seed);
    this.pRnd = rnd;
    const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(TWO_PI * rnd());
    // familles de traceurs (pKind) : 0 ceinture principale, 1 troyens, 2 ceinture froide, 3 comètes et centaures, 4 amas de Hilda
    const nHilda = Math.round(count * BELT.hilda.share), nCold = Math.round(count * COLD_BELT.share), nCom = COMETS.count;
    const nT = trojans ? 400 + ROUSHAN_TROJANS : 0;
    const n = count + nHilda + nCold + nCom + nT;
    this.pN = n;
    for (const k of ['px', 'py', 'pz', 'pvx', 'pvy', 'pvz', 'pax', 'pay', 'paz']) this[k] = new Float64Array(n);
    this.pBright = new Float32Array(n);
    this.pKind = new Uint8Array(n);
    const mu = G * this.bodies[0].mass;
    const star = this.bodies[0];
    // sources : étoile + planètes (masses totales)
    const heavy = this.nHeavy;
    const place = (idx, a, e, inc, Om, w, M, kind = 0) => {
      const s = elementsToState(mu, { a, e, i: inc, Om, w, M });
      this.px[idx] = s.r[0] + this.pos[0]; this.py[idx] = s.r[1] + this.pos[1]; this.pz[idx] = s.r[2] + this.pos[2];
      this.pvx[idx] = s.v[0] + this.vel[0]; this.pvy[idx] = s.v[1] + this.vel[1]; this.pvz[idx] = s.v[2] + this.vel[2];
      this.pBright[idx] = kind === 3 ? 1 : 0.45 + 0.55 * rnd();
      this.pKind[idx] = kind;
    };
    // comète ou centaure : périhélie entre les géantes, aphélie dans la ceinture froide, placée près de l'aphélie (elle retombe lentement)
    this.respawnComet = (idx) => {
      const q = COMETS.qMin + (COMETS.qMax - COMETS.qMin) * rnd(), Q = COMETS.QMin + (COMETS.QMax - COMETS.QMin) * rnd();
      place(idx, (q + Q) / 2, (Q - q) / (Q + q), 0.1 + 0.6 * rnd(), TWO_PI * rnd(), TWO_PI * rnd(), Math.PI + 0.3 * (rnd() - 0.5), 3);
    };
    let k = 0;
    for (; k < count; k++) {
      let a;
      do a = BELT.aMin + (BELT.aMax - BELT.aMin) * rnd(); while (BELT.gaps.some(([c, w]) => Math.abs(a - c) < w)); // lacunes de Kirkwood
      const e = Math.min(0.28, Math.abs(gauss()) * 0.07);
      const inc = Math.min(0.3, Math.abs(gauss()) * 0.08);
      place(k, a, e, inc, TWO_PI * rnd(), TWO_PI * rnd(), TWO_PI * rnd());
    }
    for (let i = 0; i < nHilda; i++, k++) place(k, BELT.hilda.a + BELT.hilda.spread * gauss(), Math.min(0.25, Math.abs(gauss()) * 0.1), Math.min(0.3, Math.abs(gauss()) * 0.08), TWO_PI * rnd(), TWO_PI * rnd(), TWO_PI * rnd(), 4);
    for (let i = 0; i < nCold; i++, k++) place(k, COLD_BELT.aMin + (COLD_BELT.aMax - COLD_BELT.aMin) * rnd(), Math.min(0.2, Math.abs(gauss()) * 0.05), Math.min(0.25, Math.abs(gauss()) * 0.06), TWO_PI * rnd(), TWO_PI * rnd(), TWO_PI * rnd(), 2);
    for (let i = 0; i < nCom; i++, k++) this.respawnComet(k);
    if (trojans) {
      const troyens = (pi, nb) => { // L4 et L5 : à ±60° de la planète sur sa propre orbite
        const rel = [0, 1, 2].map((c) => this.pos[3 * pi + c] - this.pos[c]);
        const el = stateToElements(G * (star.mass + this.mEff[pi]), rel, [0, 1, 2].map((c) => this.vel[3 * pi + c] - this.vel[c]));
        for (let i = 0; i < nb; i++, k++) {
          const lead = i % 2 === 0 ? 1 : -1;
          place(k, el.a * (1 + 0.012 * gauss()), Math.abs(0.02 * gauss()) + 0.01, el.i + 0.05 * gauss(), el.Om, el.w, el.M + lead * (Math.PI / 3) + 0.15 * gauss(), 1);
        }
      };
      troyens(this.planetIdx[3], 400); // Zirkan
      troyens(this.planetIdx[4], ROUSHAN_TROJANS); // Roushan
    }
    // rayons de capture (étoile + planètes)
    this.captureR2 = new Float64Array(heavy);
    for (let j = 0; j < heavy; j++) this.captureR2[j] = ((j === 0 ? 2 : 2) * this.bodies[j].radiusKm / AU_KM) ** 2;
    this.accParticles();
    this.tPart = this.t;
  }

  accParticles() {
    const heavy = this.nHeavy, P = this.pos, m = this.mEff;
    for (let i = 0; i < this.pN; ) {
      let ax = 0, ay = 0, az = 0, hit = false;
      const x = this.px[i], y = this.py[i], z = this.pz[i];
      for (let j = 0; j < heavy; j++) {
        const dx = P[3 * j] - x, dy = P[3 * j + 1] - y, dz = P[3 * j + 2] - z;
        const r2 = dx * dx + dy * dy + dz * dz;
        if (r2 < this.captureR2[j]) { hit = true; break; }
        const f = G * m[j] / (r2 * Math.sqrt(r2));
        ax += dx * f; ay += dy * f; az += dz * f;
      }
      if (hit || x * x + y * y + z * z > 2.25e4) { if (this.pKind[i] === 3) { this.respawnComet(i); continue; } this.removeParticle(i, hit); continue; }
      this.pax[i] = ax; this.pay[i] = ay; this.paz[i] = az;
      i++;
    }
  }

  removeParticle(i, impact) {
    const l = --this.pN;
    for (const k of ['px', 'py', 'pz', 'pvx', 'pvy', 'pvz', 'pax', 'pay', 'paz', 'pBright', 'pKind']) this[k][i] = this[k][l];
    if (impact) this.impacts++;
  }

  stepParticles(dt) {
    const h2 = 0.5 * dt * dt, n = this.pN;
    for (let i = 0; i < n; i++) {
      this.px[i] += this.pvx[i] * dt + this.pax[i] * h2;
      this.py[i] += this.pvy[i] * dt + this.pay[i] * h2;
      this.pz[i] += this.pvz[i] * dt + this.paz[i] * h2;
    }
    const ox = this.pax.slice(0, n), oy = this.pay.slice(0, n), oz = this.paz.slice(0, n);
    // nouvelle accélération ; une suppression échange la dernière particule : on la traite à part
    const heavy = this.nHeavy, P = this.pos, m = this.mEff;
    for (let i = 0; i < this.pN; ) {
      let ax = 0, ay = 0, az = 0, hit = false;
      const x = this.px[i], y = this.py[i], z = this.pz[i];
      for (let j = 0; j < heavy; j++) {
        const dx = P[3 * j] - x, dy = P[3 * j + 1] - y, dz = P[3 * j + 2] - z;
        const r2 = dx * dx + dy * dy + dz * dz;
        if (r2 < this.captureR2[j]) { hit = true; break; }
        const f = G * m[j] / (r2 * Math.sqrt(r2));
        ax += dx * f; ay += dy * f; az += dz * f;
      }
      if (hit || x * x + y * y + z * z > 2.25e4) {
        if (this.pKind[i] === 3) { this.respawnComet(i); ox[i] = oy[i] = oz[i] = 0; continue; } // une comète perdue est remplacée par une autre
        const l = this.pN - 1;
        ox[i] = ox[l]; oy[i] = oy[l]; oz[i] = oz[l];
        this.removeParticle(i, hit);
        continue;
      }
      this.pvx[i] += 0.5 * dt * (ox[i] + ax); this.pvy[i] += 0.5 * dt * (oy[i] + ay); this.pvz[i] += 0.5 * dt * (oz[i] + az);
      this.pax[i] = ax; this.pay[i] = ay; this.paz[i] = az;
      i++;
    }
  }

  /**
   * Saute à la date `target` (jours depuis le présent, négatif = passé). Planètes en N-corps (lunes sur rails), pas h2 ;
   * le leapfrog est réversible, donc l'intégration vers le passé est aussi fiable que vers le futur.
   * La ceinture est regénérée à la nouvelle date (son détail n'a pas d'historique).
   */
  jumpTo(target) {
    if (Math.abs(target - this.t) < 1e-9) return;
    if (this.tier === 1) this.enterRails();
    // pas uniforme dt/n (pas de pas résiduel) : aller puis revenir de la même durée est l'inverse exact
    const dt = target - this.t, n = Math.max(1, Math.ceil(Math.abs(dt) / this.h2)), h = dt / n;
    for (let i = 0; i < n; i++) this.substep(h);
    this.t = target;
    this.resetDiagnostics();
    const pp = this.pParams;
    this.makeParticles(pp.count, pp.trojans, pp.seed);
  }

  // ---------- Avancement ----------
  /** Avance jusqu'à `target` (jours) en au plus `budgetMs`. Retourne vrai si limité par le CPU. */
  advance(target, budgetMs) {
    const t0 = performance.now();
    const need = (target - this.t) / this.h1;
    if (this.autoTier) {
      if (this.tier === 1 && need > 200) this.enterRails(); // ordre 4 = 3 pas par pas : seuils divisés par 3
      else if (this.tier === 2 && need < 80) this.exitRails();
    }
    const h = this.tier === 1 ? this.h1 : this.h2;
    let limited = false, n = 0;
    const tStart = this.t;
    while (this.t + h <= target) {
      this.substep(h);
      if (this.t - this.tPart >= PARTICLE_STEP_DAYS) { this.stepParticles(this.t - this.tPart); this.tPart = this.t; }
      if ((++n & 15) === 0 && performance.now() - t0 > budgetMs) { limited = this.t + h <= target; break; }
    }
    const dtReal = Math.max(1e-3, performance.now() - t0);
    if (this.t > tStart) this.measuredSpeed = this.measuredSpeed * 0.9 + 0.1 * ((this.t - tStart) / dtReal) * 1000;
    this.limited = limited;
    return limited;
  }

  /** Calcule positions/vitesses de rendu au temps `tr` (extrapolation depuis le dernier pas). */
  computeRender(tr) {
    const tau = tr - this.t, p = this.pos, v = this.vel, a = this.acc, rp = this.rPos, rv = this.rVel;
    const n = this.nAct;
    for (let k = 0; k < 3 * n; k++) { rp[k] = p[k] + v[k] * tau + 0.5 * a[k] * tau * tau; rv[k] = v[k] + a[k] * tau; }
    if (this.tier === 2) {
      const R = [0, 0, 0], V = [0, 0, 0];
      for (const b of this.bodies) {
        if (b.type !== 'moon') continue;
        railState(this.rails.get(b.idx), tr, R, V);
        for (let k = 0; k < 3; k++) { rp[3 * b.idx + k] = rp[3 * b.parent + k] + R[k]; rv[3 * b.idx + k] = rv[3 * b.parent + k] + V[k]; }
      }
    }
  }

  /**
   * Position et vitesse relatives pour les éléments osculateurs, à la date du dernier pas (SANS extrapolation) :
   * l'extrapolation du rendu entraîne une erreur de vitesse (jusqu'à ~0,3 % sur a pour Kalpra en pas de 0,76 j)
   * qui faisait osciller les ellipses d'une image à l'autre. Planète = barycentre planète + lunes.
   */
  elementState(i) {
    const b = this.bodies[i], p = this.pos, v = this.vel;
    // barycentre « planète + lunes » (tier 1) ou état de la planète (tier 2 : déjà le barycentre)
    const bary = (k) => {
      const mo = this.tier === 1 ? this.bodies.filter((m) => m.type === 'moon' && m.parent === k) : [];
      const M = this.mEff[k], x = [0, 0, 0], u = [0, 0, 0];
      for (let c = 0; c < 3; c++) {
        let px = this.mass[k] * p[3 * k + c], pv = this.mass[k] * v[3 * k + c];
        if (this.tier === 1) for (const m of mo) { px += this.mass[m.idx] * p[3 * m.idx + c]; pv += this.mass[m.idx] * v[3 * m.idx + c]; }
        else { px = M * p[3 * k + c]; pv = M * v[3 * k + c]; }
        x[c] = px / M; u[c] = pv / M;
      }
      return { x, u, M };
    };
    if (b.type === 'planet') {
      // Coordonnées de Jacobi : on mesure la planète par rapport au centre de masse de l'étoile et des planètes intérieures.
      // Sans cela, l'étoile (qui oscille sous l'attraction de Zirkan) fait osciller les éléments des planètes lointaines.
      let M = this.mass[0]; const cx = [this.mass[0] * p[0], this.mass[0] * p[1], this.mass[0] * p[2]], cu = [this.mass[0] * v[0], this.mass[0] * v[1], this.mass[0] * v[2]];
      for (const k of this.planetIdx) {
        if (k >= i) break;
        const q = bary(k); M += q.M;
        for (let c = 0; c < 3; c++) { cx[c] += q.M * q.x[c]; cu[c] += q.M * q.u[c]; }
      }
      const me = bary(i);
      return { r: [0, 1, 2].map((c) => me.x[c] - cx[c] / M), v: [0, 1, 2].map((c) => me.u[c] - cu[c] / M), mu: G * (M + me.M) };
    }
    const q = b.parent, r = [0, 0, 0], w = [0, 0, 0];
    if (this.tier === 2) { const R = [0, 0, 0], V = [0, 0, 0]; railState(this.rails.get(i), this.t, R, V); return { r: R, v: V, mu: G * (this.mass[q] + this.mass[i]) }; }
    for (let c = 0; c < 3; c++) { r[c] = p[3 * i + c] - p[3 * q + c]; w[c] = v[3 * i + c] - v[3 * q + c]; }
    return { r, v: w, mu: G * (this.mass[q] + this.mass[i]) };
  }

  /** Foyer de l'ellipse d'une planète au rendu : centre de masse de l'étoile et des planètes intérieures (positions de rendu). */
  originRender(i) {
    const rp = this.rPos; let M = this.mass[0]; const o = [this.mass[0] * rp[0], this.mass[0] * rp[1], this.mass[0] * rp[2]];
    for (const k of this.planetIdx) { if (k >= i) break; M += this.mEff[k]; for (let c = 0; c < 3; c++) o[c] += this.mEff[k] * rp[3 * k + c]; }
    return [o[0] / M, o[1] / M, o[2] / M];
  }

  particleRender(tr, outPos, outBright, outKind) {
    const tau = tr - this.tPart, h2 = 0.5 * tau * tau, n = this.pN;
    for (let i = 0; i < n; i++) {
      outPos[3 * i] = this.px[i] + this.pvx[i] * tau + this.pax[i] * h2;
      outPos[3 * i + 1] = this.py[i] + this.pvy[i] * tau + this.pay[i] * h2;
      outPos[3 * i + 2] = this.pz[i] + this.pvz[i] * tau + this.paz[i] * h2;
      outBright[i] = this.pBright[i];
      if (outKind) outKind[i] = this.pKind[i];
    }
    return n;
  }

  // ---------- Diagnostics ----------
  invariants() {
    const n = this.nAct, m = this.masses, p = this.pos, v = this.vel;
    let ke = 0, pe = 0; const L = [0, 0, 0];
    for (let i = 0; i < n; i++) {
      const k = 3 * i;
      ke += 0.5 * m[i] * (v[k] ** 2 + v[k + 1] ** 2 + v[k + 2] ** 2);
      L[0] += m[i] * (p[k + 1] * v[k + 2] - p[k + 2] * v[k + 1]);
      L[1] += m[i] * (p[k + 2] * v[k] - p[k] * v[k + 2]);
      L[2] += m[i] * (p[k] * v[k + 1] - p[k + 1] * v[k]);
      for (let j = i + 1; j < n; j++) {
        const q = 3 * j;
        pe -= G * m[i] * m[j] / Math.hypot(p[k] - p[q], p[k + 1] - p[q + 1], p[k + 2] - p[q + 2]);
      }
    }
    return { E: ke + pe, L: Math.hypot(...L) };
  }
  resetDiagnostics() { this.inv0 = this.invariants(); }
  drift() {
    const i = this.invariants();
    return { dE: (i.E - this.inv0.E) / Math.abs(this.inv0.E), dL: (i.L - this.inv0.L) / this.inv0.L };
  }
}
