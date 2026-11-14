// Lexique tyt (bible Tyts, doc 02) : mots et sens du roman (canon), sans références égyptiennes (jamais affichées).
// Valeurs en base (canon : app/donnees/canon/glossaire.json), via charger.js. Les noms des mondes et les mois sont ajoutés à l'exécution (ui/lore.js).
import { charger } from './charger.js';

export const GLOSSAIRE = (await charger('glossaire')).GLOSSAIRE;
