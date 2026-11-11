// Chronologie du roman (doc « 10 Chronologie ») : présent du roman = An 0. Ordres de grandeur d'auteur, pas des dates à citer.
// La simulation prend les éléments orbitaux de omraon.js à l'An 0 et intègre vers le passé ou le futur (années de 365,25 jours).
export const PRESENT_YEAR = 0;
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
// Évolution de la luminosité sur la séquence principale (estimation : +17,5 % par Gyr pour une étoile de 1,25 M☉, plus rapide que le Soleil).
export const LUMINOSITY_GROWTH_PER_GYR = 0.175;
export const systemAgeGyr = (star, year) => (star.ageGyr ?? 3) + year / 1e9;
