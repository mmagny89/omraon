import { G, AU_KM, DEG, TWO_PI } from './constants.js';
import { orbitBasis, solveKepler } from './kepler.js';

const rotZ = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a), v[2]];
const rotX = (v, a) => [v[0], v[1] * Math.cos(a) - v[2] * Math.sin(a), v[1] * Math.sin(a) + v[2] * Math.cos(a)];
/** Repère local du corps (pôle +Z, rotation propre ang) -> écliptique. */
export const localToEcliptic = (v, tilt, node, ang) => rotZ(rotX(rotZ(v, ang), tilt), node);
/** Direction locale d'un point (lat, lon) : même convention que la géométrie et les textures du rendu. */
export const surfaceDir = (latDeg, lonDeg) => {
  const la = latDeg * DEG, lo = lonDeg * DEG;
  return [-Math.cos(la) * Math.cos(lo), -Math.cos(la) * Math.sin(lo), Math.sin(la)];
};

/**
 * Position et vitesse (UA, UA/j, référentiel barycentrique) d'un site au temps t.
 * ctx : { sim, ang(idx) -> angle de rotation propre (rad), protDays(idx), bodyIndex(name) }
 */
export function siteState(ctx, site, t) {
  const sim = ctx.sim, p = sim.rPos, v = sim.rVel;
  if (site.type === 'heliocentric') {
    const o = site.orbit, mu = G * sim.mass[0], n = Math.sqrt(mu / o.a ** 3);
    const E = solveKepler(o.M * DEG + n * t, o.e), b = o.a * Math.sqrt(1 - o.e * o.e), d = 1 - o.e * Math.cos(E);
    const { P, Q } = orbitBasis(o.Om * DEG, o.i * DEG, o.w * DEG);
    const x = o.a * (Math.cos(E) - o.e), y = b * Math.sin(E), vx = -o.a * n * Math.sin(E) / d, vy = b * n * Math.cos(E) / d;
    return { idx: 0, pos: [0, 1, 2].map((k) => p[k] + x * P[k] + y * Q[k]), vel: [0, 1, 2].map((k) => v[k] + vx * P[k] + vy * Q[k]), radiusKm: 0 };
  }
  const idx = ctx.bodyIndex(site.body), b = sim.bodies[idx], R = b.radiusKm / AU_KM;
  const bp = [p[3 * idx], p[3 * idx + 1], p[3 * idx + 2]], bv = [v[3 * idx], v[3 * idx + 1], v[3 * idx + 2]];
  if (site.type === 'orbit') {
    const a = R + (site.altKm || 0) / AU_KM, n = Math.sqrt(G * sim.mass[idx] / a ** 3);
    const th = (site.phase || 0) * DEG + n * t, { P, Q } = orbitBasis((site.node || 0) * DEG, (site.incl || 0) * DEG, 0);
    const r = [0, 1, 2].map((k) => a * (Math.cos(th) * P[k] + Math.sin(th) * Q[k]));
    const w = [0, 1, 2].map((k) => a * n * (-Math.sin(th) * P[k] + Math.cos(th) * Q[k]));
    const re = localToEcliptic(r, b.tilt, b.node, 0), ve = localToEcliptic(w, b.tilt, b.node, 0);
    return { idx, pos: [0, 1, 2].map((k) => bp[k] + re[k]), vel: [0, 1, 2].map((k) => bv[k] + ve[k]), radiusKm: a * AU_KM, orbitalPeriod: TWO_PI / n };
  }
  // surface ou cité flottante : fixe dans le repère du corps
  const rr = R + (site.altKm || 0) / AU_KM;
  const d = surfaceDir(site.lat, site.lon).map((c) => c * rr);
  const e = localToEcliptic(d, b.tilt, b.node, ctx.ang(idx));
  const prot = ctx.protDays(idx);
  let vr = [0, 0, 0];
  if (prot) { const w = TWO_PI / prot, pole = localToEcliptic([0, 0, 1], b.tilt, b.node, 0); vr = [pole[1] * e[2] - pole[2] * e[1], pole[2] * e[0] - pole[0] * e[2], pole[0] * e[1] - pole[1] * e[0]].map((c) => c * w); }
  return { idx, pos: [0, 1, 2].map((k) => bp[k] + e[k]), vel: [0, 1, 2].map((k) => bv[k] + vr[k]), radiusKm: rr * AU_KM, normal: e.map((c) => c / rr) };
}
