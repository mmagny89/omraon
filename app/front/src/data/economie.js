// Économie du système : marchandises, monnaie, profils des sites, transporteurs. TOUT est de la CONCEPTION (invented) :
// le roman nomme les fonctions mais aucun prix ni production. Valeurs en base (canon : app/donnees/canon/economie.json,
// modifiable par l'admin), via data/charger.js ; hypothèses dans docs/hypotheses.md et docs/modifications-lore.md.
// Unité de masse : la tonne (1 unité de marchandise = 1 t, sauf `volume`). `provisoire` : jamais affiché comme canon.
import { charger } from './charger.js';

const d = await charger('economie');

export const MONNAIE = d.MONNAIE;
export const MARCHANDISES = d.MARCHANDISES;
export const CONSO_HABITANT = d.CONSO_HABITANT;
export const CONSO_LUXE = d.CONSO_LUXE;
export const PROFILS = d.PROFILS;
export const TRANSPORTEURS = d.TRANSPORTEURS;
export const REGLAGES = d.REGLAGES;
