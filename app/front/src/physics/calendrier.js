// Calendrier de Kebet : le jour de Kebet (rotation synchrone = période orbitale autour de Zirkan) fait référence pour les jours,
// les heures, les minutes et les secondes affichées. Le temps interne de la simulation reste en jours terrestres (86 400 s SI) ;
// seule la présentation change. L'année (365,25 jours terrestres, canon du projet) n'est pas touchée.
import { G, AU_KM, TWO_PI, DAYS_PER_YEAR } from './constants.js';

export const HEURES_PAR_JOUR = 24;
let jourK = 1.28; // jours terrestres ; recalé par calibrerJour() depuis l'orbite réelle de Kebet

/** Durée du jour de Kebet, en jours terrestres. */
export const jourKebet = () => jourK;

/** Recale le jour de Kebet sur sa période orbitale (Kepler, masses de la simulation). Retourne la valeur posée. */
export function calibrerJour(sim) {
  const k = sim.bodies.find((b) => b.def.name === 'Kebet');
  if (!k) return jourK;
  const a = k.def.orbit.a / AU_KM, mu = G * (sim.mass[k.parent] + sim.mass[k.idx]);
  jourK = TWO_PI * Math.sqrt(a ** 3 / mu);
  return jourK;
}

/** Jours terrestres → jours de Kebet. */
export const enJoursKebet = (d) => d / jourK;
/** Secondes SI → secondes de Kebet (1 s de Kebet = jourK s SI, de sorte que 86 400 s de Kebet = 1 jour de Kebet). */
export const enSecondesKebet = (s) => s / jourK;

/** Date interne t (jours terrestres depuis le présent, An 300) → { an, jour, h, min, s } sur l'horloge de Kebet. */
export function decouperDate(t) {
  const an = Math.floor(t / DAYS_PER_YEAR), k = (t - an * DAYS_PER_YEAR) / jourK, jour = Math.floor(k), fr = k - jour;
  return { an, jour, h: Math.floor(fr * HEURES_PAR_JOUR), min: Math.floor((fr * 1440) % 60), s: Math.floor((fr * 86400) % 60) };
}

/** Durée en jours terrestres → équivalent terrestre en min / h / j (pour la parenthèse « Terre »). */
export function fmtTerre(d) {
  return d < 1 / HEURES_PAR_JOUR ? `${(d * 1440).toFixed(0)} min` : d < 2 ? `${(d * HEURES_PAR_JOUR).toFixed(1)} h` : `${d.toFixed(2)} j`;
}

/** Durée en jours terrestres → minutes, heures ou jours de Kebet, suivis de l'équivalent terrestre entre parenthèses ; années (365,25 j terrestres) au-delà de 400 j. */
export function fmtDuree(d, { minutes = false } = {}) {
  const k = d / jourK;
  if (d >= 400) return `${(d / DAYS_PER_YEAR).toFixed(2)} ans`;
  const base = minutes && k < 1 / HEURES_PAR_JOUR ? `${(k * 1440).toFixed(0)} min` : k < 2 ? `${(k * HEURES_PAR_JOUR).toFixed(1)} h` : `${k.toFixed(2)} j`;
  return `${base} (${fmtTerre(d)} Terre)`;
}

/** Durée en secondes SI → texte (min / h / j de Kebet) avec l'équivalent terrestre entre parenthèses. */
export function fmtSecondes(s) {
  const k = enSecondesKebet(s);
  const base = k < 7200 ? `${(k / 60).toFixed(0)} min` : k < 172800 ? `${(k / 3600).toFixed(1)} h` : `${(k / 86400).toFixed(2)} j`;
  return `${base} (${fmtTerre(s / 86400)} Terre)`;
}
