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

test('rentabilité : sur 470 jours (la durée d\'un an de Kebet), aucun convoi ne fait plus de 500 % ni ne perd plus de 10 % de son capital', () => {
  const e = monde(); avancer(e, 470);
  for (const c of e.convois) { const roi = c.gain / c.def.caisse; assert.ok(roi < 5 && roi > -0.1, `${c.def.id} : ${(roi * 100).toFixed(0)} %`); }
});
