import { G, TWO_PI, AU_KM } from './constants.js';
import { stateToElements, railState } from './kepler.js';
import { siteState } from './sites.js';

const frac = (x) => x - Math.floor(x);
const rail = (el, t0) => ({ a: el.a, e: el.e, b: el.a * Math.sqrt(1 - el.e * el.e), n: el.n, M0: el.M, t0, P: el.P, Q: el.Q });

/**
 * Instantané analytique du système à la date t0 (jours) : chaque planète suit son ellipse képlérienne autour de l'étoile,
 * chaque lune la sienne autour de sa planète. Précis à quelques minutes pour des événements à l'échelle de l'année ;
 * pour des siècles, les perturbations mutuelles s'accumulent (utiliser le saut dans le temps N-corps).
 * `sim.computeRender(t0)` doit avoir été appelé.
 */
export function makeSnapshot(sim, t0, rot) {
  const P = sim.rPos, V = sim.rVel, planets = new Map(), moons = new Map();
  for (const b of sim.bodies) {
    if (b.type === 'planet') {
      const i = b.idx, mo = sim.bodies.filter((m) => m.type === 'moon' && m.parent === i);
      const M = sim.mEff[i], x = [0, 0, 0], v = [0, 0, 0];
      for (let c = 0; c < 3; c++) {
        let px = sim.mass[i] * P[3 * i + c], pv = sim.mass[i] * V[3 * i + c];
        if (sim.tier === 1) for (const m of mo) { px += sim.mass[m.idx] * P[3 * m.idx + c]; pv += sim.mass[m.idx] * V[3 * m.idx + c]; }
        else { px = M * P[3 * i + c]; pv = M * V[3 * i + c]; }
        x[c] = px / M - P[c]; v[c] = pv / M - V[c];
      }
      planets.set(i, { mass: M, rail: rail(stateToElements(G * (sim.mass[0] + M), x, v), t0), el: stateToElements(G * (sim.mass[0] + M), x, v) });
    }
  }
  for (const b of sim.bodies) if (b.type === 'moon') {
    const r = [0, 1, 2].map((c) => P[3 * b.idx + c] - P[3 * b.parent + c]), v = [0, 1, 2].map((c) => V[3 * b.idx + c] - V[3 * b.parent + c]);
    moons.set(b.idx, rail(stateToElements(G * (sim.mass[b.parent] + sim.mass[b.idx]), r, v), t0));
  }
  return { sim, t0, planets, moons, rot, N: sim.N };
}

/** Positions/vitesses de tous les corps à la date t (référentiel barycentrique du système). */
export function stateAt(snap, t) {
  const N = snap.N, rPos = new Float64Array(3 * N), rVel = new Float64Array(3 * N), R = [0, 0, 0], W = [0, 0, 0];
  const rel = new Map(); let ms = snap.sim.mass[0], sx = [0, 0, 0], sv = [0, 0, 0];
  for (const [i, pl] of snap.planets) {
    railState(pl.rail, t, R, W); rel.set(i, [R.slice(), W.slice()]); ms += pl.mass;
    for (let c = 0; c < 3; c++) { sx[c] -= pl.mass * R[c]; sv[c] -= pl.mass * W[c]; }
  }
  for (let c = 0; c < 3; c++) { rPos[c] = sx[c] / ms; rVel[c] = sv[c] / ms; }
  for (const [i, [r, v]] of rel) for (let c = 0; c < 3; c++) { rPos[3 * i + c] = rPos[c] + r[c]; rVel[3 * i + c] = rVel[c] + v[c]; }
  for (const [i, rl] of snap.moons) {
    const p = snap.sim.bodies[i].parent; railState(rl, t, R, W);
    for (let c = 0; c < 3; c++) { rPos[3 * i + c] = rPos[3 * p + c] + R[c]; rVel[3 * i + c] = rVel[3 * p + c] + W[c]; }
  }
  return { rPos, rVel };
}

/** Angle de rotation propre d'un corps à la date t (même convention que le rendu). */
export function angleAt(snap, state, i, t) {
  const b = snap.sim.bodies[i], rp = snap.rot[i] || {};
  if (b.type === 'moon') { const p = b.parent; return Math.atan2(state.rPos[3 * i + 1] - state.rPos[3 * p + 1], state.rPos[3 * i] - state.rPos[3 * p]) + Math.PI; }
  return (rp.phase0 || 0) + TWO_PI * frac(t / (rp.protDays || 25));
}

/** Contexte pour siteState / calcul du ciel à la date t. */
export function ctxAt(snap, t) {
  const state = stateAt(snap, t), sim = snap.sim;
  const simLike = { rPos: state.rPos, rVel: state.rVel, bodies: sim.bodies, mass: sim.mass, mEff: sim.mEff };
  return {
    sim: simLike, state, t,
    ang: (i) => angleAt(snap, state, i, t),
    protDays: (i) => (sim.bodies[i].type === 'moon' ? 0 : (snap.rot[i] || {}).protDays || 0),
    bodyIndex: (name) => sim.bodies.find((b) => b.def.name === name).idx,
  };
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (a) => Math.hypot(a[0], a[1], a[2]);

/** Levers et couchers de l'étoile pour un site au sol / flottant. */
export function sunEvents(snap, site, t0, t1, max = 40) {
  const sim = snap.sim, idx = sim.bodies.findIndex((b) => b.def.name === site.body), b = sim.bodies[idx];
  if (idx < 0 || (site.type !== 'surface' && site.type !== 'floating')) return [];
  const period = b.type === 'moon' ? TWO_PI / snap.moons.get(idx).n : (snap.rot[idx]?.protDays || 1);
  const step = period / 72, out = [];
  const elev = (t) => { const c = ctxAt(snap, t), st = siteState(c, site, t), p = c.state.rPos; const d = sub([p[0], p[1], p[2]], st.pos); return dot(st.normal, d) / norm(d); };
  let pe = elev(t0), pt = t0;
  for (let t = t0 + step; t <= t1 && out.length < max; t += step) {
    const e = elev(t);
    if ((pe <= 0) !== (e <= 0)) { let a = pt, bb = t; for (let k = 0; k < 14; k++) { const mid = (a + bb) / 2; if ((elev(mid) <= 0) === (pe <= 0)) a = mid; else bb = mid; } out.push({ t: bb, type: e > 0 ? 'Lever de l\'étoile' : 'Coucher de l\'étoile', pair: [site.name] }); }
    pe = e; pt = t;
  }
  return out;
}
