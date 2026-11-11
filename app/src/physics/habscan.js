import { cloneForEphemeris } from './ephemeris.js';
import { equilibriumTemp, starLuminosity } from './derived.js';
import { tidalHeatingWm2 } from './habitability.js';
import { stateToElements } from './kepler.js';
import { AU_KM, M_SUN_KG } from './constants.js';

const band = (v, okLo, okHi, wLo, wHi) => (v >= okLo && v <= okHi ? 'ok' : v >= wLo && v <= wHi ? 'warn' : 'bad');

/**
 * « Habitable en permanence ? » : fait tourner une copie de la simulation sur `years` ans et relève, pour un corps à surface
 * habitable, les extrêmes de flux, de température (saisons de l'orbite autour de l'étoile + éclipses par la géante),
 * d'excentricité et de chauffage de marée (∝ e², donc très sensible).
 */
export function habitabilityScan(sim, idx, years = 5, stepDays = 1) {
  const c = cloneForEphemeris(sim), b = c.bodies[idx], d = b.def, star = c.bodies[0].def, L = starLuminosity(star);
  const planet = b.type === 'moon' ? c.bodies[b.parent] : b, gh = d.habitat?.greenhouseK ?? 0, albedo = d.albedo ?? 0.3;
  const gas = b.type === 'moon' && planet.def.kind === 'gas';
  const r = { T: [Infinity, -Infinity], S: [Infinity, -Infinity], e: [Infinity, -Infinity], heat: [Infinity, -Infinity] }, upd = (k, v) => { r[k][0] = Math.min(r[k][0], v); r[k][1] = Math.max(r[k][1], v); };
  const end = c.t + years * 365.25, P = c.pos;
  const sample = () => {
    const dStar = Math.hypot(P[3 * planet.idx] - P[0], P[3 * planet.idx + 1] - P[1], P[3 * planet.idx + 2] - P[2]);
    let ecl = 0, heat = 0, e = 0;
    if (b.type === 'moon') {
      const q = c.elementState(idx), el = stateToElements(q.mu, q.r, q.v); e = el.e;
      if (gas) ecl = Math.asin(Math.min(1, planet.radiusKm / (el.a * AU_KM))) / Math.PI;
      heat = tidalHeatingWm2({ Mp: planet.mass * M_SUN_KG, R: b.radiusKm * 1000, a: el.a * AU_KM * 1000, e });
    }
    upd('S', L / (dStar * dStar)); upd('T', equilibriumTemp(star, dStar, albedo) * Math.pow(1 - ecl, 0.25) + gh); upd('e', e); upd('heat', heat);
  };
  sample();
  while (c.t < end) { const t1 = c.t + stepDays; while (c.t + c.h1 <= t1) c.substep(c.h1); sample(); }
  const status = { T: band(r.T[0], 278, 308, 273, 340) === 'ok' && band(r.T[1], 278, 308, 273, 340) === 'ok' ? 'ok' : (r.T[0] >= 273 && r.T[1] <= 340 ? 'warn' : 'bad'), heat: r.heat[1] < 0.5 ? 'ok' : r.heat[1] < 3 ? 'warn' : 'bad' };
  const always = status.T === 'ok' && status.heat === 'ok';
  const need = Math.max(0, 278 - r.T[0]), allowed = Math.max(0, 308 - r.T[1]);
  return { years, ...r, status, always, greenhouseNeeded: need, greenhouseMargin: allowed };
}
