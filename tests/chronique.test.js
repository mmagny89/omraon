import test from 'node:test';
import assert from 'node:assert/strict';
import { SITES } from '../app/front/src/data/sites.js';
import { MARCHANDISES } from '../app/front/src/data/economie.js';
import { PENURIES, PENURIE_GROUPES, FONDATIONS, EVENTS } from '../app/front/src/data/chronologie.js';
import { simulatePopulation } from '../app/front/src/physics/population.js';
import { creerEconomie, avancer, misereSysteme } from '../app/front/src/physics/economie.js';
import { sitesAAnnee, penuriesActives, evenementsRationnement, etatMonde, fondationDe } from '../app/front/src/physics/chronique.js';

const pop = simulatePopulation({});
const sommeH = (l) => l.reduce((t, s) => t + s.population, 0), sommeT = (l) => l.reduce((t, s) => t + s.tyts, 0);

test('chronique : les pénuries du Consortium sont contrôlées, datées dans l\'ère confédérale et visent des groupes et des biens qui existent', () => {
  const biens = new Set(MARCHANDISES.map((m) => m.id));
  assert.ok(PENURIES.length >= 5);
  for (const p of PENURIES) {
    assert.ok(p.debut >= -300 && p.debut + p.duree <= 0, `${p.id} hors de l'ère confédérale`);
    assert.ok(p.intensite > 0 && p.intensite <= 0.35, `${p.id} : une pénurie « contrôlée » reste sous le seuil de la misère`);
    assert.ok(PENURIE_GROUPES[p.cible]?.length, `${p.id} : groupe ${p.cible}`);
    for (const g of p.biens) assert.ok(biens.has(g), `${p.id} : bien ${g}`);
  }
  const corps = new Set(SITES.map((s) => s.body));
  for (const [g, liste] of Object.entries(PENURIE_GROUPES)) for (const c of liste) assert.ok(corps.has(c), `groupe ${g} : corps ${c} sans site`);
});

test('chronique : les pénuries figurent dans la chronologie, triée', () => {
  const pen = EVENTS.filter((e) => e.type === 'penurie');
  assert.equal(pen.length, PENURIES.length);
  assert.ok(pen.every((e) => /Pénurie organisée/.test(e.label) && e.note.length > 20));
  assert.deepEqual(EVENTS.map((e) => e.year), [...EVENTS.map((e) => e.year)].sort((a, b) => a - b));
});

test('chronique : avant l\'arrivée aucun site ; à l\'arrivée seulement le Haut ; au présent tous, aux totaux du modèle', () => {
  assert.equal(sitesAAnnee(-600, pop.at(-600)).length, 0);
  const arrivee = sitesAAnnee(-560, pop.at(-560));
  assert.ok(arrivee.length > 0 && arrivee.every((s) => ['Kebet', 'Iasha', 'Astir', 'Zirkan'].includes(s.body)), arrivee.map((s) => s.body).join());
  assert.ok(Math.abs(sommeH(arrivee) / pop.at(-560).H - 1) < 0.01);
  const present = sitesAAnnee(0, pop.at(0));
  assert.equal(present.length, SITES.length - SITES.filter((s) => fondationDe(s) > 0).length);
  assert.ok(Math.abs(sommeH(present) / pop.at(0).H - 1) < 0.01 && Math.abs(sommeT(present) / pop.at(0).T - 1) < 0.01);
  for (let a = -560; a < 0; a += 40) assert.ok(sitesAAnnee(a, pop.at(a)).length <= sitesAAnnee(a + 40, pop.at(a + 40)).length, `les sites ne disparaissent pas (${a})`);
});

test('chronique : pénuries en cours à une date, et événements du moteur pour les marchés visés', () => {
  assert.equal(penuriesActives(-290).length, 0);
  assert.deepEqual(penuriesActives(-280).map((p) => p.id), ['p1']);
  const ev = evenementsRationnement(-280, sitesAAnnee(-280, pop.at(-280)), 60);
  assert.equal(ev.length, 1);
  assert.ok(ev[0].sites.every((id) => SITES.find((s) => s.id === id).body !== 'Kebet') && ev[0].sites.length > 0 && ev[0].type === 'rationnement');
  const etat = etatMonde(-280, pop);
  assert.ok(etat.penuries.length === 1 && etat.evenements.some((e) => e.type === 'penurie') && etat.ere.label.length > 0);
});

test('chronique : les pénuries organisées renforcent le contrôle et freinent l\'éveil, puis leur effet s\'estompe', () => {
  const sans = simulatePopulation({}), avec = simulatePopulation({ penuries: PENURIES });
  const p = PENURIES[3], pendant = p.debut + 1;
  assert.ok(avec.at(pendant).C >= sans.at(pendant).C, 'contrôle pendant l\'épisode');
  assert.ok(avec.at(-5).A <= sans.at(-5).A + 1e-9, 'éveil freiné');
  assert.ok(avec.summary.awakeNow <= sans.summary.awakeNow + 1e-9);
  assert.ok((avec.summary.tippingYear ?? 1e9) >= (sans.summary.tippingYear ?? 1e9), 'le point de bascule n\'arrive pas plus tôt');
  assert.deepEqual(simulatePopulation({ penuries: [] }).series.C, sans.series.C, 'sans pénurie, rien ne change');
});

test('chronique : le rationnement retient les biens visés, donc plus de pénurie chez les visés que sans lui', () => {
  const dist = () => 0.5, sites = SITES.filter((s) => !s.marche);
  const cible = sites.filter((s) => PENURIE_GROUPES.bas.includes(s.body)).map((s) => s.id);
  const run = (evenements) => { const e = creerEconomie({ sites: SITES, dist, evenements }); avancer(e, 40); return misereSysteme(e).humains + misereSysteme(e).tyts; };
  const base = run([]), ration = run([{ type: 'rationnement', sites: cible, biens: ['vivres', 'eau'], valeur: 0.35, de: 0, duree: 40 }]);
  assert.ok(ration >= base, `${ration} vs ${base}`);
});

test('chronique : le commerce à une date ancienne tourne (peu de sites, pas d\'octroi ni de raffinerie)', () => {
  const sites = sitesAAnnee(-540, pop.at(-540));
  const e = creerEconomie({ sites, dist: () => 0.3, evenements: [] });
  avancer(e, 20);
  assert.ok(e.noeuds.size === sites.filter((s) => !s.marche).length);
  for (const n of e.noeuds.values()) for (const [g, s] of Object.entries(n.stock)) assert.ok(Number.isFinite(s) && s >= 0, `${n.site.id} ${g}`);
});

test('chronique : toute fondation désigne un corps du canon', () => {
  const corps = new Set([...SITES.map((s) => s.body), 'Zirkan']);
  for (const c of Object.keys(FONDATIONS)) assert.ok(corps.has(c), c);
});
