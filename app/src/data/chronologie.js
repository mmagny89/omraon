// Chronologie du roman (doc « 10 Chronologie »). Ordres de grandeur d'auteur, pas des dates à citer.
// L'An 0 est le début de l'Ère confédérale (fin des Siècles Sombres). Le présent du roman est donc l'An 300 (conception : 300 ans d'Ère confédérale, d'après la durée de l'ère).
// En interne, le temps et les années restent comptés depuis le présent (0 = présent, années de 365,25 jours) : la simulation prend les éléments orbitaux de omraon.js au présent.
// Seul l'affichage convertit, par `fmtAn` : année affichée = année interne + AN_PRESENT.
export const PRESENT_YEAR = 0;
export const AN_PRESENT = 300;
/** Année interne (0 = présent) → année de l'Ère confédérale (An 0 = fin des Siècles Sombres). */
export const anAffiche = (y) => y + AN_PRESENT;
/** Année de l'Ère confédérale → année interne. */
export const anInterne = (a) => a - AN_PRESENT;
/** « An 300 », « An −260 » (avant l'Ère confédérale). */
export const fmtAn = (y) => `An ${String(Math.round(anAffiche(y))).replace('-', '−')}`;
export const ERAS = [
  { from: -960, to: -560, label: 'Voyage des arches (0,35 c, cryo) — hors système', outside: true },
  { from: -560, to: -500, label: 'La cohabitation (~60 ans)' },
  { from: -500, to: -300, label: 'Les Siècles Sombres' },
  { from: -300, to: 0, label: 'Ère confédérale : le long oubli, le dégel' },
  { from: 0, to: 1e9, label: 'Après le présent' },
];
export const EVENTS = [
  { year: -960, label: 'Départ de la Terre', note: 'Catastrophe technologique fondatrice ; arche de ~10 000 personnes.', outside: true },
  { year: -560, label: 'Arrivée à Omraon', note: 'Accueil par les Tyts, déjà présents en pèlerinage sur Kebet.' },
  { year: -500, label: 'Double basculement', note: 'Crime 1 : Kebet profanée et asservie. Crime 2 : génocide du monde natal tyt (hors système).' },
  { year: -300, label: 'Fin des Siècles Sombres', note: 'La Confédération prend sa forme présente ; le dégel commence.' },
  { year: -2, label: 'Les deux réveils', note: 'Mort de Mai ; réveil de la mémoire de Mira.' },
  { year: 0, label: 'Présent du roman', note: 'La mission d\'Onkel ; le système est à un point de bascule.' },
];
export const eraAt = (year) => ERAS.find((e) => year >= e.from && year < e.to) || ERAS[ERAS.length - 1];
// Évolution de la luminosité sur la séquence principale (estimation : +13 % par Gyr pour une étoile de 1,10 M☉, un peu plus rapide que le Soleil, ≈ +10 %).
export const LUMINOSITY_GROWTH_PER_GYR = 0.13;
export const systemAgeGyr = (star, year) => (star.ageGyr ?? 3) + year / 1e9;
