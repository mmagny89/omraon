import test from 'node:test';
import assert from 'node:assert/strict';
import { STAR, PLANETS, BELT, COLD_BELT, COMETS, ROUSHAN_TROJANS } from '../app/src/data/omraon.js';
import { buildSystem } from '../app/src/physics/system.js';
import { Simulation } from '../app/src/physics/simulation.js';
import { stateToElements } from '../app/src/physics/kepler.js';
import { G } from '../app/src/physics/constants.js';

const make = (opts = {}) => { const s = new Simulation(buildSystem(STAR, PLANETS), { particleCount: 2000, trojans: true, ...opts }); s.autoTier = false; return s; };
const elem = (s, i) => stateToElements(G * s.bodies[0].mass, [s.px[i] - s.pos[0], s.py[i] - s.pos[1], s.pz[i] - s.pos[2]], [s.pvx[i] - s.vel[0], s.pvy[i] - s.vel[1], s.pvz[i] - s.vel[2]]);
const des = (s, kind) => { const r = []; for (let i = 0; i < s.pN; i++) if (s.pKind[i] === kind) r.push(i); return r; };

test('Roushan est à 12 UA (la stabilité de ses lunes est vérifiée par le test de Hill de physics.test.js)', () => {
  const r = PLANETS.find((p) => p.id === 'roushan');
  assert.equal(r.orbit.a, 12);
});

test('ceinture : lacunes de Kirkwood (7:3 et 2:1 avec Zirkan) et amas de Hilda (3:2)', () => {
  const s = make(), aZ = PLANETS.find((p) => p.id === 'zirkan').orbit.a;
  for (const [p, q, c] of [[7, 3, BELT.gaps[0][0]], [2, 1, BELT.gaps[1][0]]]) assert.ok(Math.abs(aZ * (q / p) ** (2 / 3) - c) < 0.003, `${p}:${q}`);
  assert.ok(Math.abs(aZ * (2 / 3) ** (2 / 3) - BELT.hilda.a) < 0.003, 'Hilda');
  const rock = des(s, 0).map((i) => elem(s, i).a);
  for (const [c, w] of BELT.gaps) assert.equal(rock.filter((a) => Math.abs(a - c) < w - 1e-9).length, 0, `lacune ${c}`);
  const hilda = des(s, 4).map((i) => elem(s, i).a);
  assert.ok(hilda.length > 50 && hilda.every((a) => Math.abs(a - BELT.hilda.a) < 5 * BELT.hilda.spread + 1e-9));
});

test('ceinture froide : entre 17 et 34 UA, plus loin que Roushan, dans le bord du système', () => {
  const s = make(), a = des(s, 2).map((i) => elem(s, i).a);
  assert.ok(a.length > 300);
  assert.ok(Math.min(...a) >= COLD_BELT.aMin - 1e-6 && Math.max(...a) <= COLD_BELT.aMax + 1e-6 && COLD_BELT.aMax <= 35);
  assert.ok(COLD_BELT.aMin > PLANETS.find((p) => p.id === 'roushan').orbit.a * 1.3, 'au-delà de la 3:2 de Roushan');
});

test('troyens de Roushan : ±60° devant et derrière la planète, sur la même orbite', () => {
  const s = make(), ri = s.planetIdx[4], rel = [0, 1, 2].map((k) => s.pos[3 * ri + k] - s.pos[k]);
  const lon = (x, y) => Math.atan2(y, x), lonR = lon(rel[0], rel[1]);
  const troy = des(s, 1).slice(-ROUSHAN_TROJANS), diffs = troy.map((i) => { let d = lon(s.px[i] - s.pos[0], s.py[i] - s.pos[1]) - lonR; d = Math.atan2(Math.sin(d), Math.cos(d)); return d * 180 / Math.PI; });
  assert.equal(troy.length, ROUSHAN_TROJANS);
  const dev = diffs.filter((d) => Math.abs(Math.abs(d) - 60) < 25).length / diffs.length;
  assert.ok(dev > 0.9, `${dev}`);
  assert.ok(diffs.some((d) => d > 0) && diffs.some((d) => d < 0), 'L4 et L5');
  const a = troy.map((i) => elem(s, i).a), aR = Math.hypot(...rel);
  assert.ok(a.every((x) => Math.abs(x / PLANETS.find((p) => p.id === 'roushan').orbit.a - 1) < 0.08), `${Math.min(...a)} ${Math.max(...a)} ${aR}`);
});

test('comètes et centaures : orbites très excentriques, et une comète perdue est remplacée', () => {
  const s = make(), com = des(s, 3);
  assert.equal(com.length, COMETS.count);
  assert.ok(com.every((i) => elem(s, i).e > 0.3), 'très excentriques');
  const n = s.pN; s.px[com[0]] = 1e3; // éjectée au-delà de 150 UA
  s.accParticles();
  assert.equal(s.pN, n, 'aucune comète ne disparaît');
  assert.equal(des(s, 3).length, COMETS.count);
  assert.ok(Math.hypot(s.px[com[0]] - s.pos[0], s.py[com[0]] - s.pos[1], s.pz[com[0]] - s.pos[2]) < 150, 'remplacée dans le système');
});

test('traceurs : les comètes et la ceinture froide survivent à une centaine de jours', () => {
  const s = make(); s.advance(100, 1e9);
  assert.equal(des(s, 3).length, COMETS.count);
  assert.ok(des(s, 2).length > 500);
});
