// Composants des panneaux de la vue, en utilitaires Tailwind v4 (feuille compilée : assets/styles/vue.css → /assets/styles/vue-*.css).
// Les classes sont écrites en toutes lettres : Tailwind lit ces fichiers comme du texte et ne détecte jamais un nom assemblé.
// Ces fonctions ne contiennent que de la présentation ; les valeurs affichées viennent de physics/ et de data/.

const TUILE = 'flex min-w-0 flex-col rounded-[10px] border border-ligne bg-[rgba(160,185,230,.05)] px-2.5 py-[7px]';
const PUCE = { ok: 'border-ok text-ok', warn: 'border-alerte text-alerte', bad: 'border-danger text-danger' };
const SECTION = 'group sec my-2 overflow-hidden rounded-[10px] border border-ligne bg-white/[.035] open:pb-2 [&>:not(summary)]:mx-3';
const RESUME = 'flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 text-xs font-semibold uppercase tracking-[.08em] text-accent hover:bg-accent/10 group-open:border-b group-open:border-ligne [&::-webkit-details-marker]:hidden';
const CHEVRON = '<svg aria-hidden="true" viewBox="0 0 10 10" class="size-6 shrink-0 -rotate-90 rounded-full bg-accent/15 p-[7px] text-accent transition-transform group-open:rotate-0 motion-reduce:transition-none"><path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/** Grille de tuiles (2 colonnes). */
export const tuiles = (contenu) => `<div class="mb-2.5 grid grid-cols-2 gap-1.5">${contenu}</div>`;

/** Tuile chiffre clé : valeur, libellé, précision facultative ; `attrs` porte l'infobulle (tipAttr). */
export const tuile = (valeur, libelle, sous = '', attrs = '') =>
  `<div class="tile ${TUILE}"${attrs}><b class="text-base tabular-nums [overflow-wrap:anywhere]">${valeur}</b><span class="text-[11px] uppercase tracking-[.06em] text-doux">${libelle}</span>${sous ? `<small class="text-[11px] text-doux">${sous}</small>` : ''}</div>`;

/** En-tête d'une fiche : pastille (couleur ou losange de site), titre, sous-titre, puce de statut facultative. */
export const entete = ({ couleur = null, site = false, titre, sous, puce = null }) =>
  `<header class="flex items-center gap-2.5">${site
    ? '<span class="size-[11px] shrink-0 rotate-45 rounded-[3px] bg-accent"></span>'
    : `<span class="size-3.5 shrink-0 rounded-full shadow-[0_0_10px_currentColor]" style="background:${couleur}"></span>`}`
  + `<div class="min-w-0 flex-1"><h2>${titre}</h2><div class="text-doux">${sous}</div></div>`
  + `${puce ? `<span class="max-w-[48%] shrink-0 rounded-full border px-[9px] py-[3px] text-center text-[11.5px] font-semibold leading-tight ${PUCE[puce.niveau] ?? 'border-ligne'}">${puce.label}</span>` : ''}</header>`;

/** Phrase d'accroche sous l'en-tête. */
export const accroche = (texte) => `<p class="my-2 mb-2.5 text-[#cfd8ec]">${texte}</p>`;

/** Séparateur annonçant le bloc suivant. */
export const separateur = (texte) => `<div class="mb-1.5 mt-3.5 border-t-2 border-ligne pt-2.5 text-[11px] uppercase tracking-widest text-doux">${texte}</div>`;

/** Section repliable ; `contenu` s'ajoute après l'appel, la fermeture `</details>` reste à l'appelant. */
export const sectionDebut = (titre, ouvert, pastille = '', tip = '') =>
  `<details class="${SECTION}" data-sec="${titre}"${ouvert ? ' open' : ''}><summary class="${RESUME}"${tip}><span class="flex-1">${titre}<span class="hidden font-normal normal-case tracking-normal text-doux [details:not([open])_&]:inline"> · déplier</span></span>${pastille}${CHEVRON}</summary>`;

/** Liens vers les pages détaillées (Symfony). */
export const liensFiches = (liens) => `<p class="my-1.5 text-[.9rem]">${liens.map((l) => `<a class="rounded text-accent underline-offset-2 hover:underline" href="${l.href}" target="_blank" rel="noopener">${l.texte}</a>`).join(' · ')}</p>`;
