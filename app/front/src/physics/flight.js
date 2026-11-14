import { AU_KM } from './constants.js';

const C = 299792458, G0 = 9.80665, AU_M = AU_KM * 1000;

/**
 * Profil de vol rectiligne (SI) : accélération, [repos moteur], freinage. Newtonien : la vitesse de pointe en système
 * reste < 0,06 c (erreur < 0,2 %) ; le tableau de trajets utilise la formule relativiste.
 * Règle du document : l'hyperpropulsion ne tient pas plus de `maxBurnDays` jours en poussée continue. Si l'accélération
 * + le freinage dépassent cette durée, le vaisseau coupe le moteur (repos de `restDays` jours, hypothèse) au milieu du trajet.
 */
export function planFlight(dMeters, aG, vmaxFrac, { maxBurnDays = 6, restDays = 1 } = {}) {
  const a = aG * G0, vmax = vmaxFrac * C, d = dMeters, segs = [];
  let ta = Math.sqrt(d / a);
  if (a * ta > vmax) { // plafond de vitesse : croisière
    ta = vmax / a; segs.push({ kind: 'accel', dur: ta, a }, { kind: 'cruise', dur: (d - a * ta * ta) / vmax, a: 0 }, { kind: 'decel', dur: ta, a: -a });
  } else if (2 * ta > maxBurnDays * 86400) { // repos moteur obligatoire au milieu
    const R = restDays * 86400; ta = (-R + Math.sqrt(R * R + 4 * d / a)) / 2;
    segs.push({ kind: 'accel', dur: ta, a }, { kind: 'rest', dur: R, a: 0 }, { kind: 'decel', dur: ta, a: -a });
  } else segs.push({ kind: 'accel', dur: ta, a }, { kind: 'decel', dur: ta, a: -a });
  let t = 0, s = 0, v = 0;
  for (const g of segs) { g.t0 = t; g.s0 = s; g.v0 = v; s += v * g.dur + 0.5 * g.a * g.dur ** 2; v += g.a * g.dur; t += g.dur; g.t1 = t; }
  const total = t, at = (ts) => { ts = Math.max(0, Math.min(total, ts)); return segs.find((g) => ts <= g.t1) || segs[segs.length - 1]; };
  const rest = segs.find((g) => g.kind === 'rest');
  return {
    segs, total, peak: Math.max(...segs.map((g) => g.v0 + g.a * g.dur)),
    maxBurn: Math.max(...segs.filter((g) => g.kind !== 'rest').map((g) => g.dur)) * (rest ? 1 : 2), hasRest: !!rest,
    distAt(ts) { const g = at(ts), u = Math.max(0, Math.min(total, ts)) - g.t0; return g.s0 + g.v0 * u + 0.5 * g.a * u * u; },
    speedAt(ts) { const g = at(ts), u = Math.max(0, Math.min(total, ts)) - g.t0; return Math.max(0, g.v0 + g.a * u); },
    phaseAt(ts) { return ts >= total ? 'arrivee' : at(ts).kind; },
    /** durée de poussée continue en cours (s) : remise à zéro par le repos moteur */
    burnAt(ts) { if (!rest) return Math.min(ts, total); return ts < rest.t0 ? ts : ts < rest.t1 ? 0 : ts - rest.t1; },
  };
}

/**
 * Voyage vers une cible mobile : le vaisseau part de A0 à la date tDep et suit la droite vers la position PRÉVUE de la
 * destination à l'arrivée (point fixe sur la date d'arrivée). destPosAt(t) → position (UA) de la destination à la date t (jours).
 */
export function planVoyage({ A0, tDep, destPosAt, aG, vmax, opts }) {
  const dist = (T) => { const B = destPosAt(T); return { B, d: Math.hypot(B[0] - A0[0], B[1] - A0[1], B[2] - A0[2]) * AU_M }; };
  let T = tDep, plan, B, d;
  for (let k = 0; k < 30; k++) {
    ({ B, d } = dist(T)); plan = planFlight(Math.max(d, 1), aG, vmax, opts);
    const Tn = tDep + plan.total / 86400;
    if (Math.abs(Tn - T) < 1e-7) { T = Tn; break; } T = Tn;
  }
  ({ B, d } = dist(T)); plan = planFlight(Math.max(d, 1), aG, vmax, opts);
  const dir = [0, 1, 2].map((c) => (B[c] - A0[c]) / (d / AU_M));
  return { tDep, tArr: tDep + plan.total / 86400, plan, A0: A0.slice(), dir, Bend: B, dMeters: d };
}

/** Position (UA), vitesse (m/s) et phase du vaisseau à la date t (jours). `destNow` : position réelle de la destination à t (corrige l'écart de prévision). */
export function voyageAt(v, t, destNow) {
  const ts = (t - v.tDep) * 86400, s = v.plan.distAt(ts), sUA = s / AU_M, w = (s / v.dMeters) ** 2;
  const pos = [0, 1, 2].map((c) => v.A0[c] + v.dir[c] * sUA + (destNow ? w * (destNow[c] - v.Bend[c]) : 0));
  return { pos, speed: v.plan.speedAt(ts), phase: v.plan.phaseAt(ts), progress: Math.min(1, s / v.dMeters), elapsed: Math.max(0, ts), burn: v.plan.burnAt(ts), done: ts >= v.plan.total };
}
