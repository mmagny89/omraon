import test from 'node:test';
import assert from 'node:assert/strict';
import { STAR, PLANETS } from '../app/src/data/omraon.js';
import { buildSystem } from '../app/src/physics/system.js';
import { Simulation } from '../app/src/physics/simulation.js';
import { stateToElements } from '../app/src/physics/kepler.js';
import { starLuminosity, habitableZone } from '../app/src/physics/derived.js';
import { G } from '../app/src/physics/constants.js';
import { SITES } from '../app/src/data/sites.js';
import { siteState } from '../app/src/physics/sites.js';
import { computeSky } from '../app/src/physics/sky.js';
import { siteReport } from '../app/src/physics/habitat.js';
import { buildScene } from '../app/src/physics/scene.js';
import { ambianceFor, AMBIANCES_SITES } from '../app/src/data/ambiances.js';

const sim = new Simulation(buildSystem(STAR, PLANETS), { particleCount: 300 }); sim.autoTier = false; sim.computeRender(0);
const el = (i) => { const b = sim.bodies[i]; if (b.type === 'star') return null; const p = b.parent, r = [0, 1, 2].map((c) => sim.pos[3 * i + c] - sim.pos[3 * p + c]), v = [0, 1, 2].map((c) => sim.vel[3 * i + c] - sim.vel[3 * p + c]); return stateToElements(G * ((p === 0 ? sim.mass[0] : sim.mass[p]) + sim.mass[i]), r, v); };
const ctx = { sim, ang: () => 0, protDays: () => 0, bodyIndex: (n) => sim.bodies.find((b) => b.def.name === n).idx, el, star: STAR, L: starLuminosity(STAR), hz: habitableZone(STAR), bodies: sim.bodies, mEff: sim.mEff, prot: () => 0 };

test('chaque site a un ciel, une fiche de scène et une ambiance qui lui est propre', () => {
  for (const site of SITES) {
    const st = siteState(ctx, site, 0), sky = computeSky(sim, site, st);
    assert.ok(sky.objs.some((o) => o.type === 'star'), `${site.id} : l'étoile est dans le ciel`);
    assert.ok(Number.isFinite(sky.sunEl), `${site.id} : hauteur de l'étoile`);
    const report = siteReport({ sim, el: (i) => ({ period: 1, protDays: 1 }) }, site, st, 0);
    const sc = buildScene({ site, sky, report, events: [], t: 0, comms: [], title: site.name });
    assert.ok(sc.blocks.length >= 3 && !/NaN|undefined/.test(sc.text), `${site.id} : fiche de scène`);
  }
});

test('les sites de la ceinture, des troyens et de la ceinture froide ont leur propre ambiance', () => {
  for (const id of ['ceinture-fonderies', 'ceinture-glace', 'troyens-roushan', 'froide-relais']) {
    assert.ok(AMBIANCES_SITES[id], `${id} : ambiance`);
    const a = ambianceFor(SITES.find((s) => s.id === id));
    assert.equal(a.key, id);
    for (const k of ['voir', 'entendre', 'sentir', 'toucher', 'corps']) assert.ok(a[k]?.length, `${id}.${k}`);
    assert.equal(a.canon, false);
  }
});
