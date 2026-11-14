// Chronologie du roman (doc « 10 Chronologie »). Ordres de grandeur d'auteur, pas des dates à citer.
// L'An 0 est le début de l'Ère confédérale (fin des Siècles Sombres). Le présent du roman est donc l'An 300 (conception : 300 ans d'Ère confédérale, d'après la durée de l'ère).
// En interne, le temps et les années restent comptés depuis le présent (0 = présent, années de 365,25 jours) : la simulation prend les éléments orbitaux de omraon.js au présent.
// Seul l'affichage convertit, par `fmtAn` : année affichée = année interne + AN_PRESENT.
import { charger } from './charger.js';

export const PRESENT_YEAR = 0;
export const AN_PRESENT = 300;
/** Année interne (0 = présent) → année de l'Ère confédérale (An 0 = fin des Siècles Sombres). */
export const anAffiche = (y) => y + AN_PRESENT;
/** Année de l'Ère confédérale → année interne. */
export const anInterne = (a) => a - AN_PRESENT;
/** « An 300 », « An −260 » (avant l'Ère confédérale). */
export const fmtAn = (y) => `An ${String(Math.round(anAffiche(y))).replace('-', '−')}`;
/** Ères et événements : valeurs en base (canon : app/donnees/canon/chronologie.json), via charger.js. */
const d = await charger('chronologie');
export const ERAS = d.ERAS;
export const EVENTS = d.EVENTS;
export const eraAt = (year) => ERAS.find((e) => year >= e.from && year < e.to) || ERAS[ERAS.length - 1];
// Évolution de la luminosité sur la séquence principale (estimation : +13 % par Gyr pour une étoile de 1,10 M☉, un peu plus rapide que le Soleil, ≈ +10 %).
export const LUMINOSITY_GROWTH_PER_GYR = 0.13;
export const systemAgeGyr = (star, year) => (star.ageGyr ?? 3) + year / 1e9;
