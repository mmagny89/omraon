// Lore repris des documents du roman (zip « Lore », docs 00–13) : calendrier, personnages, vestiges des Anciens.
// Valeurs en base (canon : app/donnees/canon/lore.json), via charger.js. Règles : pas de racines égyptiennes affichées,
// pas d'arcs ni de révélations ; `statut` d'un lieu : 'canon' ou 'provisoire' (voir docs/hypotheses.md).
// MOIS : 13 mois aux noms tyts fossilisés. PERSONNAGES : origine { corps, site (id de sites ou null), statut }, `vivant: false` si disparu.
// VESTIGES (les Iktu) : niveau 'canon' | 'iceberg' (indice, à ne jamais tout expliquer) | 'ouvert' ; `horsSysteme` : sans lieu.
import { charger } from './charger.js';

const d = await charger('lore');

export const MOIS = d.MOIS;
export const PERSONNAGES = d.PERSONNAGES;
export const VESTIGES = d.VESTIGES;
