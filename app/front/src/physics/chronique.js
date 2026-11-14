// État du monde à une date : qui vit où, depuis quand, et quelles pénuries organisées sont en cours. Sans DOM, sans Three.js.
// Les populations viennent du modèle de population (physics/population.js) ; la répartition entre sites suit le poids de chaque site
// au présent, parmi les sites déjà fondés (data/chronologie.js, `FONDATIONS`, suggérées). Les pénuries viennent de `PENURIES` (suggérées).
import { SITES } from '../data/sites.js';
import { EVENTS, PENURIES, PENURIE_GROUPES, FONDATIONS, eraAt } from '../data/chronologie.js';

export const ARRIVEE = -560;

/** Année de première installation d'un site : celle qu'il porte (`founded`), sinon celle de son corps. */
export const fondationDe = (site) => site.founded ?? FONDATIONS[site.body] ?? ARRIVEE;

/**
 * Sites existants à l'année `annee`, avec leur population de l'époque : humains et Tyts du modèle, répartis au prorata du poids
 * qu'ont les sites fondés au présent. Un site non encore fondé est absent ; avant l'arrivée, il n'y en a aucun.
 */
export function sitesAAnnee(annee, point, sites = SITES) {
  if (annee < ARRIVEE) return [];
  const vivants = sites.filter((s) => fondationDe(s) <= annee);
  const sH = vivants.reduce((t, s) => t + s.population, 0), sT = vivants.reduce((t, s) => t + (s.tyts || 0), 0);
  const ids = new Set(vivants.map((s) => s.id));
  return vivants.map((s) => ({
    ...s,
    marche: s.marche && ids.has(s.marche) ? s.marche : undefined,
    population: sH > 0 ? Math.round(point.H * s.population / sH) : 0,
    tyts: sT > 0 ? Math.round(point.T * (s.tyts || 0) / sT) : 0,
  }));
}

/** Pénuries organisées en cours à l'année `annee`. */
export const penuriesActives = (annee, penuries = PENURIES) => penuries.filter((p) => annee >= p.debut && annee < p.debut + p.duree);

/** Événements du moteur économique pour les pénuries en cours : les marchés visés sont ceux des sites du groupe (hors sites rattachés à un autre marché). */
export function evenementsRationnement(annee, sites, jours, penuries = PENURIES, groupes = PENURIE_GROUPES) {
  return penuriesActives(annee, penuries).map((p) => ({
    type: 'rationnement', de: 0, duree: jours, biens: p.biens, valeur: p.intensite,
    sites: sites.filter((s) => !s.marche && (groupes[p.cible] ?? []).includes(s.body)).map((s) => s.id),
  })).filter((e) => e.sites.length);
}

/** Tout ce qu'on peut dire d'une date, sans simuler le commerce. */
export function etatMonde(annee, pop, sites = SITES, fenetre = 25) {
  const arrive = annee >= ARRIVEE, point = pop.at(annee), vivants = sitesAAnnee(annee, point, sites);
  return {
    annee, arrive, ere: eraAt(annee), point,
    sites: vivants, nouveaux: sites.filter((s) => fondationDe(s) > annee && fondationDe(s) <= annee + fenetre).length,
    penuries: penuriesActives(annee),
    evenements: EVENTS.filter((e) => Math.abs(e.year - annee) <= fenetre).sort((a, b) => Math.abs(a.year - annee) - Math.abs(b.year - annee)),
  };
}
