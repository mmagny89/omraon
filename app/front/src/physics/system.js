import { G, M_EARTH, M_JUP, M_SUN_KG, R_SUN_KM, AU_KM, DEG, TWO_PI } from './constants.js';
import { elementsToState } from './kepler.js';

const rotZ = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a), v[2]];
const rotX = (v, a) => [v[0], v[1] * Math.cos(a) - v[2] * Math.sin(a), v[1] * Math.sin(a) + v[2] * Math.cos(a)];
// Repère équatorial d'une planète (pôle incliné de tilt, nœud ψ) -> écliptique.
const equatorialToEcliptic = (v, tilt, node) => rotZ(rotX(v, tilt), node);
export const poleVector = (tilt, node) => equatorialToEcliptic([0, 0, 1], tilt, node);

const massOf = (d) =>
  d.massEarth != null ? d.massEarth * M_EARTH
  : d.massJup != null ? d.massJup * M_JUP
  : (d.density * (4 / 3) * Math.PI * (d.radiusKm * 1000) ** 3) / M_SUN_KG;

/**
 * Construit les corps massifs (étoile, planètes, lunes) et l'état initial dans le référentiel barycentrique.
 * Indices : 0 étoile, 1..P planètes, puis lunes.
 */
export function buildSystem(STAR, PLANETS) {
  const bodies = [];
  bodies.push({ idx: 0, type: 'star', parent: -1, def: STAR, mass: STAR.massMsun, radiusKm: STAR.radiusRsun * R_SUN_KM });
  PLANETS.forEach((p) => bodies.push({ idx: bodies.length, type: 'planet', parent: 0, def: p, mass: massOf(p), radiusKm: p.radiusKm }));
  const planetIdx = bodies.filter((b) => b.type === 'planet').map((b) => b.idx);
  planetIdx.forEach((pi) => {
    bodies[pi].def.moons.forEach((m) => {
      bodies.push({ idx: bodies.length, type: 'moon', parent: pi, def: m, mass: massOf(m), radiusKm: m.radiusKm });
    });
  });
  const N = bodies.length;
  const pos = new Float64Array(3 * N), vel = new Float64Array(3 * N), mass = new Float64Array(N);
  bodies.forEach((b) => (mass[b.idx] = b.mass));
  const mEff = Float64Array.from(mass);
  bodies.forEach((b) => b.type === 'moon' && (mEff[b.parent] += b.mass));

  // pôle et rotation propre
  bodies.forEach((b) => {
    if (b.type === 'planet') {
      const r = b.def.rotation;
      b.tilt = (r.tiltDeg || 0) * DEG; b.node = (r.nodeDeg || 0) * DEG;
    } else if (b.type === 'moon') {
      const p = bodies[b.parent]; // satellites réguliers : pôle = pôle du plan orbital (≈ celui de la planète)
      b.tilt = p.tilt; b.node = p.node;
    } else { b.tilt = 0; b.node = 0; }
  });

  const set = (i, r, v) => { for (let k = 0; k < 3; k++) { pos[3 * i + k] = r[k]; vel[3 * i + k] = v[k]; } };
  planetIdx.forEach((pi) => {
    const b = bodies[pi], o = b.def.orbit;
    const mu = G * (STAR.massMsun + mEff[pi]);
    const st = elementsToState(mu, { a: o.a, e: o.e, i: o.i * DEG, Om: o.Om * DEG, w: o.w * DEG, M: o.M * DEG });
    // les lunes : état relatif
    const rels = bodies.filter((m) => m.parent === pi && m.type === 'moon').map((m) => {
      const mo = m.def.orbit;
      const s = elementsToState(G * (mass[pi] + m.mass), { a: mo.a / AU_KM, e: mo.e, i: mo.i * DEG, Om: mo.Om * DEG, w: mo.w * DEG, M: mo.M * DEG });
      return { m, r: equatorialToEcliptic(s.r, b.tilt, b.node), v: equatorialToEcliptic(s.v, b.tilt, b.node) };
    });
    // st = barycentre du système planétaire ; planète = barycentre − Σ m_k rel_k / M_tot
    const rp = [0, 1, 2].map((k) => st.r[k] - rels.reduce((s, q) => s + q.m.mass * q.r[k], 0) / mEff[pi]);
    const vp = [0, 1, 2].map((k) => st.v[k] - rels.reduce((s, q) => s + q.m.mass * q.v[k], 0) / mEff[pi]);
    set(pi, rp, vp);
    rels.forEach((q) => set(q.m.idx, [0, 1, 2].map((k) => rp[k] + q.r[k]), [0, 1, 2].map((k) => vp[k] + q.v[k])));
  });
  // barycentre
  let M = 0; const c = [0, 0, 0], cv = [0, 0, 0];
  for (let i = 0; i < N; i++) { M += mass[i]; for (let k = 0; k < 3; k++) { c[k] += mass[i] * pos[3 * i + k]; cv[k] += mass[i] * vel[3 * i + k]; } }
  for (let i = 0; i < N; i++) for (let k = 0; k < 3; k++) { pos[3 * i + k] -= c[k] / M; vel[3 * i + k] -= cv[k] / M; }
  return { bodies, N, pos, vel, mass, mEff, planetIdx, nHeavy: 1 + planetIdx.length };
}
export { TWO_PI };
