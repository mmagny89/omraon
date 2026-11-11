import { AU_KM } from './constants.js';
import { poleVector } from './system.js';

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => { const n = norm(a) || 1; return [a[0] / n, a[1] / n, a[2] / n]; };

// Surface commune de deux disques (rayons r1, r2, séparation d) : fraction du disque 1 recouverte.
export function overlapFraction(r1, r2, d) {
  if (d >= r1 + r2) return 0;
  if (d <= Math.abs(r1 - r2)) return r2 >= r1 ? 1 : (r2 * r2) / (r1 * r1);
  const a = r1 * r1 * Math.acos((d * d + r1 * r1 - r2 * r2) / (2 * d * r1)) + r2 * r2 * Math.acos((d * d + r2 * r2 - r1 * r1) / (2 * d * r2)) - 0.5 * Math.sqrt((-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2));
  return a / (Math.PI * r1 * r1);
}

/**
 * Ciel vu d'un site. `sim` : { rPos, bodies } ; `st` : état du site (siteState).
 * Repère local : haut = verticale, nord = pôle du corps projeté, est = nord × haut.
 * Retourne les objets (azimut, hauteur, rayon angulaire, phase), la hauteur de l'étoile et l'éclipse éventuelle.
 */
export function computeSky(sim, site, st) {
  const P = sim.rPos, bodies = sim.bodies, own = st.idx;
  const ob = bodies[own];
  const bodyPos = [P[3 * own], P[3 * own + 1], P[3 * own + 2]];
  const up = site.type === 'heliocentric' ? [0, 0, 1] : unit([st.pos[0] - bodyPos[0], st.pos[1] - bodyPos[1], st.pos[2] - bodyPos[2]]);
  const pole = site.type === 'heliocentric' ? [1, 0, 0] : poleVector(ob.tilt, ob.node);
  let north = [pole[0] - dot(pole, up) * up[0], pole[1] - dot(pole, up) * up[1], pole[2] - dot(pole, up) * up[2]];
  if (norm(north) < 1e-6) north = [1, 0, 0].map((c, k) => c - dot([1, 0, 0], up) * up[k]);
  north = unit(north);
  const east = unit(cross(north, up));
  const sun = [P[0], P[1], P[2]];
  const objs = [];
  for (const b of bodies) {
    const j = b.idx;
    if (j === own && site.type !== 'orbit') continue;
    if (j === own) continue; // la station ne se dessine pas son propre corps (voir horizon)
    const pos = [P[3 * j], P[3 * j + 1], P[3 * j + 2]], d = [pos[0] - st.pos[0], pos[1] - st.pos[1], pos[2] - st.pos[2]], dist = norm(d);
    const R = b.radiusKm / AU_KM, angR = Math.asin(Math.min(1, R / dist));
    const az = Math.atan2(dot(d, east), dot(d, north)), el = Math.asin(Math.max(-1, Math.min(1, dot(d, up) / dist)));
    let frac = 1;
    if (b.type !== 'star') { // phase vue de l'observateur
      const s = [sun[0] - pos[0], sun[1] - pos[1], sun[2] - pos[2]], o = [-d[0], -d[1], -d[2]];
      frac = (1 + dot(s, o) / (norm(s) * norm(o))) / 2;
    }
    objs.push({ idx: j, name: b.def.name, type: b.type, color: b.def.color || '#ffe2b0', az, el, angR, frac, dist, d });
  }
  const star = objs.find((o) => o.type === 'star');
  // direction du soleil dans le plan du ciel (pour orienter les phases)
  for (const o of objs) { if (o.type === 'star') continue; o.limb = Math.atan2(star.el - o.el, (star.az - o.az) * Math.cos(o.el)); }
  // éclipses : disque plus grand devant l'étoile
  let eclipse = null;
  for (const o of objs) {
    if (o.type === 'star') continue;
    const sep = Math.acos(Math.max(-1, Math.min(1, dot(o.d, star.d) / (o.dist * star.dist))));
    const f = overlapFraction(star.angR, o.angR, sep);
    if (f > 0 && (!eclipse || f > eclipse.fraction) && o.dist < star.dist) eclipse = { by: o.name, fraction: f, total: f >= 0.999 };
  }
  const horizon = site.type === 'orbit' ? -Math.acos(Math.min(1, ob.radiusKm / (st.radiusKm || ob.radiusKm))) : 0;
  return { objs, sunEl: star ? star.el : 0, eclipse, horizon, own: ob.def.name, ownColor: ob.def.color };
}
