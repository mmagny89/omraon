// Système d'Omraon — bible géographique v3 (ordre figé : 3 telluriques → ceinture → 2 gazeuses).
// Les valeurs vivent en base (canon : app/donnees/canon/systeme.json, modifiable par l'admin) et arrivent par
// data/charger.js. Canon contre conception : le document ne fixe que l'ordre, les rôles, les noms et « ~35 UA
// du centre au bord » ; toute autre valeur est une proposition de conception, listée dans docs/hypotheses.md.
// Les racines égyptiennes des noms sont « jamais affichées » : absentes de l'interface.
import { charger } from './charger.js';

const d = await charger('systeme');

export const STAR = d.STAR;
export const SYSTEM_EDGE_AU = d.SYSTEM_EDGE_AU;
export const PLANETS = d.PLANETS;
export const BELT = d.BELT;
export const COLD_BELT = d.COLD_BELT;
export const ROUSHAN_TROJANS = d.ROUSHAN_TROJANS;
export const COMETS = d.COMETS;
