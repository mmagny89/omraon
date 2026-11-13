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
  const flux = (g, a, b) => e.journal.some((v) => v.g === g && v.from === a && v.to === b);
  assert.ok(e.journal.length > 20, `${e.journal.length} voyages`);
  assert.ok(e.journal.some((v) => v.g === 'eau' && v.from === 'nunka-glace'), 'eau de Nunka');
  assert.ok(e.journal.some((v) => v.g === 'vivres' && v.from.startsWith('kebet')), 'vivres de Kebet');
  assert.ok(e.journal.some((v) => v.g === 'minerai' && (v.from.startsWith('sethis') || v.from === 'kalpra-mines')), 'minerai des mines');
  assert.ok(flux('carburant', 'roushan-cites', e.journal.find((v) => v.g === 'carburant')?.to ?? ''), 'carburant de Roushan');
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
  const tyts = e.journal.filter((v) => v.g === 'tyts');
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
  const parti = c.journal.filter((v) => v.g === 'eau').reduce((s, v) => s + v.q, 0);
  assert.ok(Math.abs(c.transporte.eau - parti * 0.9) < 1e-9, `${c.transporte.eau} vs ${parti * 0.9}`); // 10 % saisis à la fouille
  assert.ok(Math.abs(l.transporte.eau - l.journal.filter((v) => v.g === 'eau').reduce((s, v) => s + v.q, 0)) < 1e-9);
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
