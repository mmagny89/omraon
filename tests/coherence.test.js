import test from 'node:test';
import assert from 'node:assert/strict';
import { SITES } from '../app/src/data/sites.js';
import { PROFILS, MARCHANDISES } from '../app/src/data/economie.js';
import { simulatePopulation } from '../app/src/physics/population.js';
import { extracteurs, valeurParMineur } from '../app/src/physics/economie.js';

const modele = simulatePopulation({}).at(0);
const H = SITES.reduce((s, x) => s + x.population, 0), T = SITES.reduce((s, x) => s + x.tyts, 0);

test('cohérence : les sites rassemblent la population du modèle (humains et Tyts, à 3 % près)', () => {
  assert.ok(Math.abs(H / modele.H - 1) < 0.03, `humains ${H} vs modèle ${Math.round(modele.H)}`);
  assert.ok(Math.abs(T / modele.T - 1) < 0.03, `Tyts ${T} vs modèle ${Math.round(modele.T)}`);
  assert.ok(Math.abs(T / H / modele.ratio - 1) < 0.05, `ratio ${(T / H).toFixed(2)} vs ${modele.ratio.toFixed(2)}`);
});

test('cohérence : la productivité par extracteur reste plausible, et les extracteurs tiennent dans la population du site', () => {
  for (const s of SITES) {
    const p = PROFILS[s.id], k = extracteurs(p);
    if (!p.productivite) continue;
    assert.ok(p.productivite >= 10 && p.productivite <= 400, `${s.id} : ${p.productivite} kg/jour par extracteur`);
    assert.ok(k <= s.population + s.tyts, `${s.id} : ${k} extracteurs pour ${s.population + s.tyts} personnes`);
  }
  // les mines tenues par des Tyts : au moins 5 % d'extracteurs, le reste fait d'autres tâches (service, construction, entretien)
  for (const id of ['sethis-cite-a', 'sethis-cite-b', 'kalpra-mines', 'nunka-glace']) {
    const s = SITES.find((x) => x.id === id), k = extracteurs(PROFILS[id]);
    assert.ok(k / s.tyts >= 0.05 && k <= PROFILS[id].tytsRequis, `${id} : ${(100 * k / s.tyts).toFixed(1)} % des Tyts extraient`);
  }
});

test('cohérence : un Tyt vaut dix ans de la production d\'un extracteur moyen (à 15 % près)', () => {
  const prix = MARCHANDISES.find((m) => m.id === 'tyts').prixBase, ref = valeurParMineur() * 365.25 * 10;
  assert.ok(Math.abs(prix / ref - 1) < 0.15, `${prix} cr vs ${Math.round(ref)} cr`);
});
