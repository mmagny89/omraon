// Banque d'images pour écrire une scène. Les trois mondes Kebet, Sethis, Roushan reprennent les documents
// « Quotidien sensoriel » (canon) ; les autres (stations, bases souterraines) sont des propositions génériques
// (canon: false) qui déduisent l'ambiance de la physique du lieu. Banque d'images, pas un canon.
// Valeurs en base (canon : app/donnees/canon/ambiances.json), via charger.js ; seule la règle de choix reste ici
// (et son pendant PHP : App\Service\FichesService::ambiance).
import { charger } from './charger.js';

const d = await charger('ambiances');

export const AMBIANCES = d.AMBIANCES;
/** Précisions par site (documents « Quotidien sensoriel » et « Vie quotidienne »). */
export const SITE_EXTRA = d.SITE_EXTRA;
/** Ambiances propres à un lieu, non canon : une banque d'images à valider. */
export const AMBIANCES_SITES = d.AMBIANCES_SITES;

export function ambianceFor(site) {
  const id = site.id;
  const key = id.startsWith('kebet') && site.type !== 'orbit' ? 'kebet' : id.startsWith('sethis') ? 'sethis' : id.startsWith('roushan') ? 'roushan'
    : site.type === 'heliocentric' ? 'ceinture' : site.type === 'orbit' ? 'station' : 'base';
  return { key: AMBIANCES_SITES[id] ? id : key, ...(AMBIANCES_SITES[id] || AMBIANCES[key]), extra: SITE_EXTRA[id] || [] };
}
