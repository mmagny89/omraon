// Visite guidée : suite d'étapes { titre, vue?, etat, texte(ui) }. `etat` est un état de vue (voir lien.js) appliqué par ui.restoreState ;
// le texte reprend les descriptions des données (canon) et des valeurs calculées ; ce qui est de conception est dit entre parenthèses.
import { PLANETS, BELT, STAR } from '../data/omraon.js';
import { SITES } from '../data/sites.js';
import { EVENTS } from '../data/chronologie.js';
import { fmtTerre, jourKebet, HEURES_PAR_JOUR } from '../physics/calendrier.js';

const planete = (id) => PLANETS.find((p) => p.id === id);
const lune = (id) => PLANETS.flatMap((p) => p.moons || []).find((m) => m.id === id);
const nf = (n) => n.toLocaleString('fr-FR');
const an = (y) => `An ${String(y).replace('-', '−')}`;

export function etapesVisite(ui) {
  const kebetSites = SITES.filter((x) => x.body === 'Kebet' && x.type === 'surface');
  return [
    {
      titre: 'Omraon, l\'étoile', vue: 'inner', etat: { b: 'Omraon', t: 0, az: 0.6, el: 0.9 },
      texte: () => `Une étoile de type G0V, plus vieille que le Soleil (${STAR.ageGyr} Gyr contre 4,6), ${STAR.massMsun} M☉ et ${ui.L.toFixed(1)} fois la luminosité du Soleil. Sa zone habitable (estimation prudente) s'étend de ${ui.hz.conservative[0].toFixed(2)} à ${ui.hz.conservative[1].toFixed(2)} UA : Zirkan, la géante, y est, et Kebet avec elle.`,
    },
    {
      titre: 'Kalpra, la brûlée', etat: { b: 'Kalpra', t: 0, az: 0.6, el: 0.5 },
      texte: () => `${planete('kalpra').role} Elle est en résonance spin-orbite 3:2, comme Mercure : à ${planete('kalpra').orbit.a} UA, l'étoile y est écrasante.`,
    },
    {
      titre: 'Sethis, le monde-mine', etat: { b: 'Sethis', t: 0, az: 0.6, el: 0.5 },
      texte: () => `${planete('sethis').role} Atmosphère ténue et poussiéreuse (${planete('sethis').habitat.pressureBar} bar, valeur de conception) : le voile ocre autour du disque.`,
    },
    {
      titre: 'Nunzir et les confins', ceinture: true, etat: { t: 0 },
      texte: () => `${BELT.role} Entre ${BELT.aMin} et ${BELT.aMax} UA, quelques milliers de traceurs sans masse figurent la ceinture ; les troyens de Zirkan s'ajoutent sur son orbite. Rien de dense : la distance moyenne entre deux astéroïdes se compte en millions de kilomètres.`,
    },
    {
      titre: 'Zirkan, la géante-ciel', etat: { b: 'Zirkan', t: 0, az: 2.0, el: 0.12 },
      texte: () => `${planete('zirkan').role} Un anneau poussiéreux et ténu l'entoure (conception, rendu seulement) : vu de Kebet, qui orbite dans son plan équatorial, il se réduit à une ligne fine.`,
    },
    {
      titre: 'Kebet, la Terre-maison', etat: { b: 'Kebet', t: 0.2, az: 0.6, el: 0.5 },
      texte: () => `${lune('kebet').role} Son jour (rotation synchrone) dure ${HEURES_PAR_JOUR} h de Kebet, soit ${fmtTerre(jourKebet())} Terre : c'est l'unité de temps de toute l'interface. ${nf(kebetSites.reduce((t, x) => t + x.population, 0))} humains vivent sur ses sites au sol (chiffres de conception).`,
    },
    {
      titre: 'Une éclipse par jour', etat: { b: 'Kebet', t: 0.47, az: 1.2, el: 0.5, p: true },
      texte: () => 'Kebet est verrouillée sur Zirkan, qui occupe 24° de son ciel : chaque jour de Kebet, la géante masque l\'étoile environ 1,6 h. La planète s\'assombrit d\'un coup, les cités s\'allument, et seul un liseré bleu de lumière réfléchie par Zirkan subsiste.',
    },
    {
      titre: 'Roushan et ses cités flottantes', etat: { b: 'Roushan', t: 0, az: 2.2, el: 0.25 },
      texte: () => `${planete('roushan').role} À 30 UA, ses anneaux de glace (conception, rendu seulement) rappellent Saturne ; l'ombre de la planète les traverse.`,
    },
    {
      titre: 'Du départ de la Terre au présent', vue: 'system', etat: { b: 'Omraon', t: 0 },
      texte: () => `<ul>${EVENTS.map((e) => `<li><b>${an(e.year)}</b> — ${e.label}. ${e.note}</li>`).join('')}</ul>Ordres de grandeur d'auteur : la frise du haut permet de s'y rendre.`,
    },
  ];
}
