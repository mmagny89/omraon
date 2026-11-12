// Aides du lore : calendrier confédéral, glossaire, personnages et vestiges par lieu. Logique pure, sans DOM : testable sous Node.
import { MOIS } from '../data/lore.js';

const A = 365.25; // jours terrestres par année (canon du projet)
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Mois du calendrier confédéral à la date t (jours terrestres depuis le présent, An 300). Le lore donne 13 mois nommés mais pas leur durée :
 * l'année est partagée en 13 mois égaux et le présent (An 300) commence au premier jour d'Aset (conception). `jourK` : durée du jour de Kebet (jours terrestres).
 */
export function moisConfederal(t, jourK) {
  const x = (((t % A) + A) % A / A) * MOIS.length, rang = Math.min(MOIS.length - 1, Math.floor(x)), dMois = A / MOIS.length / jourK;
  return { mois: MOIS[rang], rang: rang + 1, jour: Math.min(Math.round(dMois), Math.floor((x - rang) * dMois) + 1), nbJours: Math.round(dMois) };
}

/** Glossaire complet : lexique des documents + noms tyts des mondes (données du système) + mois du calendrier. */
export function glossaireComplet(lexique, mondes) {
  const noms = mondes.filter((m) => m.tyt).map((m) => ({ mot: m.tyt, sens: m.sens ? `« ${m.sens} »` : `nom tyt de ${m.humain}`, cat: 'Noms des mondes', note: `humain : ${m.humain}${m.courant ? ` · courant : ${m.courant}` : ''}` }));
  const mois = MOIS.map((m, i) => ({ mot: m, sens: `mois ${i + 1} sur ${MOIS.length} du calendrier confédéral : nom tyt fossilisé que nul ne sait plus lire`, cat: 'Calendrier confédéral' }));
  return [...lexique, ...noms, ...mois];
}

/** Filtre par texte (accents et casse ignorés, dans le mot et le sens) et par catégorie ('' = toutes). */
export function filtrer(liste, q = '', cat = '') {
  const n = norm(q.trim());
  return liste.filter((e) => (!cat || e.cat === cat) && (!n || norm(e.mot).includes(n) || norm(e.sens).includes(n) || norm(e.note || '').includes(n)));
}

/** Entrées d'un lieu : sur la fiche d'un site (siteId), celles de ce site ; sur celle d'un corps, toutes celles du corps. */
export function auLieu(liste, corps, siteId = null, cle = 'origine') {
  return liste.filter((e) => { const o = cle === 'origine' ? e.origine : e; return o && o.corps === corps && (!siteId || o.site === siteId); });
}
