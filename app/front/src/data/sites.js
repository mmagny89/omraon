// Sites habités (cités, stations, bases). Valeurs en base (canon : app/donnees/canon/sites.json, modifiable par
// l'admin), via data/charger.js. Les ordres de grandeur de population suivent le document « Économie, théologie du
// travail et échelles » ; emplacements et tailles sont des propositions de conception (`invented: true`).
//
// type 'surface' (lat, lon) | 'orbit' (altKm, incl, node, phase) | 'floating' (cité flottante, 1 bar d'une géante)
// | 'heliocentric' (orbite autour de l'étoile). population = humains ; tyts = Tyts sur place.
// habitat : 'dome' | 'underground' | 'orbital' | 'floating' | 'open'. `fixe` : point fixe dans le repère du corps
// (le port de Kebet tient au-dessus de la capitale, voir docs/modifications-lore.md n° 25).
import { charger } from './charger.js';

export const SITES = (await charger('sites')).SITES;
