// Statut d'une information affichée : canon (fixé par les documents du roman), suggéré (clé `conception` : proposition de la
// simulation, listée dans docs/hypotheses.md), calculé (déduit en direct des deux précédents), simulé (résultat d'une simulation),
// modifié (valeur par défaut changée par un admin), provisoire (nom ou valeur à confirmer).
import { tipTexte } from './tooltips.js';

export const STATUTS = {
  canon: { label: 'canon', tip: tipTexte('Canon', 'Fixé par les documents du roman (00–13) : noms, ordre du système, rôles.') },
  conception: { label: 'suggéré', tip: tipTexte('Suggéré', 'Proposition de la simulation (valeur de conception) : le roman ne chiffre pas cette valeur. Elle est listée dans docs/hypotheses.md et modifiable par un administrateur.') },
  calcule: { label: 'calculé', tip: tipTexte('Calculé', 'Déduit en direct par la simulation à partir des valeurs du canon et de la conception.') },
  simule: { label: 'simulé', tip: tipTexte('Simulé', 'Résultat d\'une simulation (population, économie, réseau) : il dépend des réglages du panneau, et du hasard si tu l\'actives.') },
  modifie: { label: 'modifié', tip: tipTexte('Modifié', 'Valeur par défaut modifiée par un administrateur : elle diffère du canon d\'origine.') },
  provisoire: { label: 'provisoire', tip: tipTexte('Provisoire', 'Nom ou valeur à confirmer : le roman n\'a pas tranché (voir docs/hypotheses.md).') },
};

/** Statut d'une section de fiche de site, d'après son titre (les paramètres de vie, d'énergie et de structure sont de conception). */
export const statutSection = (titre) => (/^(Énergie|Vie|Structure)/.test(titre) ? 'conception' : 'calcule');
