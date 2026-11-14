import test from 'node:test';
import assert from 'node:assert/strict';

await import('../app/assets/editeur.js'); // sans DOM : n'expose que les fonctions pures
const { squelette, genre, titreDe, libelle } = globalThis.EditeurJson;
const sites = (await import('../app/front/src/data/sites.js')).SITES;

test('éditeur : squelette garde la forme (clés, imbrication) et vide les valeurs', () => {
  const vide = squelette(sites[0]);
  assert.deepEqual(Object.keys(vide), Object.keys(sites[0]));
  assert.equal(vide.population, 0); assert.equal(vide.name, ''); assert.equal(vide.invented, false);
  assert.deepEqual(squelette({ a: { b: [1, 2], c: 'x' } }), { a: { b: [], c: '' } });
  assert.equal(squelette(null), null);
});

test('éditeur : genre distingue nombres, textes, cases, listes, objets et null', () => {
  assert.deepEqual([1, 'a', true, null, [], {}].map(genre), ['number', 'string', 'boolean', 'null', 'liste', 'objet']);
});

test('éditeur : titre d\'un élément et libellés français des clés du canon', () => {
  assert.equal(titreDe({ name: 'Kebet', id: 'k' }, 0), 'Kebet');
  assert.equal(titreDe({ id: 'k' }, 0), 'k');
  assert.equal(titreDe({}, 2), 'Élément 3');
  assert.equal(libelle('massEarth'), 'Masse (M⊕)');
  assert.equal(libelle('cleInconnue'), 'cleInconnue', 'repli sur le nom technique');
});

test('éditeur : tout le canon se décrit avec des libellés ou, à défaut, ses clés (aucune clé vide)', async () => {
  const fs = await import('node:fs');
  const visiter = (v, acc) => { if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (!Array.isArray(v)) acc.add(k); visiter(x, acc); } return acc; };
  for (const f of ['systeme', 'sites', 'economie', 'lore', 'glossaire', 'ambiances', 'chronologie']) {
    const cles = visiter(JSON.parse(fs.readFileSync(new URL(`../app/donnees/canon/${f}.json`, import.meta.url), 'utf8')), new Set());
    for (const k of cles) assert.ok(libelle(k).length > 0, `${f}.${k}`);
  }
});
