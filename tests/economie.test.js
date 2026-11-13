import test from 'node:test';
import assert from 'node:assert/strict';
import { STAR, PLANETS } from '../app/src/data/omraon.js';
import { buildSystem } from '../app/src/physics/system.js';
import { Simulation } from '../app/src/physics/simulation.js';
import { stateToElements } from '../app/src/physics/kepler.js';
import { starLuminosity, habitableZone } from '../app/src/physics/derived.js';
import { G } from '../app/src/physics/constants.js';
import { SITES } from '../app/src/data/sites.js';
import { PROFILS, TRANSPORTEURS } from '../app/src/data/economie.js';
import { siteState } from '../app/src/physics/sites.js';
import { releverPrix, creerEconomie, avancer, prix, prixAuStock, masseMonetaire, indicateurs, distanceDepuis, tempsVol } from '../app/src/physics/economie.js';

const sim = new Simulation(buildSystem(STAR, PLANETS), { particleCount: 300 }); sim.autoTier = false; sim.computeRender(0);
const el = (i) => {
  const b = sim.bodies[i]; if (b.type === 'star') return null; const p = b.parent;
  const r = [0, 1, 2].map((c) => sim.pos[3 * i + c] - sim.pos[3 * p + c]), v = [0, 1, 2].map((c) => sim.vel[3 * i + c] - sim.vel[3 * p + c]);
  return stateToElements(G * ((p === 0 ? sim.mass[0] : sim.mass[p]) + sim.mass[i]), r, v);
};
const ctx = { sim, ang: () => 0, protDays: () => 0, bodyIndex: (n) => sim.bodies.find((b) => b.def.name === n).idx, el, star: STAR, L: starLuminosity(STAR), hz: habitableZone(STAR), bodies: sim.bodies, mEff: sim.mEff, prot: () => 0 };
const pos = new Map(SITES.map((s) => [s.id, siteState(ctx, s, 0).pos]));
const dist = distanceDepuis(pos);
const monde = (extra = {}) => creerEconomie({ sites: SITES, dist, ...extra });







// Petit monde de deux sites : l'un produit de l'eau, l'autre en manque et taxe ses importations.
const mini = (faction) => {
  const sites = [
    { id: 'a', population: 1000, tyts: 0 }, { id: 'b', population: 1000, tyts: 0 },
  ];
  const profils = { a: { prod: { eau: 300, carburant: 50 }, tytsRequis: 0, zone: 'exterieur' }, b: { prod: {}, tytsRequis: 0, zone: 'exterieur', taxe: 0.1 } };
  const e = creerEconomie({ sites, dist: () => 1, profils, transporteurs: [{ id: 'x', nom: 'x', faction, soute: 100, aG: 8, base: 'a', caisse: 50000, risque: 0.1 }] });
  e.noeuds.get('b').cible.eau = 600; e.noeuds.get('b').stock.eau = 5;
  return e;
};




import { simulatePopulation } from '../app/src/physics/population.js';
import { misereSysteme } from '../app/src/physics/economie.js';


import { besoinJour } from '../app/src/physics/economie.js';


import { REGLAGES } from '../app/src/data/economie.js';
const sansCeinture = { ...PROFILS, 'ceinture-fonderies': { ...PROFILS['ceinture-fonderies'], prod: {} }, 'ceinture-glace': { ...PROFILS['ceinture-glace'], prod: {} } };

// --- Corrections de cohérence (2026-11-13) ---

test('économie : l\'argent est conservé (grand livre fermé) et les stocks restent sains', () => {
  const e = monde(), m0 = masseMonetaire(e);
  avancer(e, 365);
  assert.ok(Math.abs(masseMonetaire(e) - m0) < 1e-6 * m0, `${masseMonetaire(e)} vs ${m0}`);
  for (const n of e.noeuds.values()) for (const [g, s] of Object.entries(n.stock)) assert.ok(Number.isFinite(s) && s >= 0, `${n.site.id} ${g} ${s}`);
});

test('économie : le prix baisse quand le stock monte, borné entre prixMin et prixMax', () => {
  const e = monde(), n = e.noeuds.get('roushan-cites'), c = n.cible.vivres;
  const bas = prixAuStock(e, n, 'vivres', c * 0.1), norm = prixAuStock(e, n, 'vivres', c), haut = prixAuStock(e, n, 'vivres', c * 5);
  assert.ok(bas > norm && norm > haut);
  assert.ok(Math.abs(norm - 60) < 1e-9);
  assert.ok(prixAuStock(e, n, 'vivres', 0) <= 60 * e.reglages.prixMax + 1e-9 && haut >= 60 * e.reglages.prixMin - 1e-9);
  assert.equal(prixAuStock(e, e.noeuds.get('mahat-tribunaux'), 'minerai', 1), null);
});

test('économie : les flux du lore existent (glace de Nunka, vivres de Kebet, minerai des mines vers Roushan)', () => {
  const e = monde(); avancer(e, 120);
  const porte = (v, g) => v.cargo.some((x) => x.g === g), flux = (g, a, b) => e.journal.some((v) => porte(v, g) && v.from === a && v.to === b);
  assert.ok(e.journal.length > 20, `${e.journal.length} voyages`);
  assert.ok(e.journal.some((v) => porte(v, 'eau') && v.from === 'nunka-glace'), 'eau de Nunka');
  assert.ok(e.journal.some((v) => porte(v, 'vivres') && v.from.startsWith('kebet')), 'vivres de Kebet');
  assert.ok(e.journal.some((v) => porte(v, 'minerai') && (v.from.startsWith('sethis') || v.from === 'kalpra-mines')), 'minerai des mines');
  assert.ok(flux('carburant', 'roushan-cites', e.journal.find((v) => porte(v, 'carburant'))?.to ?? ''), 'carburant de Roushan');
});

test('économie : la douane taxe le convoi libre ; la contrebande l\'évite mais perd une part de sa cargaison', () => {
  const l = mini('libre'), c = mini('contrebande');
  avancer(l, 6); avancer(c, 6);
  assert.ok((l.taxes.b ?? 0) > 0, 'taxe prélevée');
  assert.ok(c.journal.length > 0 && (c.taxes.b ?? 0) === 0, 'aucune taxe en contrebande');
  const eauDe = (e) => e.journal.reduce((s, v) => s + v.cargo.filter((x) => x.g === 'eau').reduce((t, x) => t + x.q, 0), 0), parti = eauDe(c);
  assert.ok(Math.abs(c.transporte.eau - parti * 0.9) < 1e-9, `${c.transporte.eau} vs ${parti * 0.9}`); // 10 % saisis à la fouille
  assert.ok(Math.abs(l.transporte.eau - eauDe(l)) < 1e-9);
});

test('économie : le temps de vol suit l\'hyperpropulsion (≈ 35 UA en ≈ 6 jours à 8 g)', () => {
  const d = tempsVol(35, 8);
  assert.ok(d > 5 && d < 8, `${d}`);
  assert.ok(tempsVol(0.01, 8) < 0.2);
});

test('économie : transporteurs et profils couvrent exactement les sites', () => {
  for (const s of SITES) assert.ok(PROFILS[s.id], `profil manquant : ${s.id}`);
  for (const id of Object.keys(PROFILS)) assert.ok(SITES.some((s) => s.id === id), `site inconnu : ${id}`);
  for (const t of TRANSPORTEURS) assert.ok(SITES.some((s) => s.id === t.base), `base inconnue : ${t.id}`);
});

test('économie : le relevé de prix est en multiple du prix de base et le registre des flux égale les volumes livrés', () => {
  const e = monde(); const r0 = releverPrix(e);
  assert.ok(Math.abs(r0.prix['roushan-cites'].vivres - 1) < 1e-9 && r0.prix['mahat-tribunaux'].minerai === null);
  avancer(e, 60);
  const somme = [...e.flux.values()].reduce((s, x) => s + x, 0), total = Object.values(e.transporte).reduce((s, x) => s + x, 0);
  assert.ok(Math.abs(somme - total) < 1e-6 * total, `${somme} vs ${total}`);
});

test('couplage : une crise de misère fait perdre du contrôle et avancer le point de bascule ; niveau 0 = aucun effet', () => {
  const base = simulatePopulation({}), nul = simulatePopulation({ misereYear: 0, misereLevel: 0 });
  for (const y of [-100, 0, 20, 60]) assert.equal(base.at(y).C, nul.at(y).C);
  const crise = simulatePopulation({ misereYear: 0, misereYears: 1, misereLevel: 0.4 });
  assert.ok(crise.at(0.5).C < base.at(0.5).C, `${crise.at(0.5).C} vs ${base.at(0.5).C}`);
  assert.ok(crise.at(20).A >= base.at(20).A);
  assert.ok(crise.summary.tippingYear <= base.summary.tippingYear, `${crise.summary.tippingYear} vs ${base.summary.tippingYear}`);
  assert.equal(crise.at(-50).C, base.at(-50).C); // avant la crise, rien ne change
});

test('station de Kebet : la poussée continue consomme du carburant, qui lui est livré', () => {
  const port = SITES.find((s) => s.id === 'kebet-orbite');
  assert.ok(besoinJour(port, PROFILS['kebet-orbite'], 'carburant') >= 60);
  const e = monde(); avancer(e, 60);
  assert.ok([...e.flux].some(([k, q]) => k.split('|')[1] === 'kebet-orbite' && k.endsWith('|carburant') && q > 0), 'le carburant arrive au port');
  assert.ok((e.noeuds.get('kebet-orbite').penurie.carburant ?? 0) < 20, 'le port ne manque pas de carburant');
});

test('hasard : une cargaison saisie ne livre rien', () => {
  const e = mini('contrebande'); e.rng = () => 0; // toujours saisi
  avancer(e, 6);
  assert.ok(e.saisies > 0 && (e.transporte.eau ?? 0) === 0);
});

test('ceinture : quitter un puits de gravité coûte du carburant, pas un astéroïde', () => {
  assert.ok(PROFILS['sethis-cite-a'].puits > PROFILS['kalpra-mines'].puits && PROFILS['ceinture-fonderies'].puits === 0);
  const a = monde(), b = monde({ reglages: { ...REGLAGES, lancement: 0 } }); avancer(a, 60); avancer(b, 60);
  assert.ok(a.raffinerie.stock.carburant < b.raffinerie.stock.carburant, `${a.raffinerie.stock.carburant} vs ${b.raffinerie.stock.carburant}`); // plus de carburant brûlé au décollage
});

test('ceinture : l\'expédition du Consortium coupe la ceinture le temps de la fenêtre', () => {
  const fen = { de: 20, duree: 30 }, cibles = ['ceinture-fonderies', 'ceinture-glace', 'nunzir-repaire'];
  const e = monde({ evenements: cibles.map((cible) => ({ type: 'blocus', cible, ...fen })) }); avancer(e, 70);
  const dans = e.journal.filter((v) => v.t >= fen.de + 1 && v.t < fen.de + fen.duree - 7);
  assert.ok(dans.every((v) => !cibles.includes(v.from) && !cibles.includes(v.to)));
});

test('douane de Kebet : rien entre deux sites de Kebet, 10 % pour tout ce qui vient de l\'extérieur, sur tous les sites', () => {
  const sites = [{ id: 'a', population: 100, tyts: 0 }, { id: 'k1', population: 100, tyts: 0 }, { id: 'k2', population: 100, tyts: 0 }];
  const profils = { a: { prod: { eau: 300, carburant: 50 }, tytsRequis: 0, zone: 'exterieur' }, k1: { prod: { eau: 300 }, tytsRequis: 0, zone: 'exterieur', taxe: 0.1, douane: 'kebet' }, k2: { prod: {}, tytsRequis: 0, zone: 'exterieur', taxe: 0.1, douane: 'kebet' } };
  const mk = (base) => { const e = creerEconomie({ sites, dist: () => 0.001, profils, transporteurs: [{ id: 'x', nom: 'x', faction: 'libre', soute: 100, aG: 8, base, caisse: 100000 }] }); e.noeuds.get('k2').cible.eau = 600; e.noeuds.get('k2').stock.eau = 5; return e; };
  const interne = mk('k1'), externe = mk('a');
  avancer(interne, 4); avancer(externe, 4);
  assert.ok(interne.journal.some((v) => v.from === 'k1' && v.to === 'k2'), 'transfert interne effectué');
  assert.equal(interne.taxes.k2 ?? 0, 0, 'aucune douane entre sites de Kebet');
  assert.ok(externe.journal.some((v) => v.from === 'a' && v.to === 'k2'), 'import sur un site au sol');
  assert.ok((externe.taxes.k2 ?? 0) > 0, 'douane sur un site au sol');
});

test('population : la demande croît avec la population (0,7 %/an) et suit les Tyts présents', () => {
  const e = monde({ transporteurs: [] }); const n = e.noeuds.get('roushan-cites'), s = n.site;
  const b0 = besoinJour({ id: s.id, population: n.pop, tyts: n.stock.tyts }, n.profil, 'vivres');
  avancer(e, 365);
  const b1 = besoinJour({ id: s.id, population: n.pop, tyts: n.stock.tyts }, n.profil, 'vivres');
  assert.ok(Math.abs(b1 / b0 - 1.007) < 0.001, `${b1 / b0}`);
  const sethis = e.noeuds.get('sethis-cite-a');
  assert.ok(Math.abs(sethis.stock.tyts / sethis.site.tyts - 1.008) < 0.002, 'les Tyts croissent à leur propre rythme');
});

test('croissance des Tyts : la moyenne pondérée de l\'économie suit celle du modèle de population (±0,15 point)', () => {
  let w = 0, t = 0; for (const s of SITES) { const p = PROFILS[s.id]; if (p.tytsAn != null && s.tyts) { w += p.tytsAn * s.tyts; t += s.tyts; } }
  const m = simulatePopulation({}), g = m.at(1).T / m.at(0).T - 1;
  assert.ok(Math.abs(w / t - g) < 0.0015, `${(w / t * 100).toFixed(2)} % vs ${(g * 100).toFixed(2)} %`);
});

test('main-d\'œuvre : aucun site ne reste durablement en déficit de plus de 20 %, à l\'exception de la colonie en croissance', () => {
  for (const s of SITES) { const r = PROFILS[s.id].tytsRequis; if (!r || s.id === 'shukal-colonie') continue; assert.ok(s.tyts >= r * 0.8, `${s.id} : ${s.tyts} pour ${r} requis`); }
});

test('prix : les biens à forte valeur par volume (Tyts, luxe, équipements) varient peu', () => {
  const e = monde(), n = e.noeuds.get('kebet-quartiers');
  for (const [g, lo, hi] of [['tyts', 0.6, 1.6], ['luxe', 0.6, 1.6], ['equipements', 0.4, 2.5]]) {
    const c = n.cible[g] || e.noeuds.get('kebet-quartiers').cible[g]; if (!(c > 0)) continue;
    const base = e.biens.get(g).prixBase;
    assert.ok(prixAuStock(e, n, g, c * 1e-6) <= base * hi + 1e-9 && prixAuStock(e, n, g, c * 1e6) >= base * lo - 1e-9, g);
  }
});
