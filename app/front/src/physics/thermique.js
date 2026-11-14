// Températures des astres (face éclairée, face sombre) et des sites (en temps réel). Sans DOM, sans Three.js.
//
// Modèle (conception, calé sur des corps réels ; voir docs/hypotheses.md) :
//  - Teq : équilibre d'un corps à rotation rapide (albédo, éclipses par la géante parente) ;
//  - sans atmosphère, point subsolaire : Teq·√2 (équilibre instantané, 4^¼ = √2) ;
//  - sans atmosphère, face sombre : Teq · 0,35 · (durée de la nuit / 14,8 j)^-¼, plafonné à 0,9 Teq. Calage : la Lune (nuit de 14,8 j : ≈ 95 K)
//    et Mercure (nuit de 88 j : ≈ 100 K) ;
//  - une atmosphère de P bar réduit l'écart jour/nuit d'un facteur 1 + 14·P (Terre : écart de ≈ 10 K au lieu de ≈ 150 K ; Mars : peu réduit ;
//    Vénus : nul) et élève la moyenne de l'effet de serre `habitat.greenhouseK` ;
//  - géante gazeuse : pas de surface, la même température sur les deux faces, à 1 bar (chaleur interne × Teq) ;
//  - station tenue en place : coque éclairée à Teq(albédo 0,3)·√2, à l'ombre du corps elle ne reçoit que l'infrarouge de la face sombre.
import { equilibriumTemp, starLuminosity } from './derived.js';
import { G, AU_KM } from './constants.js';

const TWO_PI = 2 * Math.PI, T_FLOOR = 3; // K : fond diffus
const ALBEDO_STATION = 0.3, ALBEDO_ASTEROIDE = 0.1;
const facteurNuit = (nuitJours) => Math.min(0.9, Math.max(0.15, 0.35 * Math.pow(nuitJours / 14.8, -0.25)));

/** Demi-grand axe (UA) : élément osculateur du N-corps, ou à défaut l'orbite nominale du canon (avant le premier calcul, au chargement). */
function demiGrandAxe(sim, el, idx) {
  const e = el(idx);
  if (e?.a) return e.a;
  const b = sim.bodies[idx], a = b.def.orbit?.a ?? 1;
  return b.type === 'moon' ? a / AU_KM : a;
}

/** Période orbitale (jours) du corps `idx` autour de son parent (la planète autour de l'étoile, la lune autour de sa planète). */
function periodeOrbitale(sim, el, idx) {
  const b = sim.bodies[idx], parent = b.type === 'moon' ? b.parent : 0;
  return TWO_PI * Math.sqrt(demiGrandAxe(sim, el, idx) ** 3 / (G * (sim.mass[parent] + sim.mass[idx])));
}

/** Période de rotation propre (jours) : une lune est verrouillée sur sa planète. */
function periodeRotation(sim, el, idx) {
  const b = sim.bodies[idx], r = b.def.rotation;
  if (b.type === 'moon') return periodeOrbitale(sim, el, idx);
  if (r?.periodH) return r.periodH / 24;
  if (r?.spinOrbitRatio) return periodeOrbitale(sim, el, idx) / r.spinOrbitRatio;
  return 1;
}

/** Durée du jour solaire (jours) : plus longue que la rotation propre quand le corps tourne dans le sens de son orbite. */
export function jourSolaire(sim, el, idx) {
  const b = sim.bodies[idx], planete = b.type === 'moon' ? b.parent : idx;
  const rot = periodeRotation(sim, el, idx), an = periodeOrbitale(sim, el, planete);
  const d = Math.abs(1 / rot - 1 / an);
  return d < 1e-9 ? Infinity : 1 / d;
}

/** Température d'équilibre au corps `idx` (K) et distance à l'étoile (UA), éclipses par la géante parente comprises. */
function equilibre(sim, el, idx, albedo) {
  const b = sim.bodies[idx], star = sim.bodies[0].def, planete = b.type === 'moon' ? b.parent : idx;
  const aStar = demiGrandAxe(sim, el, planete), parent = b.type === 'moon' ? sim.bodies[b.parent] : null;
  const ecl = parent && parent.def.kind === 'gas' ? Math.asin(Math.min(1, parent.radiusKm / (demiGrandAxe(sim, el, idx) * AU_KM))) / Math.PI : 0;
  return { Teq: equilibriumTemp(star, aStar, albedo) * Math.pow(1 - ecl, 0.25), aStar };
}

/**
 * Températures d'un astre : { mode, jour, nuit, moyenne } en K.
 * mode : 'etoile' (photosphère), 'geante' (à 1 bar, deux faces identiques), 'solide'.
 * Pour un solide : jour = point subsolaire, nuit = point antisolaire, moyenne = moyenne globale.
 */
export function facesCorps(sim, el, idx) {
  const b = sim.bodies[idx], d = b.def;
  if (b.type === 'star') return { mode: 'etoile', jour: d.teff, nuit: d.teff, moyenne: d.teff };
  const hab = d.habitat || {}, P = hab.pressureBar ?? 0, gh = hab.greenhouseK ?? 0;
  const { Teq } = equilibre(sim, el, idx, d.albedo ?? 0.3);
  if (d.kind === 'gas') { const T1 = (hab.internalHeat ?? 1.5) * Teq; return { mode: 'geante', jour: T1, nuit: T1, moyenne: T1 }; }
  const solaire = jourSolaire(sim, el, idx), nuitJ = Number.isFinite(solaire) ? solaire / 2 : Infinity;
  const f = facteurNuit(nuitJ), R = 1 + 14 * P, moyenne = Teq + gh;
  return {
    mode: 'solide', moyenne, jourSolaireJ: solaire,
    jour: moyenne + (Math.SQRT2 * Teq - Teq) / R,
    nuit: Math.max(T_FLOOR, moyenne - (Teq - f * Teq) / R),
  };
}

/**
 * Température d'un site à l'instant de `st` (position et normale issues de siteState).
 * Retourne { dehors, dedans, regime, jour } : `dehors` en K (extérieur, en direct), `dedans` = température tenue dans l'habitat.
 * `jour` : le Soleil est-il levé (null si sans objet).
 */
export const T_HABITAT = 293;
export function temperatureSite(sim, el, site, st) {
  const sp = sim.rPos, star = sim.bodies[0].def, L = starLuminosity(star);
  const sunDir = [0, 1, 2].map((k) => sp[k] - st.pos[k]), dS = Math.hypot(...sunDir);
  sunDir.forEach((_, k) => (sunDir[k] /= dS));
  const dedans = T_HABITAT;

  if (site.type === 'heliocentric') { // astéroïde : rotation de quelques heures, orientation inconnue → moyenne
    const Teq = equilibriumTemp(star, dS, ALBEDO_ASTEROIDE);
    return { dehors: Teq, dedans, regime: 'Surface d\'astéroïde (moyenne : rotation rapide supposée)', jour: null };
  }
  const idx = st.idx, body = sim.bodies[idx], fa = facesCorps(sim, el, idx), P = body.def.habitat?.pressureBar ?? 0;

  if (site.type === 'floating') return { dehors: fa.moyenne, dedans, regime: 'À 1 bar dans l\'atmosphère de la géante', jour: null };

  if (site.type === 'surface') {
    const cosz = st.normal[0] * sunDir[0] + st.normal[1] * sunDir[1] + st.normal[2] * sunDir[2];
    const lat = Math.abs(site.lat ?? 0) * Math.PI / 180, decalage = -30 * Math.sin(lat) ** 2 * Math.min(1, P / 0.3);
    const w = cosz > 0 ? Math.pow(cosz, 0.25) : 0;
    const dehors = Math.max(T_FLOOR, fa.nuit + decalage + (fa.jour - fa.nuit) * w);
    return { dehors, dedans, regime: cosz > 0 ? 'Jour' : 'Nuit', jour: cosz > 0 };
  }

  // station (tenue en place ou orbitale) : coque éclairée ou dans l'ombre du corps
  const rel = [0, 1, 2].map((k) => st.pos[k] - sp[3 * idx + k]), h = Math.hypot(...rel);
  const along = rel[0] * sunDir[0] + rel[1] * sunDir[1] + rel[2] * sunDir[2];
  const perp = Math.sqrt(Math.max(0, h * h - along * along)) * AU_KM;
  const eclipse = along < 0 && perp < body.radiusKm;
  if (!eclipse) return { dehors: Math.SQRT2 * equilibriumTemp(star, dS, ALBEDO_STATION), dedans, regime: 'Coque au Soleil', jour: true };
  const vue = (body.radiusKm / (body.radiusKm + (h * AU_KM - body.radiusKm))) ** 2 / 4;
  return { dehors: Math.max(T_FLOOR, fa.nuit * Math.pow(vue, 0.25)), dedans, regime: `Dans l'ombre de ${body.def.name}`, jour: false };
}
