// Panneau « Économie et commerce » : lance la simulation de physics/economie.js sur les positions du jour affiché, par petits
// paquets (l'interface reste fluide), puis montre prix, flux, transporteurs, taxes et pénuries. Tout est de la conception.
import { SITES } from '../data/sites.js';
import { MARCHANDISES, MONNAIE, PROFILS, TRANSPORTEURS } from '../data/economie.js';
import { COULEURS_BIENS, COULEUR_CONTREBANDE } from '../render/flux.js';
import { jourKebet, fmtDuree } from '../physics/calendrier.js';
import { creerEconomie, avancer, releverPrix, distanceDepuis, indicateurs, misereSysteme } from '../physics/economie.js';
import { simulatePopulation } from '../physics/population.js';
import { fmtAn } from '../data/chronologie.js';
import { DAYS_PER_YEAR } from '../physics/constants.js';

const $ = (s, r = document) => r.querySelector(s);
const nf = (n, d = 0) => n.toLocaleString('fr-FR', { maximumFractionDigits: d, minimumFractionDigits: d });
const cr = (n) => `${Math.abs(n) >= 1e6 ? nf(n / 1e6, 1) + ' M' : Math.abs(n) >= 1e4 ? nf(n / 1e3, 0) + ' k' : nf(n)} ${MONNAIE.symbole}`;
const nom = new Map(SITES.map((s) => [s.id, s.name])), bien = new Map(MARCHANDISES.map((m) => [m.id, m]));
const PAS = 10; // jours simulés par paquet
const COULEURS = ['#ffbf6b', '#6fd3a0', '#6fb4ff', '#f78fd0', '#b8f060', '#c78bff'];

/** Scénarios de choc : chacun renvoie les paramètres du moteur à substituer. */
export const CHOCS = {
  aucun: { label: 'Aucun (situation de référence)', params: () => ({}) },
  glace: { label: 'Couper la glace de Nunka', params: () => ({ profils: { ...PROFILS, 'nunka-glace': { ...PROFILS['nunka-glace'], prod: {} } } }) },
  vivres: { label: 'Mauvaise récolte à Kebet (vivres ÷ 3)', params: () => ({ profils: Object.fromEntries(Object.entries(PROFILS).map(([id, p]) => [id, id.startsWith('kebet') && p.prod.vivres ? { ...p, prod: { ...p.prod, vivres: p.prod.vivres / 3 } } : p])) }) },
  carburant: { label: 'Raffineries de Roushan à moitié', params: () => ({ profils: { ...PROFILS, 'roushan-cites': { ...PROFILS['roushan-cites'], prod: { ...PROFILS['roushan-cites'].prod, carburant: PROFILS['roushan-cites'].prod.carburant / 2 } } } }) },
  octroi: { label: 'Péage de l’octroi triplé', params: () => ({ profils: { ...PROFILS, 'naksun-octroi': { ...PROFILS['naksun-octroi'], peage: PROFILS['naksun-octroi'].peage * 3 } } }) },
  greve: { label: 'Flottes du Consortium immobilisées', params: () => ({ transporteurs: TRANSPORTEURS.filter((t) => !t.id.startsWith('consortium')) }) },
  fouilles: { label: 'Répression : fouilles ×3 contre la contrebande', params: () => ({ transporteurs: TRANSPORTEURS.map((t) => (t.faction === 'contrebande' ? { ...t, risque: Math.min(0.9, t.risque * 3) } : t)) }) },
};

/** Événements datés (début et durée choisis dans le panneau, en jours de Kebet) : ils agissent sur une fenêtre de la simulation, pas sur toute sa durée. */
export const EVENEMENTS = {
  aucun: { label: 'Aucun', ev: () => null },
  blocusNunka: { label: 'Blocus de Nunka', ev: () => ({ type: 'blocus', cible: 'nunka-glace' }) },
  blocusKebet: { label: 'Blocus du port de Kebet', ev: () => ({ type: 'blocus', cible: 'kebet-orbite' }) },
  pirates: { label: 'Pirates autour de Roushan (la moitié des cargaisons perdue)', ev: () => ({ type: 'piraterie', cible: 'roushan-cites', valeur: 0.5 }) },
  greve: { label: 'Grève des flottes du Consortium', ev: () => ({ type: 'greve', cible: 'consortium' }) },
  peage: { label: 'Péage de l\u2019octroi triplé', ev: () => ({ type: 'peage', valeur: 3 }) },
};

const mix = (a, b, t) => { const h = (x) => [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16)); const A = h(a), B = h(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; };
/** Couleur d'un prix en multiple du prix de base : bleu (bon marché) → gris clair (normal) → rouge (cher), échelle logarithmique. */
export const couleurPrix = (m) => (m == null ? null : m < 1 ? mix('#6fb4ff', '#e8eefc', Math.min(1, Math.max(0, (Math.log(m) - Math.log(0.2)) / -Math.log(0.2)))) : mix('#e8eefc', '#ff6b7a', Math.min(1, Math.log(m) / Math.log(5))));
const classe = (m) => (m == null ? '' : m < 0.8 ? 'ok' : m > 3 ? 'bad' : m > 1.5 ? 'warn' : '');

export function initEconomie({ root = document, getPos, getTime, getPopParams, appliquerMisere, setMarkers, setFlux, rejouer }) {
  const el = (id) => $(`#${id}`, root);
  el('eco-choc').innerHTML = Object.entries(CHOCS).map(([k, c]) => `<option value="${k}">${c.label}</option>`).join('');
  el('eco-ev').innerHTML = Object.entries(EVENEMENTS).map(([k, c]) => `<option value="${k}">${c.label}</option>`).join('');
  el('eco-bien').innerHTML = MARCHANDISES.map((m) => `<option value="${m.id}">${m.nom}</option>`).join('');
  let jeton = 0, dernier = null, cacheRef = null;

  const legende = () => {
    el('eco-carte-leg').innerHTML = MARCHANDISES.map((m) => `<li><i style="background:${COULEURS_BIENS[m.id]}"></i>${m.nom.split(' (')[0]}</li>`).join('') + `<li><i style="background:${COULEUR_CONTREBANDE}"></i>contrebande</li>`;
  };
  /** Voyages datés (convois) et routes agrégées (volume transporté, tous biens) pour la scène 3D. */
  const donneesCarte = ({ etat }, t0) => {
    const voyages = etat.journal.filter((v) => v.g).map((v) => ({ from: v.from, to: v.to, tDep: v.t, tArr: v.tArr, couleur: v.contrebande ? COULEUR_CONTREBANDE : COULEURS_BIENS[v.g] }));
    const routes = new Map();
    for (const [k, q] of etat.flux) {
      const [a, b, g] = k.split('|'), id = `${a}|${b}`, r = routes.get(id) ?? { from: a, to: b, vol: 0, parBien: {} }, vol = q * bien.get(g).volume;
      r.vol += vol; r.parBien[g] = (r.parBien[g] ?? 0) + vol; routes.set(id, r);
    }
    const liste = [...routes.values()].filter((r) => r.from !== r.to).sort((x, y) => y.vol - x.vol).slice(0, 60).map((r) => ({ from: r.from, to: r.to, vol: r.vol, couleur: COULEURS_BIENS[Object.entries(r.parBien).sort((x, y) => y[1] - x[1])[0][0]] }));
    return { t0, voyages, routes: liste };
  };
  const carte = () => setFlux(dernier ? donneesCarte(dernier, dernier.t0) : null, el('eco-vue').value);

  const marquer = () => {
    if (!dernier || !el('eco-marq').checked) return setMarkers(null);
    const g = el('eco-bien').value, fin = dernier.hist.at(-1).prix;
    setMarkers(new Map(SITES.map((s) => [s.id, couleurPrix(fin[s.id]?.[g] ?? null) ?? '#5a6070'])));
  };

  function dessiner() {
    if (!dernier) return;
    const g = el('eco-bien').value, { hist, jours } = dernier, cv = el('eco-chart'), dpr = Math.min(window.devicePixelRatio || 1, 2), W = cv.clientWidth || 320, H = 170;
    cv.width = W * dpr; cv.height = H * dpr; const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    const L = 34, R = 8, T = 8, B = 20, lo = Math.log(0.2), hi = Math.log(5), X = (t) => L + (t / Math.max(jours, 1)) * (W - L - R), Y = (m) => T + (1 - (Math.log(Math.min(5, Math.max(0.2, m))) - lo) / (hi - lo)) * (H - T - B);
    if (dernier.evenement) { const x0 = X(dernier.evenement.de), x1 = X(Math.min(jours, dernier.evenement.de + dernier.evenement.duree)); c.fillStyle = 'rgba(255,107,122,.14)'; c.fillRect(x0, T, Math.max(2, x1 - x0), H - T - B); c.fillStyle = '#ff6b7a'; c.fillText('événement', Math.min(W - 52, x0 + 3), T + 10); }
    c.strokeStyle = 'rgba(160,185,230,.2)'; c.fillStyle = '#8d9bb8'; c.font = '10px system-ui'; c.lineWidth = 1;
    for (const m of [0.2, 0.5, 1, 2, 5]) { c.beginPath(); c.moveTo(L, Y(m)); c.lineTo(W - R, Y(m)); c.stroke(); c.fillText(`×${m}`, 2, Y(m) + 3); }
    const sites = SITES.filter((s) => hist[0].prix[s.id]?.[g] != null).sort((a, b) => b.population + b.tyts - a.population - a.tyts).slice(0, COULEURS.length);
    sites.forEach((s, i) => {
      c.strokeStyle = COULEURS[i]; c.lineWidth = 2; c.beginPath();
      hist.forEach((h, k) => { const x = X(h.t), y = Y(h.prix[s.id][g]); k ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke();
    });
    el('eco-leg').innerHTML = sites.length ? sites.map((s, i) => `<li><i style="background:${COULEURS[i]}"></i>${s.name}</li>`).join('') : '<li>Aucun site n’est un marché pour cette marchandise.</li>';
  }

  function afficher() {
    const { etat, hist, jours } = dernier, ind = indicateurs(etat), fin = hist.at(-1).prix;
    const volume = Object.values(ind.transporte).reduce((s, x) => s + x, 0);
    const penSite = new Map(); for (const [id, n] of etat.noeuds) { const j = Object.values(n.penurie).reduce((s, x) => s + x, 0); if (j >= 1) penSite.set(id, j); }
    el('eco-sum').innerHTML = `<b>${dernier.libelle}</b> : ${fmtDuree(jours)} simulés, <b>${nf(ind.voyages)}</b> voyages, <b>${nf(volume)}</b> unités livrées. ` +
      (penSite.size ? `Pénuries sur <b>${penSite.size}</b> site${penSite.size > 1 ? 's' : ''} (plus durement : ${[...penSite].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, j]) => `${nom.get(id)}, ${fmtDuree(j)}`).join(' ; ')}).` : 'Aucune pénurie.');
    const ent = `<tr><th>Site</th>${MARCHANDISES.map((m) => `<th title="${m.nom}">${m.nom.split(' ')[0]}</th>`).join('')}</tr>`;
    el('eco-prix').innerHTML = ent + SITES.filter((s) => fin[s.id]).map((s) => `<tr><td>${s.name}</td>${MARCHANDISES.map((m) => { const x = fin[s.id][m.id]; return x == null ? '<td class="vide">–</td>' : `<td class="${classe(x)}">${nf(x, 1)}×</td>`; }).join('')}</tr>`).join('');
    const flux = [...etat.flux].sort((a, b) => b[1] - a[1]).slice(0, 12);
    el('eco-flux').innerHTML = `<tr><th>Route</th><th>Marchandise</th><th>Livré</th></tr>` + (flux.map(([k, q]) => { const [a, b, g] = k.split('|'); return `<tr><td>${nom.get(a)} → ${nom.get(b)}</td><td>${bien.get(g).nom}</td><td>${nf(q)}${g === 'tyts' ? ' têtes' : ' u.'}</td></tr>`; }).join('') || '<tr><td colspan="3">Aucun voyage.</td></tr>');
    el('eco-convois').innerHTML = `<tr><th>Transporteur</th><th>Voyages</th><th>Gain</th></tr>` + etat.convois.map((c) => `<tr><td>${c.def.nom}</td><td>${nf(c.voyages)}</td><td class="${c.gain < 0 ? 'bad' : ''}">${cr(c.gain)}</td></tr>`).join('');
    const tx = Object.entries(ind.taxes).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    el('eco-taxes').innerHTML = tx.length ? `<tr><th>Prélevé par</th><th>Total</th></tr>` + tx.map(([id, v]) => `<tr><td>${nom.get(id)} <small>(${PROFILS[id]?.peage ? 'péage' : 'douane'})</small></td><td>${cr(v)}</td></tr>`).join('') : '<tr><td>Aucune taxe prélevée.</td></tr>';
    el('eco-res').hidden = false; dessiner(); marquer(); carte();
  }

  /** Indicateurs d'une exécution, pour la comparaison. */
  const bilan = ({ etat, hist }) => {
    const ind = indicateurs(etat), fin = hist.at(-1).prix, pen = [...etat.noeuds.values()].map((n) => Object.values(n.penurie).reduce((s, x) => s + x, 0));
    const fac = {}; for (const c of etat.convois) fac[c.def.faction] = (fac[c.def.faction] ?? 0) + c.gain;
    return {
      voyages: ind.voyages, volume: Object.values(ind.transporte).reduce((s, x) => s + x, 0), penuries: pen.reduce((s, x) => s + x, 0), sitesPen: pen.filter((x) => x >= 1).length,
      misere: misereSysteme(etat).total * 100, taxes: Object.values(ind.taxes).reduce((s, x) => s + x, 0), fac,
      prix: Object.fromEntries(MARCHANDISES.map((m) => { const xs = SITES.map((x) => fin[x.id]?.[m.id]).filter((x) => x != null); return [m.id, xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null]; })),
    };
  };
  const ecart = (a, b, pct) => { const d = b - a; if (Math.abs(d) < 1e-9) return '–'; return pct && Math.abs(a) > 1e-9 ? `${d > 0 ? '+' : '−'}${nf(Math.abs(100 * d / a))} %` : `${d > 0 ? '+' : '−'}${nf(Math.abs(d), Number.isInteger(d) ? 0 : 1)}`; };

  function comparer() {
    const { ref } = dernier, cmp = el('eco-cmp'), cpl = el('eco-couple');
    if (!ref) { cmp.hidden = true; cpl.hidden = true; return; }
    const A = bilan(ref), B = bilan(dernier);
    // sens : +1 = plus haut, c'est pire ; −1 = plus haut, c'est mieux ; 0 = neutre
    const lignes = [
      ['Voyages', A.voyages, B.voyages, nf, 0, true], ['Unités livrées', A.volume, B.volume, nf, -1, true], ['Jours de pénurie (tous sites)', A.penuries, B.penuries, nf, 1, true],
      ['Sites en pénurie', A.sitesPen, B.sitesPen, nf, 1, false], ['Misère du système (% de la population)', A.misere, B.misere, (x) => nf(x, 1), 1, false],
      ['Taxes prélevées', A.taxes, B.taxes, cr, 0, true],
      ['Gain des flottes du Consortium', A.fac.consortium ?? 0, B.fac.consortium ?? 0, cr, -1, true], ['Gain des armateurs libres', A.fac.libre ?? 0, B.fac.libre ?? 0, cr, -1, true], ['Gain de la contrebande', A.fac.contrebande ?? 0, B.fac.contrebande ?? 0, cr, -1, true],
      ...MARCHANDISES.filter((m) => A.prix[m.id] != null).map((m) => [`Prix moyen : ${m.nom.split(' (')[0]}`, A.prix[m.id], B.prix[m.id], (x) => `${nf(x, 2)}×`, 1, true]),
    ];
    el('eco-cmp-t').innerHTML = `<tr><th>Indicateur</th><th>Référence</th><th>${dernier.libelle}</th><th>Écart</th></tr>` + lignes.map(([l, a, b, f, sens, pct]) => {
      const d = b - a, cl = sens === 0 || Math.abs(d) < 1e-9 ? '' : (d * sens > 0 ? 'bad' : 'ok');
      return `<tr><td>${l}</td><td>${f(a)}</td><td>${f(b)}</td><td class="${cl}">${ecart(a, b, pct)}</td></tr>`;
    }).join('');
    cmp.hidden = false;

    // couplage : la misère en plus de la référence devient une crise dans le modèle de population
    const niveau = Math.min(1, Math.max(0, (B.misere - A.misere) / 100)), y0 = dernier.t0 / DAYS_PER_YEAR, duree = Math.max(0.25, dernier.jours / DAYS_PER_YEAR);
    const base = getPopParams(), sans = simulatePopulation(base), avec = simulatePopulation({ ...base, misereYear: y0, misereYears: duree, misereLevel: niveau });
    const yr = (y) => (y == null ? 'jamais' : fmtAn(y)), pc = (x) => `${(x * 100).toFixed(1)} %`;
    el('eco-couple-t').innerHTML = `La misère supplémentaire (<b>${nf(100 * niveau, 1)} %</b> de la population, pendant ${fmtDuree(dernier.jours)}) devient une crise dans le modèle de population à partir de l'${fmtAn(y0)} : elle accélère l'éveil des Tyts et détourne des gardes vers le ravitaillement. Effets de conception, sans canon.`;
    el('eco-couple-tab').innerHTML = `<tr><th>Mesure</th><th>Sans la crise</th><th>Avec la crise</th></tr>` + [
      ['Contrôle des humains, 5 ans après', pc(sans.at(y0 + 5).C), pc(avec.at(y0 + 5).C)],
      ['Tyts éveillés, 20 ans après', pc(sans.at(y0 + 20).A), pc(avec.at(y0 + 20).A)],
      ['Point de bascule (combattants > gardes)', yr(sans.summary.tippingYear), yr(avec.summary.tippingYear)],
    ].map(([l, a, b]) => `<tr><td>${l}</td><td>${a}</td><td class="${a === b ? '' : 'warn'}">${b}</td></tr>`).join('');
    dernier.couplage = { y0, duree, niveau }; cpl.hidden = false;
  }

  const lancer = (scen, jours, dist, mon, libelle) => new Promise((ok) => {
    const etat = creerEconomie({ sites: SITES, dist, ...CHOCS[scen.choc].params(), evenements: scen.evenements }), hist = [releverPrix(etat)];
    const pas = () => {
      if (mon !== jeton) return;
      avancer(etat, Math.min(PAS, jours - etat.t)); hist.push(releverPrix(etat));
      el('eco-prog').textContent = `${libelle} : ${fmtDuree(etat.t)} sur ${fmtDuree(jours)}…`;
      if (etat.t < jours) return void setTimeout(pas, 0);
      ok({ etat, hist });
    };
    setTimeout(pas, 0);
  });

  el('eco-go').addEventListener('click', async () => {
    const mon = ++jeton, t0 = getTime(), choc = el('eco-choc').value, evKey = el('eco-ev').value, jours = Math.max(1, Math.round(+el('eco-h').value)), dist = distanceDepuis(getPos()), cle = `${jours}|${t0}`;
    const de = Math.max(0, +el('eco-ev-de').value || 0) * jourKebet(), duree = Math.max(1, +el('eco-ev-du').value || 1) * jourKebet(), evBase = EVENEMENTS[evKey].ev();
    const scen = { choc, evenements: evBase ? [{ ...evBase, de, duree }] : [] }, neutre = choc === 'aucun' && !evBase;
    const libelle = [choc !== 'aucun' && CHOCS[choc].label, evBase && `${EVENEMENTS[evKey].label} (${nf(duree / jourKebet())} j dès le jour ${nf(de / jourKebet())})`].filter(Boolean).join(' + ') || 'Aucun (situation de référence)';
    el('eco-stop').hidden = false; el('eco-go').disabled = true; el('eco-res').hidden = true; el('eco-prog').textContent = 'Simulation en cours…';
    let ref = cacheRef?.cle === cle ? cacheRef.run : null;
    if (!ref) { ref = await lancer({ choc: 'aucun', evenements: [] }, jours, dist, mon, 'Référence'); if (mon !== jeton) return; cacheRef = { cle, run: ref }; }
    const run = neutre ? ref : await lancer(scen, jours, dist, mon, libelle);
    if (mon !== jeton) return;
    dernier = { ...run, jours, choc, t0, libelle, evenement: evBase ? { de, duree } : null, ref: neutre ? null : ref };
    el('eco-prog').textContent = ''; el('eco-go').disabled = false; el('eco-stop').hidden = true; afficher(); comparer();
  });
  el('eco-appliquer').addEventListener('click', () => { const c = dernier?.couplage; if (c) { appliquerMisere(c.y0, c.niveau, c.duree); el('eco-prog').textContent = 'Crise appliquée : voir le panneau Population.'; } });
  el('eco-stop').addEventListener('click', () => { jeton++; el('eco-prog').textContent = 'Simulation interrompue.'; el('eco-go').disabled = false; el('eco-stop').hidden = true; });
  el('eco-bien').addEventListener('change', () => { dessiner(); marquer(); });
  el('eco-marq').addEventListener('change', marquer);
  el('eco-vue').addEventListener('change', carte);
  el('eco-rejouer').addEventListener('click', () => dernier && rejouer(dernier.t0, dernier.jours));
  legende();
  new ResizeObserver(() => { const w = el('eco-chart').clientWidth; if (w && dernier && w !== dernier.w) { dernier.w = w; dessiner(); } }).observe(el('eco-chart'));
  return { redessiner: dessiner };
}
