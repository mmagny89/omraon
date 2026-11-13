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

test('économie : sans transporteurs, les pénuries explosent ; avec, elles reculent', () => {
  const sans = monde({ transporteurs: [] }), avec = monde();
  avancer(sans, 180); avancer(avec, 180);
  const p = (e) => Object.values(indicateurs(e).penuries).reduce((s, x) => s + x, 0);
  assert.ok(p(sans) > 1000, `${p(sans)}`);
  assert.ok(p(avec) < p(sans) * 0.3, `${p(avec)} vs ${p(sans)}`);
});

test('économie : choc — couper la glace de Nunka renchérit l\'eau et crée des pénuries', () => {
  const normal = monde(), choc = monde({ profils: { ...PROFILS, 'nunka-glace': { ...PROFILS['nunka-glace'], prod: {} } } });
  avancer(normal, 120); avancer(choc, 120);
  const eau = (e) => Object.entries(indicateurs(e).penuries).find(([g]) => g === 'eau')?.[1] ?? 0;
  assert.ok(eau(choc) > eau(normal) + 50, `${eau(choc)} vs ${eau(normal)}`);
  assert.ok(prix(choc, 'roushan-cites', 'eau') > prix(normal, 'roushan-cites', 'eau'));
});

test('économie : les Tyts circulent du surplus vers le déficit sans descendre sous la main-d\'œuvre requise', () => {
  const e = monde(); avancer(e, 200);
  const tyts = e.journal.filter((v) => v.cargo.some((x) => x.g === 'tyts'));
  assert.ok(tyts.length > 0, 'au moins un convoi de Tyts');
  for (const id of ['sethis-cite-a', 'sethis-cite-b']) { const n = e.noeuds.get(id); assert.ok(n.stock.tyts >= n.profil.tytsRequis * 0.9, `${id} ${n.stock.tyts}`); }
});

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

import { simulatePopulation } from '../app/src/physics/population.js';
import { misereSysteme } from '../app/src/physics/economie.js';
test('couplage : une crise de misère fait perdre du contrôle et avancer le point de bascule ; niveau 0 = aucun effet', () => {
  const base = simulatePopulation({}), nul = simulatePopulation({ misereYear: 0, misereLevel: 0 });
  for (const y of [-100, 0, 20, 60]) assert.equal(base.at(y).C, nul.at(y).C);
  const crise = simulatePopulation({ misereYear: 0, misereYears: 1, misereLevel: 0.4 });
  assert.ok(crise.at(0.5).C < base.at(0.5).C, `${crise.at(0.5).C} vs ${base.at(0.5).C}`);
  assert.ok(crise.at(20).A >= base.at(20).A);
  assert.ok(crise.summary.tippingYear <= base.summary.tippingYear, `${crise.summary.tippingYear} vs ${base.summary.tippingYear}`);
  assert.equal(crise.at(-50).C, base.at(-50).C); // avant la crise, rien ne change
});
test('couplage : la misère du système monte quand on coupe la glace de Nunka', () => {
  const ref = monde(), choc = monde({ profils: { ...PROFILS, 'nunka-glace': { ...PROFILS['nunka-glace'], prod: {} } } });
  avancer(ref, 120); avancer(choc, 120);
  const a = misereSysteme(ref), b = misereSysteme(choc);
  assert.ok(b.total > a.total, `${b.total} vs ${a.total}`);
  assert.ok(b.total <= 1 && b.tyts >= 0 && b.humains >= 0);
});

test('événements : un blocus ferme un site, la piraterie perd de la cargaison, la grève immobilise une flotte, le péage se multiplie', () => {
  const fen = { de: 20, duree: 30 }, dans = (v) => v.t >= fen.de + 1 && v.t < fen.de + fen.duree - 7; // marge pour les convois déjà en vol
  const blocus = monde({ evenements: [{ type: 'blocus', cible: 'nunka-glace', ...fen }] }); avancer(blocus, 70);
  assert.ok(blocus.journal.filter(dans).every((v) => v.from !== 'nunka-glace' && v.to !== 'nunka-glace'), 'aucun voyage à Nunka pendant le blocus');
  assert.ok(blocus.journal.some((v) => v.t >= fen.de + fen.duree && (v.from === 'nunka-glace' || v.to === 'nunka-glace')), 'le trafic reprend après');
  const greve = monde({ evenements: [{ type: 'greve', cible: 'consortium', ...fen }] }); avancer(greve, 70);
  assert.ok(greve.journal.filter(dans).every((v) => !v.convoi.startsWith('consortium')), 'flottes du Consortium à quai');
  const ref = monde(), pir = monde({ evenements: [{ type: 'piraterie', cible: 'roushan-cites', valeur: 0.5, de: 0, duree: 70 }] });
  avancer(ref, 70); avancer(pir, 70);
  const livre = (e) => Object.values(e.transporte).reduce((s, x) => s + x, 0);
  assert.ok(livre(pir) < livre(ref) * 0.95, `${livre(pir)} vs ${livre(ref)}`);
  const p3 = monde({ evenements: [{ type: 'peage', valeur: 3, de: 0, duree: 70 }] }); avancer(p3, 70);
  assert.ok((p3.taxes['naksun-octroi'] ?? 0) > (ref.taxes['naksun-octroi'] ?? 0), 'péage plus lourd');
});

import { besoinJour } from '../app/src/physics/economie.js';
test('station de Kebet : la poussée continue consomme du carburant, qui lui est livré', () => {
  const port = SITES.find((s) => s.id === 'kebet-orbite');
  assert.ok(besoinJour(port, PROFILS['kebet-orbite'], 'carburant') >= 60);
  const e = monde(); avancer(e, 60);
  assert.ok([...e.flux].some(([k, q]) => k.split('|')[1] === 'kebet-orbite' && k.endsWith('|carburant') && q > 0), 'le carburant arrive au port');
  assert.ok((e.noeuds.get('kebet-orbite').penurie.carburant ?? 0) < 20, 'le port ne manque pas de carburant');
});

test('hasard : même graine, même histoire ; graines différentes, histoires différentes ; l\'espérance reste proche du modèle moyen', () => {
  const run = (graine) => { const e = monde({ graine, transporteurs: TRANSPORTEURS }); avancer(e, 90); return e; };
  const a = run(7), b = run(7), c = run(8), moy = monde(); avancer(moy, 90);
  assert.deepEqual(a.journal.map((v) => [v.t, v.convoi, v.to, v.saisi]), b.journal.map((v) => [v.t, v.convoi, v.to, v.saisi]));
  assert.notDeepEqual(a.journal.map((v) => v.saisi), c.journal.map((v) => v.saisi));
  assert.ok(a.saisies > 0 && a.valeurSaisie > 0, 'la contrebande se fait prendre au moins une fois');
  assert.ok(Math.abs(masseMonetaire(a) - a.masseInitiale) < 1e-6 * a.masseInitiale, 'l\'argent reste conservé');
  const liv = (e) => Object.values(e.transporte).reduce((s, x) => s + x, 0);
  assert.ok(Math.abs(liv(a) / liv(moy) - 1) < 0.15, `${liv(a)} vs ${liv(moy)}`);
  assert.equal(moy.saisies, 0); // en valeur moyenne, aucune saisie entière
});
test('hasard : une cargaison saisie ne livre rien', () => {
  const e = mini('contrebande'); e.rng = () => 0; // toujours saisi
  avancer(e, 6);
  assert.ok(e.saisies > 0 && (e.transporte.eau ?? 0) === 0);
});

import { REGLAGES } from '../app/src/data/economie.js';
const sansCeinture = { ...PROFILS, 'ceinture-fonderies': { ...PROFILS['ceinture-fonderies'], prod: {} }, 'ceinture-glace': { ...PROFILS['ceinture-glace'], prod: {} } };
test('ceinture : ses mines libres baissent les prix, réduisent la misère et alimentent Sethis en eau', () => {
  const avec = monde(), sans = monde({ profils: sansCeinture }); avancer(avec, 120); avancer(sans, 120);
  assert.ok(misereSysteme(avec).total < misereSysteme(sans).total, `${misereSysteme(avec).total} vs ${misereSysteme(sans).total}`);
  assert.ok(prix(avec, 'kebet-quartiers', 'metaux') < prix(sans, 'kebet-quartiers', 'metaux'));
  assert.ok([...avec.flux.keys()].some((k) => k.startsWith('ceinture-glace|sethis') && k.endsWith('|eau')), 'eau de la ceinture vers les mines de Sethis');
  assert.ok([...avec.flux.keys()].some((k) => k.startsWith('ceinture-fonderies|') && k.endsWith('|minerai')), 'minerai de la ceinture');
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
