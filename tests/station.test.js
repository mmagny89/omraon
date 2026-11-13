import test from 'node:test';
import assert from 'node:assert/strict';
import { STAR, PLANETS } from '../app/src/data/omraon.js';
import { buildSystem } from '../app/src/physics/system.js';
import { Simulation } from '../app/src/physics/simulation.js';
import { SITES } from '../app/src/data/sites.js';
import { siteState } from '../app/src/physics/sites.js';
import { hillRadius, stableSatelliteLimit } from '../app/src/physics/derived.js';
import { G, AU_KM } from '../app/src/physics/constants.js';

const sim = new Simulation(buildSystem(STAR, PLANETS), { particleCount: 300 }); sim.autoTier = false; sim.computeRender(0);
const ctx = (ang) => ({ sim, ang: () => ang, protDays: () => 0, bodyIndex: (n) => sim.bodies.find((b) => b.def.name === n).idx });
const find = (id) => SITES.find((s) => s.id === id);
const sub = (a, b) => [0, 1, 2].map((k) => a[k] - b[k]), norm = (v) => Math.hypot(...v), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

test('station de Kebet : tenue au-dessus de la capitale, à toute heure de rotation', () => {
  const port = find('kebet-orbite'), capitale = find('kebet-consortium'), kebet = sim.bodies.find((b) => b.def.name === 'Kebet');
  const centre = [0, 1, 2].map((k) => sim.rPos[3 * kebet.idx + k]);
  for (const ang of [0, 0.9, 2.3, 4.1, 5.8]) {
    const sp = siteState(ctx(ang), port, 0), cp = siteState(ctx(ang), capitale, 0);
    const u = sub(sp.pos, centre), v = sub(cp.pos, centre);
    assert.ok(dot(u, v) / (norm(u) * norm(v)) > 1 - 1e-12, `alignement à ${ang} rad`);
    assert.ok(Math.abs(norm(sub(sp.pos, cp.pos)) * AU_KM - port.altKm) < 1, 'altitude au-dessus de la capitale');
  }
});

test('station de Kebet : pas d\'orbite possible, la synchrone est hors de la sphère de Hill', () => {
  const kebet = sim.bodies.find((b) => b.def.name === 'Kebet'), zirkan = sim.bodies[kebet.parent], o = kebet.def.orbit;
  const aKm = o.a, rh = hillRadius(o.a / AU_KM, o.e, sim.mEff[kebet.idx], sim.mEff[zirkan.idx]) * AU_KM;
  // rotation synchrone : période propre = période orbitale autour de Zirkan ; rayon synchrone r³ = G·m·T²/4π²
  const T = 2 * Math.PI * Math.sqrt((aKm / AU_KM) ** 3 / (G * (sim.mEff[zirkan.idx] + sim.mEff[kebet.idx]))); // jours
  const rSync = Math.cbrt(G * sim.mEff[kebet.idx] * T * T / (4 * Math.PI ** 2)) * AU_KM;
  assert.ok(rSync > rh, `${rSync} km vs Hill ${rh} km`);
  assert.ok(rSync > stableSatelliteLimit(rh / AU_KM, o.e, 0) * AU_KM * 2);
});
