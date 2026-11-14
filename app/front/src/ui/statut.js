// Statut d'une information affichée : canon (fixé par les documents du roman), conception (proposition de la simulation,
// listée dans docs/hypotheses.md), calculé (déduit en direct des deux précédents), provisoire (nom ou valeur à confirmer).
import { tipTexte } from './tooltips.js';

export const STATUTS = {
  canon: { label: 'canon', tip: tipTexte('Canon', 'Fixé par les documents du roman (00–13) : noms, ordre du système, rôles.') },
  conception: { label: 'conception', tip: tipTexte('Conception', 'Proposition de la simulation : le roman ne chiffre pas cette valeur. Elle est listée dans docs/hypotheses.md et modifiable dans les données.') },
  calcule: { label: 'calculé', tip: tipTexte('Calculé', 'Déduit en direct par la simulation à partir des valeurs du canon et de la conception.') },
  provisoire: { label: 'provisoire', tip: tipTexte('Provisoire', 'Nom ou valeur à confirmer : le roman n\'a pas tranché (voir docs/hypotheses.md).') },
};

/** Statut d'une section de fiche de site, d'après son titre (les paramètres de vie, d'énergie et de structure sont de conception). */
export const statutSection = (titre) => (/^(Énergie|Vie|Structure)/.test(titre) ? 'conception' : 'calcule');
