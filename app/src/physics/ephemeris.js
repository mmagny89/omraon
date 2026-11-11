import { TWO_PI, AU_KM, DAYS_PER_YEAR } from './constants.js';
import { Simulation } from './simulation.js';
import { buildSystem } from './system.js';
import { siteState } from './sites.js';

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const frac = (x) => x - Math.floor(x);

/** Copie indépendante de la simulation (N-corps complet, sans astéroïdes) à la date du dernier pas. */
export function cloneForEphemeris(sim) {
  const planets = sim.bodies.filter((b) => b.type === 'planet').map((b) => b.def);
  const c = new Simulation(buildSystem(sim.bodies[0].def, planets), { particleCount: 0 });
  c.autoTier = false; c.gr = sim.gr;
  c.t = sim.t; c.pos.set(sim.pos); c.vel.set(sim.vel);
  if (sim.tier === 2) { c.rails = new Map(sim.rails); c.tier = 2; c.exitRails(); }
  else c.computeAcc(c.pos, c.mass, c.N, c.acc);
  return c;
}

/**
 * Exécute une copie de la simulation sur `horizon` jours et détecte, au fil du calcul :
 * éclipses de l'étoile par la planète parente (vues du centre de chaque lune), alignements (conjonctions / oppositions
 * vues de l'étoile), périhélies et aphélies, levers et couchers de l'étoile pour un site au sol.
 * Date des événements : interpolation linéaire entre deux échantillons de ~0,03 j (précision de l'ordre de la minute).
 * rot : [{ phase0, protDays }] par corps ; site : site au sol facultatif ; kinds : { eclipses, alignments, apsides, sun }.
 */
export function runEphemeris(sim, horizon, { rot, site = null, kinds = { eclipses: true, alignments: true, apsides: true, sun: true }, max = 5000 } = {}) {
  const c = cloneForEphemeris(sim), N = c.N, bodies = c.bodies, t0 = c.t, end = t0 + horizon;
  const out = [], P = c.pos, V = c.vel;
  const moonIdx = bodies.filter((b) => b.type === 'moon').map((b) => b.idx), planetIdx = c.planetIdx;
  const Rs = bodies[0].radiusKm / AU_KM;
  const K = Math.max(1, Math.round(0.03 / c.h1)), name = (i) => bodies[i].def.name;

  const ov = (j) => { // marge de recouvrement star/planète vue de la lune j (>0 : éclipse) + séparation
    const p = bodies[j].parent, o = [P[3 * j], P[3 * j + 1], P[3 * j + 2]];
    const toS = [P[0] - o[0], P[1] - o[1], P[2] - o[2]], toP = [P[3 * p] - o[0], P[3 * p + 1] - o[1], P[3 * p + 2] - o[2]];
    const dS = Math.hypot(...toS), dP = Math.hypot(...toP), sep = Math.acos(Math.max(-1, Math.min(1, dot(toS, toP) / (dS * dP))));
    const rs = Math.asin(Rs / dS), rp = Math.asin(Math.min(1, (bodies[p].radiusKm / AU_KM) / dP));
    return { m: rs + rp - sep, sep, rs, rp };
  };
  const lon = (i) => Math.atan2(P[3 * i + 1] - P[1], P[3 * i] - P[0]);
  const rdot = (i) => (P[3 * i] - P[0]) * (V[3 * i] - V[0]) + (P[3 * i + 1] - P[1]) * (V[3 * i + 1] - V[1]) + (P[3 * i + 2] - P[2]) * (V[3 * i + 2] - V[2]);
  const siteSim = { rPos: P, rVel: V, bodies, mass: c.mass };
  const sunSite = site && (site.type === 'surface' || site.type === 'floating');
  const ctx = {
    sim: siteSim,
    ang: (i) => (bodies[i].type === 'moon' ? Math.atan2(P[3 * i + 1] - P[3 * bodies[i].parent + 1], P[3 * i] - P[3 * bodies[i].parent]) + Math.PI : (rot[i]?.phase0 || 0) + TWO_PI * frac(c.t / (rot[i]?.protDays || 25))),
    protDays: (i) => (bodies[i].type === 'moon' ? 0 : rot[i]?.protDays || 0),
    bodyIndex: (n) => bodies.find((b) => b.def.name === n).idx,
  };
  const elev = () => { const st = siteState(ctx, site, c.t), d = [P[0] - st.pos[0], P[1] - st.pos[1], P[2] - st.pos[2]]; return dot(st.normal, d) / Math.hypot(...d); };

  // état précédent des détecteurs
  const cur = new Map(moonIdx.map((j) => [j, null]));
  const prevOv = new Map(moonIdx.map((j) => [j, ov(j)]));
  const prevD = new Map(); const pairs = [];
  for (let x = 0; x < planetIdx.length; x++) for (let y = x + 1; y < planetIdx.length; y++) pairs.push([planetIdx[x], planetIdx[y]]);
  const dlon = (i, j) => { const v = lon(j) - lon(i); return ((v % TWO_PI) + TWO_PI) % TWO_PI; };
  for (const [i, j] of pairs) prevD.set(i + '-' + j, dlon(i, j));
  const prevRd = new Map(planetIdx.map((i) => [i, rdot(i)]));
  let prevEl = sunSite ? elev() : 0, tprev = c.t;
  const lerp = (ta, tb, fa, fb) => ta + (tb - ta) * (fa / (fa - fb));

  while (c.t < end && out.length < max) {
    for (let k = 0; k < K; k++) c.substep(c.h1);
    const t = c.t;
    if (kinds.eclipses) for (const j of moonIdx) {
      const f = ov(j), pf = prevOv.get(j); let e = cur.get(j);
      if (pf.m <= 0 && f.m > 0) e = { start: lerp(tprev, t, pf.m, f.m), minSep: f.sep, rs: f.rs, rp: f.rp };
      if (e && f.m > 0 && f.sep < e.minSep) { e.minSep = f.sep; e.rs = f.rs; e.rp = f.rp; }
      if (e && pf.m > 0 && f.m <= 0) { const te = lerp(tprev, t, pf.m, f.m); out.push({ t: e.start, end: te, duration: te - e.start, type: e.minSep < e.rp - e.rs ? 'Éclipse totale' : 'Éclipse partielle', who: name(j), by: name(bodies[j].parent) }); e = null; }
      cur.set(j, e); prevOv.set(j, f);
    }
    if (kinds.alignments) for (const [i, j] of pairs) {
      const key = i + '-' + j, v = dlon(i, j), pv = prevD.get(key);
      if (pv > 5.5 && v < 0.8) out.push({ t: tprev + (t - tprev) * ((TWO_PI - pv) / ((TWO_PI - pv) + v)), type: 'Conjonction', who: name(i), by: name(j) });
      if (pv < Math.PI && v >= Math.PI && v - pv < 1) out.push({ t: tprev + (t - tprev) * ((Math.PI - pv) / (v - pv)), type: 'Opposition', who: name(i), by: name(j) });
      prevD.set(key, v);
    }
    if (kinds.apsides) for (const i of planetIdx) {
      const r = rdot(i), pr = prevRd.get(i);
      if (pr < 0 && r >= 0) out.push({ t: lerp(tprev, t, pr, r), type: 'Périhélie', who: name(i) });
      if (pr > 0 && r <= 0) out.push({ t: lerp(tprev, t, pr, r), type: 'Aphélie', who: name(i) });
      prevRd.set(i, r);
    }
    if (kinds.sun && sunSite) {
      const e = elev();
      if ((prevEl <= 0) !== (e <= 0)) out.push({ t: lerp(tprev, t, prevEl, e), type: e > 0 ? "Lever de l'étoile" : "Coucher de l'étoile", who: site.name });
      prevEl = e;
    }
    tprev = t;
  }
  return out.filter((e) => e.t >= t0 && e.t <= end).sort((a, b) => a.t - b.t);
}
export { DAYS_PER_YEAR };
