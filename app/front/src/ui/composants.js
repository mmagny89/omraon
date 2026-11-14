// Composants des panneaux de la vue, en utilitaires Tailwind v4 (feuille compilée : assets/styles/vue.css → /assets/styles/vue-*.css).
// Les classes sont écrites en toutes lettres : Tailwind lit ces fichiers comme du texte et ne détecte jamais un nom assemblé.
// Ces fonctions ne contiennent que de la présentation ; les valeurs affichées viennent de physics/ et de data/.

const TUILE = 'flex min-w-0 flex-col gap-0.5 rounded-xl border border-ligne bg-[rgba(160,185,230,.05)] px-3.5 py-3';
const PUCE = { ok: 'border-ok text-ok', warn: 'border-alerte text-alerte', bad: 'border-danger text-danger' };
const SECTION = 'group sec my-4 overflow-hidden rounded-xl border border-ligne bg-white/[.035] open:pb-4 [&>:not(summary)]:mx-4 [&>summary+*]:mt-4';
const RESUME = 'flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4 text-xs font-semibold uppercase tracking-[.08em] text-accent hover:bg-accent/10 group-open:border-b group-open:border-ligne [&::-webkit-details-marker]:hidden';
const CHEVRON = '<svg aria-hidden="true" viewBox="0 0 10 10" class="size-6 shrink-0 -rotate-90 rounded-full bg-accent/15 p-[7px] text-accent transition-transform group-open:rotate-0 motion-reduce:transition-none"><path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// Contenu des fiches : listes de valeurs, titres de bloc, notes, verdicts, critères (remplace #info dl/dt/dd/h3/.note/.hab/.crit/.sugg/table.sum).
export const DL = 'm-0 grid grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)] gap-x-4 gap-y-2.5 leading-snug';
export const DT = 'text-doux';
export const DD = 'm-0 text-right tabular-nums';
export const H3 = 'mb-2.5 mt-6 text-[11px] uppercase tracking-widest text-accent';
export const NOTE = 'text-xs leading-relaxed text-doux';
const NIVEAU = { ok: 'border-ok text-ok', warn: 'border-alerte text-alerte', bad: 'border-danger text-danger' };
const PASTILLE = { ok: 'bg-ok', warn: 'bg-alerte', bad: 'bg-danger' };
export const SOMMAIRE = 'w-full border-collapse text-[13px] [&_td]:border-t [&_td]:border-ligne [&_td]:px-1 [&_td]:py-[3px] [&_td:last-child]:text-right';
export const SUGGESTIONS = 'my-3 pl-[18px] text-[#cfd8ec] [&>li]:my-2';

/** Verdict d'habitabilité (cadre coloré). */
export const verdict = (niveau, label) => `<div class="mb-2 mt-4 rounded-lg border px-3 py-2.5 font-semibold ${NIVEAU[niveau] ?? 'border-ligne'}">${label}</div>`;

/** Liste de critères : pastille d'état, libellé, valeur, note facultative (une grille de trois colonnes). */
export const criteres = (lignes) => `<ul class="m-0 grid list-none grid-cols-[10px_1fr_auto] items-baseline gap-x-2.5 gap-y-2 p-0">${lignes.map((c) => `<li class="contents"><span class="size-2 self-center rounded-full ${PASTILLE[c.status] ?? 'bg-doux'}"></span><span>${c.label}</span><span class="text-right tabular-nums">${c.value}</span>${c.note ? `<small class="col-[2/-1] mb-[3px] text-doux">${c.note}</small>` : ''}</li>`).join('')}</ul>`;

/** Grille de tuiles (2 colonnes). */
export const tuiles = (contenu) => `<div class="mb-5 grid grid-cols-2 gap-2.5">${contenu}</div>`;

/** Tuile chiffre clé : valeur, libellé, précision facultative ; `attrs` porte l'infobulle (tipAttr). */
export const tuile = (valeur, libelle, sous = '', attrs = '') =>
  `<div class="tile ${TUILE}"${attrs}><b class="text-base tabular-nums [overflow-wrap:anywhere]">${valeur}</b><span class="text-[11px] uppercase tracking-[.06em] text-doux">${libelle}</span>${sous ? `<small class="text-[11px] text-doux">${sous}</small>` : ''}</div>`;

/** En-tête d'une fiche : pastille (couleur ou losange de site), titre, sous-titre, puce de statut facultative. */
export const entete = ({ couleur = null, site = false, titre, sous, puce = null, modifie = null }) =>
  `<header class="mb-1 flex items-center gap-3.5">${site
    ? '<span class="size-[11px] shrink-0 rotate-45 rounded-[3px] bg-accent"></span>'
    : `<span class="size-3.5 shrink-0 rounded-full shadow-[0_0_10px_currentColor]" style="background:${couleur}"></span>`}`
  + `<div class="min-w-0 flex-1"><h2 class="mb-0.5 text-xl font-bold">${titre}</h2><div class="text-doux">${sous}</div>${modifie ? `<span class="mt-1.5 inline-block rounded-full border border-[#ff9bd2]/50 px-2 py-px text-[11px] font-semibold uppercase tracking-wider text-[#ff9bd2]" title="${modifie}">modifié</span>` : ''}</div>`
  + `${puce ? `<span class="max-w-[48%] shrink-0 rounded-full border px-[9px] py-[3px] text-center text-[11.5px] font-semibold leading-tight ${PUCE[puce.niveau] ?? 'border-ligne'}">${puce.label}</span>` : ''}</header>`;

/** Phrase d'accroche sous l'en-tête. */
export const accroche = (texte) => `<p class="mb-5 mt-3 leading-relaxed text-[#cfd8ec]">${texte}</p>`;

/** Séparateur annonçant le bloc suivant. */
export const separateur = (texte) => `<div class="mb-3 mt-6 border-t-2 border-ligne pt-4 text-[11px] uppercase tracking-widest text-doux">${texte}</div>`;

/** Section repliable ; `contenu` s'ajoute après l'appel, la fermeture `</details>` reste à l'appelant. */
export const sectionDebut = (titre, ouvert, pastille = '', tip = '') =>
  `<details class="${SECTION}" data-sec="${titre}"${ouvert ? ' open' : ''}><summary class="${RESUME}"${tip}><span class="flex-1">${titre}<span class="hidden font-normal normal-case tracking-normal text-doux [details:not([open])_&]:inline"> · déplier</span></span>${pastille}${CHEVRON}</summary>`;

/** Liens vers les pages détaillées (Symfony). */
export const liensFiches = (liens) => `<p class="my-4 text-[.9rem]">${liens.map((l) => `<a class="rounded text-accent underline-offset-2 hover:underline" href="${l.href}" target="_blank" rel="noopener">${l.texte}</a>`).join(' · ')}</p>`;
