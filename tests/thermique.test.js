import test from 'node:test';
import assert from 'node:assert/strict';
import { STAR, PLANETS } from '../app/front/src/data/omraon.js';
import { SITES } from '../app/front/src/data/sites.js';
import { buildSystem } from '../app/front/src/physics/system.js';
import { Simulation } from '../app/front/src/physics/simulation.js';
import { stateToElements } from '../app/front/src/physics/kepler.js';
import { starLuminosity, habitableZone } from '../app/front/src/physics/derived.js';
import { G } from '../app/front/src/physics/constants.js';
import { siteState } from '../app/front/src/physics/sites.js';
import { facesCorps, temperatureSite, jourSolaire, T_HABITAT } from '../app/front/src/physics/thermique.js';

const sim = new Simulation(buildSystem(STAR, PLANETS), { particleCount: 300 }); sim.autoTier = false; sim.computeRender(0);
const el = (i) => {
  const b = sim.bodies[i]; if (b.type === 'star') return null; const p = b.parent;
  const r = [0, 1, 2].map((c) => sim.pos[3 * i + c] - sim.pos[3 * p + c]), v = [0, 1, 2].map((c) => sim.vel[3 * i + c] - sim.vel[3 * p + c]);
  return stateToElements(G * ((p === 0 ? sim.mass[0] : sim.mass[p]) + sim.mass[i]), r, v);
};
const idx = (nom) => sim.bodies.find((b) => b.def.name === nom).idx;
let T = 0; // date courante des essais
const prot = (i) => sim.bodies[i].def.rotation?.periodH ? sim.bodies[i].def.rotation.periodH / 24 : 0;
const ctx = { sim, ang: (i) => (prot(i) ? 2 * Math.PI * T / prot(i) : 0), protDays: prot, bodyIndex: idx, el, star: STAR, L: starLuminosity(STAR), hz: habitableZone(STAR), bodies: sim.bodies };
const K = (nom) => facesCorps(sim, el, idx(nom));

test('thermique : tout corps solide est plus chaud côté jour que côté nuit, de l\'étoile jusqu\'aux lunes', () => {
  for (const b of sim.bodies) {
    if (b.type === 'star' || b.def.kind === 'gas') continue;
    const t = facesCorps(sim, el, b.idx);
    assert.ok(Number.isFinite(t.jour) && Number.isFinite(t.nuit) && t.nuit >= 3 && t.jour >= t.nuit, `${b.def.name} : ${t.jour} / ${t.nuit}`);
  }
});

test('thermique : calage sur la Lune et Mercure (corps sans atmosphère, jour solaire long)', () => {
  const k = K('Kalpra'); // résonance 3:2 comme Mercure : nuit de plusieurs dizaines de jours, ≈ 100-150 K
  assert.ok(k.nuit > 80 && k.nuit < 200 && k.jour > 600, `Kalpra jour ${k.jour.toFixed(0)} K, nuit ${k.nuit.toFixed(0)} K`);
  assert.ok(jourSolaire(sim, el, idx('Kalpra')) > 100, 'jour solaire de Kalpra');
});

test('thermique : Kebet est tempéré (atmosphère épaisse : faible écart jour/nuit), Sethis a de grandes amplitudes', () => {
  const kb = K('Kebet'), sh = K('Sethis');
  assert.ok(kb.jour - kb.nuit < 25 && kb.moyenne > 270 && kb.moyenne < 310, `Kebet ${kb.nuit.toFixed(0)}–${kb.jour.toFixed(0)} K`);
  assert.ok(sh.jour - sh.nuit > 60, `Sethis ${sh.nuit.toFixed(0)}–${sh.jour.toFixed(0)} K`);
});

test('thermique : une géante n\'a pas de surface (mêmes valeurs des deux faces), l\'étoile garde sa photosphère', () => {
  for (const n of ['Zirkan', 'Roushan']) { const t = K(n); assert.equal(t.mode, 'geante'); assert.equal(t.jour, t.nuit); }
  assert.equal(K('Omraon').jour, STAR.teff);
});

test('thermique : température en direct de chaque site — finie, au-dessus du fond diffus, habitat à 20 °C', () => {
  for (const s of SITES) {
    const st = siteState(ctx, s, 0), r = temperatureSite(sim, el, s, st);
    assert.ok(Number.isFinite(r.dehors) && r.dehors >= 3 && r.dehors < 1500, `${s.id} : ${r.dehors}`);
    assert.equal(r.dedans, T_HABITAT);
    assert.ok(typeof r.regime === 'string' && r.regime.length > 3, s.id);
  }
});

test('thermique : un site au sol suit le jour et la nuit, une station passe à l\'ombre de son corps', () => {
  const site = SITES.find((s) => s.id === 'kalpra-mines'), vus = new Set(), temps = [];
  for (let t = 0; t < 130; t += 1) { T = t; sim.advance(t, 9); sim.computeRender(t); const r = temperatureSite(sim, el, site, siteState(ctx, site, t)); vus.add(r.regime); temps.push(r.dehors); }
  assert.ok(vus.has('Jour') && vus.has('Nuit'), [...vus].join());
  assert.ok(Math.max(...temps) - Math.min(...temps) > 200, 'grande amplitude sur un jour solaire de Kalpra');
  const station = SITES.find((s) => s.id === 'naksun-octroi'), regimes = new Set();
  for (let t = 130; t < 131; t += 0.01) { T = t; sim.advance(t, 9); sim.computeRender(t); regimes.add(temperatureSite(sim, el, station, siteState(ctx, station, t)).regime); }
  assert.ok([...regimes].some((x) => x.startsWith('Coque')) && [...regimes].some((x) => x.startsWith('Dans l\'ombre')), [...regimes].join(' | '));
});

test('thermique : le modèle JavaScript et son miroir PHP donnent les mêmes températures (fixture partagée)', async () => {
  const { calculer } = await import('../outils/generer-thermique.mjs');
  const fixture = JSON.parse((await import('node:fs')).readFileSync(new URL('../app/tests/fixtures/thermique.json', import.meta.url), 'utf8'));
  assert.deepEqual(calculer(), fixture, 'fixture périmée : node outils/generer-thermique.mjs');
});
