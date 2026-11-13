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

test('ceinture : ses mines libres baissent les prix, réduisent la misère et alimentent Sethis en eau', () => {
  const avec = monde(), sans = monde({ profils: sansCeinture }); avancer(avec, 120); avancer(sans, 120);
  assert.ok(misereSysteme(avec).total < misereSysteme(sans).total, `${misereSysteme(avec).total} vs ${misereSysteme(sans).total}`);
  assert.ok(prix(avec, 'kebet-quartiers', 'metaux') < prix(sans, 'kebet-quartiers', 'metaux'));
  assert.ok([...avec.flux.keys()].some((k) => k.startsWith('ceinture-glace|sethis') && k.endsWith('|eau')), 'eau de la ceinture vers les mines de Sethis');
  assert.ok([...avec.flux.keys()].some((k) => k.startsWith('ceinture-fonderies|') && k.endsWith('|minerai')), 'minerai de la ceinture');
});
