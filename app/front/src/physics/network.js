import { planFlight } from './flight.js';
import { AU_KM } from './constants.js';

const MIN_PER_AU = 8.3167, AU_M = AU_KM * 1000;
export const lightDelayDays = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * MIN_PER_AU / 1440;

// Paramètres de conception (le document ne chiffre rien) : vitesse de diffusion locale (par jour) selon la densité du lieu,
// facteur de répression une fois l'ordre de coupure reçu, graine initiale (part de la population touchée par le message).
const RATE = { orbital: 1.2, open: 0.7, floating: 0.9, underground: 0.45, dome: 0.4 };
export function nodeParams(site) {
  let r = RATE[site.habitat] ?? 0.5;
  if (site.id.startsWith('sethis')) r *= 0.5; // cités isolées par le désert, ségrégation, milices
  const control = site.id.startsWith('kebet'), garrison = site.id.startsWith('sethis') || site.id === 'sedbou-garnison' || site.id === 'kalpra-mines';
  const rep = control ? 0.1 : garrison ? 0.2 : 0.35;
  return { r, rep, f0h: 0.03, f0t: 0.005, rt: 0.8, repT: 0.7 };
}

const informed = (t, tr, tk, r, rep, f0) => {
  if (!(t > tr)) return 0;
  const seg1 = Math.max(0, Math.min(t, tk) - tr), seg2 = Math.max(0, t - Math.max(tk, tr)), R = r * (seg1 + rep * seg2);
  return 1 / (1 + ((1 - f0) / f0) * Math.exp(-R));
};

/**
 * Propagation d'une information à travers les sites habités.
 * mode : 'diffusion' (poussée sur le réseau, ex. le piratage de Jax) | 'bouche' (de proche en proche, par vaisseaux).
 * topologie : 'direct' | 'controle' (tout passe par le Consortium, dont le filtre bloque ~65 % de la graine initiale) |
 *   'pirate' (chiffré : filtre quasi aveugle, ~10 % bloqué, et détection 4 fois plus lente).
 * Le Consortium (hub) apprend le message quand il le reçoit, ordonne la coupure après `detectMin`, et l'ordre voyage à la lumière :
 * chaque site, une fois l'ordre reçu, voit la diffusion locale ralentie (répression), sans pouvoir effacer ce qui est déjà su.
 * pos : Map(id → position UA à la date de départ).
 */
export function simulateSpread({ sites, pos, origin, mode = 'diffusion', topology = 'direct', hopMin = 2, detectMin = 360, horizonDays = 7, hubId = 'kebet-consortium', aG = 8, dwellDays = 0.5 }) {
  const hop = hopMin / 1440, det = (detectMin * (topology === 'pirate' ? 4 : 1)) / 1440, P = (id) => pos.get(id);
  const pass = topology === 'controle' ? 0.35 : topology === 'pirate' ? 0.9 : 1; // part du message qui franchit le filtre du Consortium
  const seed = mode === 'bouche' ? 0.02 : 1; // un messager informe quelques personnes ; un piratage en touche des milliers d'un coup
  const tr = new Map();
  if (mode === 'bouche') { // Dijkstra : temps de vol (hyperpropulsion) + escale
    const dist = new Map(sites.map((s) => [s.id, Infinity])), done = new Set(); dist.set(origin, 0);
    for (let k = 0; k < sites.length; k++) {
      let u = null; for (const s of sites) if (!done.has(s.id) && (u === null || dist.get(s.id) < dist.get(u))) u = s.id;
      done.add(u);
      for (const s of sites) {
        if (done.has(s.id)) continue;
        const d = Math.hypot(...[0, 1, 2].map((c) => P(u)[c] - P(s.id)[c])) * AU_M, w = planFlight(Math.max(d, 1000), aG, 0.95).total / 86400 + dwellDays;
        if (dist.get(u) + w < dist.get(s.id)) dist.set(s.id, dist.get(u) + w);
      }
    }
    for (const s of sites) tr.set(s.id, dist.get(s.id));
  } else {
    for (const s of sites) {
      if (s.id === origin) { tr.set(s.id, 0); continue; }
      tr.set(s.id, topology === 'controle' ? (s.id === hubId ? hop + lightDelayDays(P(origin), P(hubId)) : 2 * hop + lightDelayDays(P(origin), P(hubId)) + lightDelayDays(P(hubId), P(s.id)))
        : hop + lightDelayDays(P(origin), P(s.id)));
    }
  }
  const tHub = tr.get(hubId), tkOf = (id) => tHub + det + (id === hubId ? 0 : hop + lightDelayDays(P(hubId), P(id)));
  const nodes = sites.map((s) => {
    const q = nodeParams(s), t0 = tr.get(s.id), tk = tkOf(s.id), pop = s.population || 0, ty = s.tyts || 0;
    const fh = (t) => informed(t, t0, tk, q.r, q.rep, q.f0h * pass * seed), ft = (t) => informed(t, t0, tk, q.r * q.rt, q.rep * q.repT, q.f0t * pass * seed);
    return { id: s.id, name: s.name, pop, tyts: ty, tReceive: t0, tKill: tk, beforeKill: t0 < tk, fh, ft, f: (t) => (pop + ty ? (pop * fh(t) + ty * ft(t)) / (pop + ty) : 0), finalH: fh(horizonDays), finalT: ft(horizonDays) };
  });
  const totH = sites.reduce((a, s) => a + (s.population || 0), 0), totT = sites.reduce((a, s) => a + (s.tyts || 0), 0);
  const at = (t) => ({ t, humans: nodes.reduce((a, n) => a + n.pop * n.fh(t), 0) / totH, tyts: totT ? nodes.reduce((a, n) => a + n.tyts * n.ft(t), 0) / totT : 0 });
  const curve = [at(0)]; for (let e = Math.log10(1 / 1440); e <= Math.log10(horizonDays) + 1e-9; e += 1 / 14) curve.push(at(10 ** e));
  const first = (key, thr) => (curve.find((c) => c[key] >= thr) || {}).t ?? null;
  return {
    nodes, curve, totH, totT, hub: hubId, tHub, killAtHub: tHub + det, horizonDays,
    summary: { h10: first('humans', 0.1), h50: first('humans', 0.5), t50: first('tyts', 0.5), finalH: curve[curve.length - 1].humans, finalT: curve[curve.length - 1].tyts, reached: nodes.filter((n) => n.beforeKill).length, total: nodes.length },
  };
}
