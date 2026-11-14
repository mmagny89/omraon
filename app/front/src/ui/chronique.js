// Panneau « Chronique » : choisir une date (de l'arrivée des humains au présent) et voir ce qui s'y passait : population, sites fondés,
// pénuries organisées par le Consortium, événements proches, puis simuler le commerce de cette époque. Calculs : physics/chronique.js.
import { etatMonde, sitesAAnnee, evenementsRationnement, ARRIVEE } from '../physics/chronique.js';
import { creerEconomie, avancer, misereSysteme, indicateurs, releverPrix, distanceDepuis } from '../physics/economie.js';
import { MARCHANDISES } from '../data/economie.js';
import { fmtAn, AN_PRESENT } from '../data/chronologie.js';
import { DAYS_PER_YEAR } from '../physics/constants.js';
import { STATUTS } from './statut.js';
import { DL, DT, DD, H3, NOTE, tuiles, tuile, separateur } from './composants.js';

const $ = (s, r = document) => r.querySelector(s);
const nf = (n, d = 0) => n.toLocaleString('fr-FR', { maximumFractionDigits: d, minimumFractionDigits: d });
const pc = (x, d = 0) => `${nf(100 * x, d)} %`;
const pastille = (code) => `<em class="pill ${code}" data-tip="${STATUTS[code].tip.replace(/"/g, '&quot;')}">${STATUTS[code].label}</em>`;
const liste = (items) => `<ul class="m-0 list-none space-y-3 p-0">${items.join('')}</ul>`;
const BIEN = new Map(MARCHANDISES.map((m) => [m.id, m]));

export function initChronique({ root, getPos, getPop, getTime, allerA }) {
  const el = (id) => $(`#${id}`, root);
  if (!el('chr-out')) return null;
  let annee = null, jeton = 0;

  const courant = () => Math.round(getTime() / DAYS_PER_YEAR);
  const lireAn = () => { const a = parseFloat(el('chr-an').value); return Number.isFinite(a) ? Math.round(a) - AN_PRESENT : null; };
  const ecrireAn = (y) => { el('chr-an').value = String(y + AN_PRESENT); };

  function afficher(y) {
    annee = y;
    const pop = getPop();
    if (!pop) return;
    const e = etatMonde(y, pop), p = e.point;
    const aucun = !e.arrive;
    let h = `<p class="my-1 text-base"><b>${fmtAn(y)}</b> — ${e.ere.label}</p>`;
    if (aucun) {
      h += `<p class="${NOTE} mt-3">Les humains ne sont pas encore arrivés dans le système (arrivée en ${fmtAn(ARRIVEE)}) : l'arche est en route. Choisis une date à partir de ${fmtAn(ARRIVEE)}.</p>`;
      el('chr-out').innerHTML = h; el('chr-commerce').disabled = true; return;
    }
    h += tuiles(tuile(nf(p.H), 'Humains', `il y a ${nf(-y)} ans de présent`) + tuile(nf(p.T), 'Tyts', `ratio ${nf(p.ratio, 2)} Tyt par humain`) + tuile(pc(p.C), 'Contrôle des humains', 'sur les Tyts') + tuile(pc(p.A), 'Tyts éveillés', `désespoir ${pc(p.D)}`));
    h += `<h3 class="${H3}">Pénuries organisées ${pastille('conception')}</h3>`;
    h += e.penuries.length
      ? liste(e.penuries.map((q) => `<li class="rounded-lg border border-[#ff9bd2]/40 bg-[#ff9bd2]/5 p-3"><b>${q.cible === 'bas' ? 'Le Bas' : q.cible === 'tyts' ? 'Les Tyts' : q.cible === 'milieu' ? 'Le Milieu' : 'Le Haut'}</b> : ${q.biens.map((g) => BIEN.get(g)?.nom.split(' (')[0] ?? g).join(', ')}, ${pc(q.intensite)} retenus jusqu'en ${fmtAn(q.debut + q.duree)}.<br><span class="${NOTE}">${q.motif}</span></li>`))
      : `<p class="${NOTE}">Aucune pénurie organisée à cette date : le Consortium ne contrôle pas encore la population par la faim, ou n'en a pas besoin.</p>`;
    h += `<h3 class="${H3}">Événements proches (± 25 ans)</h3>`;
    h += e.evenements.length ? liste(e.evenements.slice(0, 8).map((v) => `<li><b>${fmtAn(v.year)}</b> — ${v.label}${v.type === 'penurie' ? ` ${pastille('conception')}` : ''}<br><span class="${NOTE}">${v.note}</span></li>`)) : `<p class="${NOTE}">Rien de noté dans la chronologie autour de cette date.</p>`;
    const top = [...e.sites].sort((a, b) => b.population + b.tyts - a.population - a.tyts).slice(0, 12);
    h += `<h3 class="${H3}">Sites fondés : ${e.sites.length} sur ${e.sites.length + e.nouveaux}${e.nouveaux ? ` (+ ${e.nouveaux} dans les 25 ans)` : ''} ${pastille('conception')}</h3>`;
    h += `<dl class="${DL}">${top.map((s) => `<dt class="${DT}">${s.name}</dt><dd class="${DD}">${nf(s.population)} + ${nf(s.tyts)} Tyts</dd>`).join('')}</dl>`;
    h += `<p class="${NOTE} mt-3">Humains et Tyts du modèle de population, répartis entre les sites déjà fondés selon leur poids au présent. Dates de fondation, pénuries et effets : valeurs suggérées, modifiables par un administrateur.</p>`;
    el('chr-out').innerHTML = h; el('chr-commerce').disabled = false;
  }

  const lancer = (sites, evenements, jours, dist, mon, libelle) => new Promise((ok) => {
    const etat = creerEconomie({ sites, dist, evenements });
    const pas = () => {
      if (mon !== jeton) return;
      avancer(etat, Math.min(10, jours - etat.t));
      el('chr-prog').textContent = `${libelle} : jour ${nf(etat.t)} sur ${jours}…`;
      if (etat.t < jours) return void setTimeout(pas, 0);
      ok(etat);
    };
    setTimeout(pas, 0);
  });

  async function commerce() {
    if (annee == null) return;
    const mon = ++jeton, pop = getPop(), jours = 60, sites = sitesAAnnee(annee, pop.at(annee));
    if (sites.filter((s) => !s.marche).length < 2) { el('chr-com').innerHTML = `<p class="${NOTE}">Un seul marché à cette date : pas de commerce entre sites.</p>`; return; }
    const dist = distanceDepuis(getPos()), ev = evenementsRationnement(annee, sites, jours);
    el('chr-commerce').disabled = true; el('chr-com').innerHTML = '';
    const avec = await lancer(sites, ev, jours, dist, mon, ev.length ? 'Avec la pénurie organisée' : 'Commerce');
    if (mon !== jeton) return;
    const sans = ev.length ? await lancer(sites, [], jours, dist, mon, 'Sans la pénurie (référence)') : null;
    if (mon !== jeton) return;
    el('chr-prog').textContent = ''; el('chr-commerce').disabled = false;
    const res = (etat) => {
      const m = misereSysteme(etat), ind = indicateurs(etat), fin = releverPrix(etat).prix, pen = Object.values(ind.penuries).reduce((s, x) => s + x, 0);
      const prix = MARCHANDISES.map((g) => { const v = Object.values(fin).map((x) => x[g.id]).filter((x) => x != null); return [g, v.length ? v.reduce((s, x) => s + x, 0) / v.length : null]; }).filter(([, v]) => v != null);
      return { m, pen, prix, voyages: ind.voyages, volume: Object.values(ind.transporte).reduce((s, x) => s + x, 0), marches: etat.noeuds.size };
    };
    const A = res(avec), B = sans ? res(sans) : null;
    const ligne = (l, a, b, f, bad = 1) => `<dt class="${DT}">${l}</dt><dd class="${DD}">${f(a)}${b == null ? '' : ` <span class="${NOTE}">(sans : ${f(b)})</span>`}${b != null && Math.abs(a - b) > 1e-9 ? ` <b class="${(a - b) * bad > 0 ? 'text-alerte' : 'text-ok'}">${a > b ? '+' : '−'}${nf(Math.abs(a - b), a < 10 ? 1 : 0)}</b>` : ''}</dd>`;
    el('chr-com').innerHTML = `<h3 class="${H3}">Commerce, ${jours} jours à cette date ${pastille('simule')}</h3><dl class="${DL}">`
      + ligne('Marchés', A.marches, null, nf) + ligne('Voyages', A.voyages, B?.voyages, nf, 0) + ligne('Unités livrées', A.volume, B?.volume, nf, -1)
      + ligne('Jours de pénurie (tous sites)', A.pen, B?.pen, nf)
      + ligne('Misère des humains', 100 * A.m.humains, B == null ? null : 100 * B.m.humains, (x) => `${nf(x, 1)} %`) + ligne('Misère des Tyts', 100 * A.m.tyts, B == null ? null : 100 * B.m.tyts, (x) => `${nf(x, 1)} %`)
      + `</dl><h3 class="${H3}">Prix moyens (× le prix de base)</h3><dl class="${DL}">${A.prix.map(([g, v]) => { const w = B?.prix.find(([x]) => x.id === g.id)?.[1]; return ligne(g.nom.split(' (')[0], v, w ?? null, (x) => `${nf(x, 2)}×`); }).join('')}</dl>`
      + `<p class="${NOTE} mt-3">${ev.length ? 'La comparaison montre ce que la pénurie organisée ajoute à la misère : le Consortium la dose pour rester sous le seuil de la révolte. ' : ''}Prix, flux et pénuries : conception (voir l'onglet Économie pour le détail d'une simulation).</p>`;
  }

  const suivre = () => !el('chr-suivre') || el('chr-suivre').checked;
  const rafraichir = () => { if (root.hidden || el('chronique').hidden) return; const y = suivre() ? courant() : lireAn(); if (y != null && y !== annee) { if (suivre()) ecrireAn(y); afficher(y); } };
  el('chr-an').addEventListener('input', () => { el('chr-suivre').checked = false; const y = lireAn(); if (y != null) afficher(y); });
  for (const b of root.querySelectorAll('[data-chr-pas]')) b.addEventListener('click', () => { const y = (lireAn() ?? courant()) + (+b.dataset.chrPas); el('chr-suivre').checked = false; ecrireAn(y); afficher(y); });
  el('chr-aller').addEventListener('click', () => { const y = lireAn(); if (y != null) { allerA(y); el('chr-suivre').checked = true; } });
  el('chr-commerce').addEventListener('click', commerce);
  root.addEventListener('options:tab', (e) => { if (e.detail === 'chronique') { ecrireAn(courant()); afficher(courant()); } });
  setInterval(rafraichir, 700);
  ecrireAn(courant());
  return { afficher };
}
