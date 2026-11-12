import { G, AU_KM } from './constants.js';

const G0 = 9.80665;
// Propulsions du document « Technologie du monde » : subliminique ~0,1 c ; hyperpropulsion ~0,95 c, 6 jours continus au plus.
// L'accélération n'est PAS fixée par le document : valeurs par défaut de conception, modifiables.
// 8 g est l'ordre de grandeur qui fait traverser les 35 UA du système en 6 jours (le plafond du moteur).
export const PROPULSION = {
  hyper: { label: 'Hyperpropulsion (0,95 c, 6 j terrestres max)', mode: 'cruise', vmax: 0.95, acc: 8, maxDays: 6 },
  subliminique: { label: 'Subliminique (0,1 c)', mode: 'cruise', vmax: 0.1, acc: 1 },
  chimique: { label: 'Chimique (référence Hohmann)', mode: 'hohmann', isp: 450 },
};
const C = 299792458;
/** Trajet rectiligne, retournement à mi-course, accélération constante a (m/s²) plafonnée à vmax·c, relativiste. */
export function cruise(dMeters, a, vmax) {
  const beta = vmax, gam = 1 / Math.sqrt(1 - beta * beta), dAcc = (C * C / a) * (gam - 1);
  if (2 * dAcc >= dMeters) {
    const t = (C / a) * Math.sqrt((1 + a * dMeters / (2 * C * C)) ** 2 - 1), v = a * t / Math.sqrt(1 + (a * t / C) ** 2);
    return { t: 2 * t, peak: v / C, cruised: false };
  }
  const tAcc = (C / a) * Math.sqrt(gam * gam - 1);
  return { t: 2 * tAcc + (dMeters - 2 * dAcc) / (beta * C), peak: beta, cruised: true };
}
const muKm = (mSun) => G * mSun * AU_KM ** 3 / 86400 ** 2; // km³/s²

/** Transfert de Hohmann entre orbites circulaires r1 -> r2 (même unité) : Δv en km/s si mu en km³/s² et r en km. */
export function hohmann(mu, r1, r2) {
  const a = (r1 + r2) / 2;
  const v1 = Math.sqrt(mu / r1), v2 = Math.sqrt(mu / r2);
  const dv1 = Math.abs(Math.sqrt(mu * (2 / r1 - 1 / a)) - v1), dv2 = Math.abs(v2 - Math.sqrt(mu * (2 / r2 - 1 / a)));
  return { dv1, dv2, dv: dv1 + dv2, t: Math.PI * Math.sqrt(a ** 3 / mu), vinf1: dv1, vinf2: dv2 };
}
const escapeDv = (mu, r, vinf) => Math.sqrt(vinf * vinf + 2 * mu / r) - Math.sqrt(mu / r);
const vcirc = (mu, r) => Math.sqrt(mu / r);

/** Chaîne site -> corps -> planète -> étoile. */
function node(ctx, site, st) {
  const sim = ctx.sim;
  if (site.type === 'heliocentric') return { helio: true, rHelio: Math.hypot(...[0, 1, 2].map((k) => st.pos[k] - sim.rPos[k])), planet: null, body: null, site, st };
  const body = sim.bodies[st.idx], planet = body.type === 'moon' ? sim.bodies[body.parent] : body;
  const rel = (i) => Math.hypot(...[0, 1, 2].map((k) => sim.rPos[3 * i + k] - sim.rPos[k]));
  return { helio: false, body, planet, rHelio: rel(planet.idx), site, st };
}
// Δv local pour quitter (ou rejoindre) l'orbite basse autour de la planète depuis le site
function local(ctx, n, vinf) {
  const sim = ctx.sim, { site, body, planet } = n;
  if (n.helio) return { dv: 0, parts: [] };
  const muP = muKm(sim.mass[planet.idx]), parts = [];
  const atm = (body.def.habitat?.pressureBar ?? 0) >= 0.3 || body.def.kind === 'gas';
  const lowR = (b) => b.radiusKm * 1.05;
  let dv = 0;
  if (body.type === 'moon') {
    const muM = muKm(sim.mass[body.idx]);
    if (site.type === 'surface') { const a = vcirc(muM, lowR(body)) * (atm ? 1.2 : 1.05); dv += a; parts.push(['montée depuis ' + body.def.name, a]); }
    const toSoi = (Math.SQRT2 - 1) * vcirc(muM, site.type === 'orbit' ? st(n) : lowR(body)); dv += toSoi; parts.push(['sortie du puits de ' + body.def.name, toSoi]);
    const aM = Math.hypot(...[0, 1, 2].map((k) => sim.rPos[3 * body.idx + k] - sim.rPos[3 * planet.idx + k])) * AU_KM;
    const e = escapeDv(muP, aM, vinf); dv += e; parts.push(['évasion de ' + planet.def.name, e]);
  } else {
    let r = lowR(body);
    if (site.type === 'surface' || site.type === 'floating') { const a = vcirc(muP, r) * (atm ? 1.2 : 1.05); dv += a; parts.push(['montée depuis ' + body.def.name, a]); }
    else r = st(n);
    const e = escapeDv(muP, r, vinf); dv += e; parts.push(['évasion de ' + planet.def.name, e]);
  }
  return { dv, parts };
}
const st = (n) => n.st.radiusKm;

/**
 * Trajet entre deux sites. ctx : { sim }. sa, sb : sites ; ea, eb : états (siteState).
 * Retourne distances, délai lumière, Hohmann (Δv, durée, fenêtre) et croisière à accélération constante.
 */
export function transfer(ctx, sa, ea, sb, eb, propKey, accG) {
  const sim = ctx.sim, prop = PROPULSION[propKey], muS = muKm(sim.mass[0]);
  const d = Math.hypot(...[0, 1, 2].map((k) => ea.pos[k] - eb.pos[k])) * AU_KM;
  const out = { distKm: d, lightMin: d / 299792.458 / 60, prop };
  const A = node(ctx, sa, ea), B = node(ctx, sb, eb);
  let dvOrbit, t, parts = [], window = null, scope;
  const samePlanet = A.planet && B.planet && A.planet.idx === B.planet.idx;
  if (!A.helio && !B.helio && samePlanet) {
    scope = 'dans le système de ' + A.planet.def.name;
    if (A.body.idx === B.body.idx) { // même corps : saut balistique ou rendez-vous
      const mu = muKm(sim.mass[A.body.idx]), r = A.body.radiusKm * 1.05, v = vcirc(mu, r);
      dvOrbit = sa.type === 'surface' && sb.type === 'surface' ? 2 * v * 1.05 : v * 1.05 + 0.1 * v; t = Math.PI * Math.sqrt(r ** 3 / mu);
      parts.push(['saut / rendez-vous local', dvOrbit]);
    } else {
      const muP = muKm(sim.mass[A.planet.idx]);
      const rr = (n) => (n.body.type === 'moon' ? Math.hypot(...[0, 1, 2].map((k) => sim.rPos[3 * n.body.idx + k] - sim.rPos[3 * n.planet.idx + k])) * AU_KM : (n.site.type === 'orbit' ? n.st.radiusKm : n.body.radiusKm * 1.05));
      const r1 = rr(A), r2 = rr(B), h = hohmann(muP, r1, r2);
      const asc = (n, tag) => { // montée/descente locale du corps (sans évasion planétaire)
        if (n.body.type !== 'moon' && n.site.type !== 'surface' && n.site.type !== 'floating') return 0;
        const b = n.body, mu = muKm(sim.mass[b.idx]), atm = (b.def.habitat?.pressureBar ?? 0) >= 0.3 || b.def.kind === 'gas';
        let v = 0;
        if (n.site.type === 'surface' || n.site.type === 'floating') v += vcirc(mu, b.radiusKm * 1.05) * (atm ? 1.2 : 1.05);
        if (b.type === 'moon') v += (Math.SQRT2 - 1) * vcirc(mu, n.site.type === 'orbit' ? n.st.radiusKm : b.radiusKm * 1.05);
        if (v) parts.push([tag + ' ' + b.def.name, v]);
        return v;
      };
      const up = asc(A, 'montée depuis'), down = asc(B, 'descente sur');
      dvOrbit = up + h.dv + down; t = h.t; parts.push(['Hohmann ' + A.planet.def.name, h.dv]);
      const n1 = Math.sqrt(muP / r1 ** 3), n2 = Math.sqrt(muP / r2 ** 3);
      const lam = (n) => Math.atan2(n.st.pos[1] - sim.rPos[3 * A.planet.idx + 1], n.st.pos[0] - sim.rPos[3 * A.planet.idx]);
      if (Math.abs(n1 - n2) > 1e-12) {
        const req = Math.PI - n2 * t, phi = lam(B) - lam(A), w = ((phi - req) / (n1 - n2));
        const syn = 2 * Math.PI / Math.abs(n1 - n2); window = (((w % syn) + syn) % syn) / 86400;
        out.synodicDays = syn / 86400;
      }
    }
  } else {
    scope = 'interplanétaire';
    const rA = A.rHelio * AU_KM, rB = B.rHelio * AU_KM, h = hohmann(muS, rA, rB);
    const la = local(ctx, A, h.vinf1), lb = local(ctx, B, h.vinf2);
    dvOrbit = la.dv + h.dv * 0 + lb.dv; // les Δv d'évasion/capture incluent déjà l'excès hyperbolique
    parts = [...la.parts, ...lb.parts.map(([n, v]) => [n.replace('montée depuis', 'descente sur').replace('évasion de', 'capture par'), v])];
    if (A.helio) { dvOrbit += h.vinf1; parts.unshift(['départ héliocentrique', h.vinf1]); }
    if (B.helio) { dvOrbit += h.vinf2; parts.push(['arrivée héliocentrique', h.vinf2]); }
    t = h.t;
    const n1 = Math.sqrt(muS / rA ** 3), n2 = Math.sqrt(muS / rB ** 3);
    const lam = (n) => Math.atan2(n.st.pos[1] - sim.rPos[1], n.st.pos[0] - sim.rPos[0]);
    if (Math.abs(n1 - n2) > 1e-12) {
      const req = (rB > rA ? Math.PI : -Math.PI) - n2 * t, phi = lam(B) - lam(A), syn = 2 * Math.PI / Math.abs(n1 - n2);
      const w = ((phi - req) / (n1 - n2));
      window = (((w % syn) + syn) % syn) / 86400; out.synodicDays = syn / 86400;
    }
  }
  out.scope = scope; out.parts = parts; out.windowDays = window;
  out.hohmann = { dv: dvOrbit, days: t / 86400, ratio: Math.exp(dvOrbit * 1000 / (450 * G0)) };
  // croisière à accélération constante (distance actuelle)
  if (prop.mode === 'cruise') {
    const g = accG > 0 ? accG : prop.acc, cr = cruise(d * 1000, g * G0, prop.vmax);
    out.cruise = { days: cr.t / 86400, peakBeta: cr.peak, cruised: cr.cruised, accG: g };
    if (prop.maxDays) { out.cruise.overLimit = cr.t / 86400 > prop.maxDays; out.cruise.restStops = Math.max(0, Math.ceil(cr.t / 86400 / prop.maxDays) - 1); }
    out.shuttle = { dv: parts.filter(([n]) => /montée|descente|sortie/.test(n)).reduce((s, [, v]) => s + v, 0) };
  }
  return out;
}
