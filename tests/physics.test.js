import test from 'node:test';
import assert from 'node:assert/strict';
import { STAR, PLANETS } from '../app/src/data/omraon.js';
import { buildSystem } from '../app/src/physics/system.js';
import { Simulation } from '../app/src/physics/simulation.js';
import { elementsToState, stateToElements } from '../app/src/physics/kepler.js';
import { habitableZone, hillRadius, stableSatelliteLimit } from '../app/src/physics/derived.js';
import { G, AU_KM } from '../app/src/physics/constants.js';

const make = (opts = {}) => { const s = new Simulation(buildSystem(STAR, PLANETS), { particleCount: 300, ...opts }); s.autoTier = false; return s; };

test('éléments -> état -> éléments', () => {
  const el = { a: 1.9, e: 0.3, i: 0.4, Om: 1.1, w: 2.2, M: 0.7 };
  const s = elementsToState(G, el);
  const b = stateToElements(G, s.r, s.v);
  for (const k of ['a', 'e', 'i', 'Om', 'w', 'M']) assert.ok(Math.abs(b[k] - el[k]) < 1e-9, k);
});

test('zone habitable : Zirkan est dedans', () => {
  const hz = habitableZone(STAR);
  assert.ok(hz.conservative[0] < 1.9 && 1.9 < hz.conservative[1], JSON.stringify(hz));
});

test('lunes sous 0,4895 rayon de Hill', () => {
  const sim = make();
  for (const b of sim.bodies.filter((x) => x.type === 'moon')) {
    const p = sim.bodies[b.parent], o = p.def.orbit;
    const rh = hillRadius(o.a, o.e, sim.mEff[p.idx], STAR.massMsun);
    assert.ok(b.def.orbit.a / AU_KM < stableSatelliteLimit(rh, o.e, b.def.orbit.e), b.def.name);
  }
});

test('N-corps complet : énergie et moment cinétique conservés (2 ans)', () => {
  const sim = make({ trojans: false });
  sim.gr = false;
  sim.advance(730, 1e9);
  const d = sim.drift();
  assert.ok(Math.abs(d.dE) < 1e-7, `dE=${d.dE}`);
  assert.ok(Math.abs(d.dL) < 1e-10, `dL=${d.dL}`);
});

test('stabilité des lunes sur 60 ans (N-corps complet)', () => {
  const sim = make();
  sim.advance(60 * 365.25, 1e9);
  for (const b of sim.bodies.filter((x) => x.type === 'moon')) {
    const k = (i) => [0, 1, 2].map((c) => sim.pos[3 * i + c] - sim.pos[3 * b.parent + c]);
    const kv = (i) => [0, 1, 2].map((c) => sim.vel[3 * i + c] - sim.vel[3 * b.parent + c]);
    const el = stateToElements(G * (sim.mass[b.parent] + b.mass), k(b.idx), kv(b.idx));
    assert.ok(el.e < 0.15, `${b.def.name} e=${el.e}`);
    assert.ok(Math.abs(el.a * AU_KM / b.def.orbit.a - 1) < 0.1, `${b.def.name} a`);
  }
});

test('bascule rails <-> N-corps : pas de saut', () => {
  const sim = make();
  sim.advance(100, 1e9);
  const before = Array.from(sim.pos);
  sim.enterRails(); sim.computeRender(sim.t);
  const railPos = Array.from(sim.rPos);
  let maxd = 0;
  for (const b of sim.bodies) if (b.type === 'moon') for (let c = 0; c < 3; c++) maxd = Math.max(maxd, Math.abs(railPos[3 * b.idx + c] - before[3 * b.idx + c]));
  assert.ok(maxd * AU_KM < 5000, `écart ${maxd * AU_KM} km`);
  sim.exitRails();
  for (const b of sim.bodies) if (b.type === 'moon') for (let c = 0; c < 3; c++) assert.ok(Math.abs(sim.pos[3 * b.idx + c] - before[3 * b.idx + c]) * AU_KM < 1);
});

test('planètes stables sur 1500 ans (lunes sur rails)', () => {
  const sim = make();
  sim.enterRails(); sim.gr = false;
  sim.advance(1500 * 365.25, 1e9);
  assert.ok(Math.abs(sim.drift().dE) < 1e-5, `dE=${sim.drift().dE}`);
  for (const pi of sim.planetIdx) {
    const o = sim.bodies[pi].def.orbit;
    const r = [0, 1, 2].map((c) => sim.pos[3 * pi + c] - sim.pos[c]);
    const v = [0, 1, 2].map((c) => sim.vel[3 * pi + c] - sim.vel[c]);
    const el = stateToElements(G * (STAR.massMsun + sim.mEff[pi]), r, v);
    assert.ok(Math.abs(el.a / o.a - 1) < 0.02, `${sim.bodies[pi].def.name} a=${el.a}`);
  }
});

import { assess, distanceForTemp, doseRemPerDay, tidalHeatingWm2 } from '../app/src/physics/habitability.js';
import { equilibriumTemp, starLuminosity } from '../app/src/physics/derived.js';

const ctxOf = (sim) => ({
  star: STAR, L: starLuminosity(STAR), hz: habitableZone(STAR), bodies: sim.bodies, mEff: sim.mEff,
  prot: () => 0,
  el: (i) => {
    const b = sim.bodies[i]; if (b.type === 'star') return null;
    const p = b.parent;
    const r = [0, 1, 2].map((c) => sim.pos[3 * i + c] - sim.pos[3 * p + c]), v = [0, 1, 2].map((c) => sim.vel[3 * i + c] - sim.vel[3 * p + c]);
    return stateToElements(G * ((p === 0 ? sim.mass[0] : sim.mass[p]) + sim.mass[i]), r, v);
  },
});

test('distanceForTemp inverse de equilibriumTemp', () => {
  const d = distanceForTemp(STAR, 0.3, 288);
  assert.ok(Math.abs(equilibriumTemp(STAR, d, 0.3) - 288) < 1e-6);
});
test('doses de Jupiter : valeurs de référence', () => {
  assert.ok(Math.abs(doseRemPerDay(9.4) / 540 - 1) < 1e-9);
  assert.ok(doseRemPerDay(21) < doseRemPerDay(15) && doseRemPerDay(21) > doseRemPerDay(26));
});
test('chauffage de marée : Io ≈ 1e14 W', () => {
  const area = 4 * Math.PI * 1.82e6 ** 2;
  const w = tidalHeatingWm2({ Mp: 1.898e27, R: 1.82e6, a: 4.22e8, e: 0.0041, k2Q: 0.016 }) * area;
  assert.ok(w > 5e13 && w < 2e14, `${w}`);
});
test('habitabilité : Kebet = surface, Kalpra = protégé difficile, Roushan = flottant', () => {
  const sim = make();
  const ctx = ctxOf(sim), idx = (n) => sim.bodies.find((b) => b.def.name === n).idx;
  const k = assess(ctx, idx('Kebet')), kal = assess(ctx, idx('Kalpra')), rou = assess(ctx, idx('Roushan'));
  assert.equal(k.mode, 'surface'); assert.equal(kal.mode, 'protege'); assert.equal(rou.mode, 'flottant');
  assert.equal(kal.level, 'bad');
  assert.ok(k.criteria.some((c) => c.label === 'Température de surface'));
});

import { SITES } from '../app/src/data/sites.js';
import { siteState } from '../app/src/physics/sites.js';
import { hohmann, transfer } from '../app/src/physics/transfers.js';
import { shieldingGcm2, siteReport } from '../app/src/physics/habitat.js';

const siteCtx = (sim) => ({ sim, ang: () => 0, protDays: () => 0, bodyIndex: (n) => sim.bodies.find((b) => b.def.name === n).idx, el: ctxOf(sim).el });
const find = (id) => SITES.find((s) => s.id === id);

test('Hohmann Terre–Mars : 5,6 km/s, 259 j', () => {
  const AU = 149597870.7, h = hohmann(1.32712440018e11, AU, 1.524 * AU);
  assert.ok(Math.abs(h.dv - 5.6) < 0.05 && Math.abs(h.t / 86400 - 259) < 1);
});
test('blindage : nul sous la cible, croissant avec la dose', () => {
  assert.equal(shieldingGcm2(0.1, 0), 0);
  assert.ok(shieldingGcm2(1, 0) > 0 && shieldingGcm2(1, 50) > shieldingGcm2(1, 0));
});
test('sites : surface au rayon du corps, orbite à vitesse circulaire', () => {
  const sim = make(); sim.computeRender(0); const ctx = siteCtx(sim);
  const s = siteState(ctx, find('sethis-cite-a'), 0), b = sim.bodies.find((x) => x.def.name === 'Sethis');
  const r = Math.hypot(...[0, 1, 2].map((k) => s.pos[k] - sim.rPos[3 * b.idx + k])) * AU_KM;
  assert.ok(Math.abs(r / b.radiusKm - 1) < 1e-9);
  const o = siteState(ctx, find('naksun-octroi'), 0), n = sim.bodies.find((x) => x.def.name === 'Naksun');
  const rel = [0, 1, 2].map((k) => o.pos[k] - sim.rPos[3 * n.idx + k]), vr = [0, 1, 2].map((k) => o.vel[k] - sim.rVel[3 * n.idx + k]);
  assert.ok(Math.abs(Math.hypot(...vr) / Math.sqrt(G * sim.mass[n.idx] / Math.hypot(...rel)) - 1) < 1e-9);
});
test('trajets : tous les couples ont un Δv fini', () => {
  const sim = make(); sim.computeRender(0); const ctx = siteCtx(sim);
  const st = new Map(SITES.map((s) => [s.id, siteState(ctx, s, 0)]));
  for (const a of SITES) for (const b of SITES) {
    if (a === b) continue;
    for (const k of ['chimique', 'hyper', 'subliminique']) {
      const r = transfer({ sim }, a, st.get(a.id), b, st.get(b.id), k);
      assert.ok(Number.isFinite(r.hohmann.dv) && r.hohmann.dv > 0 && Number.isFinite(r.hohmann.days), `${a.id}→${b.id} ${r.hohmann.dv}`);
      if (r.windowDays != null) assert.ok(r.windowDays >= 0);
    }
  }
});
test('population des sites : dans le canon (300 000 – 800 000 humains, Haut en dizaines de milliers)', () => {
  const hum = SITES.reduce((t, x) => t + x.population, 0), kebet = SITES.filter((x) => x.body === 'Kebet').reduce((t, x) => t + x.population, 0);
  assert.ok(hum >= 3e5 && hum <= 8e5, `${hum}`); assert.ok(kebet >= 1e4 && kebet <= 1e5, `${kebet}`);
});
test('hyperpropulsion : 35 UA en ~6 j vers 8 g, vitesse plafonnée à 0,95 c', async () => {
  const { cruise } = await import('../app/src/physics/transfers.js');
  const d = 35 * 149597870700, r = cruise(d, 8 * 9.80665, 0.95);
  assert.ok(Math.abs(r.t / 86400 - 6) < 0.6, `${r.t / 86400}`);
  const far = cruise(1e17, 8 * 9.80665, 0.95); assert.ok(far.cruised && Math.abs(far.peak - 0.95) < 1e-9);
});
test('rapport de site : chaque site produit des sections finies', () => {
  const sim = make(); sim.computeRender(0); const ctx = siteCtx(sim);
  for (const s of SITES) {
    const rep = siteReport(ctx, s, siteState(ctx, s, 0), 0);
    assert.ok(rep.sections.length >= 5 && Number.isFinite(rep.derived.Tenv), s.id);
    assert.ok(!JSON.stringify(rep).includes('NaN'), s.id);
  }
});

import { EVENTS, eraAt, systemAgeGyr } from '../app/src/data/chronologie.js';
test('saut dans le temps : aller à −500 ans puis revenir ramène les planètes (réversibilité)', () => {
  const sim = make(); sim.computeRender(0);
  sim.enterRails();
  const start = Array.from(sim.pos.slice(0, 3 * sim.nHeavy));
  sim.jumpTo(-500 * 365.25);
  assert.ok(Math.abs(sim.t + 500 * 365.25) < 1e-6);
  const moved = Math.hypot(sim.pos[3 * 4] - start[3 * 4], sim.pos[3 * 4 + 1] - start[3 * 4 + 1]);
  assert.ok(moved > 0.1, 'Zirkan a dû bouger'); // 500 ans = ~213 orbites de Zirkan, phase quelconque
  sim.jumpTo(0);
  let maxd = 0; for (let k = 0; k < 3 * sim.nHeavy; k++) maxd = Math.max(maxd, Math.abs(sim.pos[k] - start[k]));
  assert.ok(maxd < 2e-4, `écart ${maxd} UA`);
});
test('chronologie : ères, événements et âge du système', () => {
  assert.equal(eraAt(-530).label.startsWith('La cohabitation'), true);
  assert.equal(eraAt(-400).label, 'Les Siècles Sombres');
  assert.ok(EVENTS.some((e) => e.year === -500) && EVENTS.some((e) => e.year === 0));
  assert.ok(Math.abs(systemAgeGyr(STAR, -500) - (3 - 5e-7)) < 1e-12);
});
test('Kebet : rotation synchrone, jour ≈ 1,3 j (« journée proche de 1 jour »)', () => {
  const sim = make(); const k = sim.bodies.find((b) => b.def.name === 'Kebet'), z = sim.bodies.find((b) => b.def.name === 'Zirkan');
  const el = ctxOf(sim).el(k.idx), solar = 1 / (1 / el.period - 1 / ctxOf(sim).el(z.idx).period);
  assert.ok(el.period > 1 && el.period < 1.5 && solar > 1 && solar < 1.5, `P=${el.period} solaire=${solar}`);
});

import { computeSky, overlapFraction } from '../app/src/physics/sky.js';
import { runEphemeris } from '../app/src/physics/ephemeris.js';
import { buildScene } from '../app/src/physics/scene.js';

const simAt0 = () => { const s = make(); s.computeRender(0); return s; };
const rotOf = (sim) => sim.bodies.map(() => ({ phase0: 0, protDays: 1 }));

test('ciel : recouvrement de disques', () => {
  assert.equal(overlapFraction(1, 2, 5), 0);
  assert.equal(overlapFraction(1, 2, 0), 1);
  assert.ok(Math.abs(overlapFraction(1, 1, 0) - 1) < 1e-12);
  const half = overlapFraction(1, 1, 1); assert.ok(half > 0.3 && half < 0.45);
});
test('ciel de Kebet : Zirkan ≈ 24° de diamètre, étoile ≈ 0,5°', () => {
  const sim = simAt0(), ctx = siteCtx(sim), site = find('kebet-temples'), st = siteState(ctx, site, 0), sky = computeSky(sim, site, st);
  const z = sky.objs.find((o) => o.name === 'Zirkan'), s = sky.objs.find((o) => o.type === 'star');
  assert.ok(Math.abs(z.angR * 2 * 180 / Math.PI - 24.4) < 0.7, `${z.angR * 360 / Math.PI}`);
  assert.ok(s.angR * 360 / Math.PI > 0.3 && s.angR * 360 / Math.PI < 0.7);
  assert.ok(!sky.objs.some((o) => o.name === 'Kebet'), 'le corps du site ne se voit pas lui-même');
});
test('éphémérides : 23-24 éclipses de Kebet en 30 j (2,1 h chacune), source non modifiée', () => {
  const sim = simAt0(), before = Array.from(sim.pos), t = sim.t;
  const ev = runEphemeris(sim, 30, { rot: rotOf(sim), kinds: { eclipses: true, alignments: false, apsides: false, sun: false } });
  const kebet = ev.filter((e) => e.who === 'Kebet');
  assert.ok(kebet.length >= 22 && kebet.length <= 25, `${kebet.length}`);
  assert.ok(kebet.every((e) => Math.abs(e.duration * 24 - 2.1) < 0.4), kebet.map((e) => e.duration * 24).join());
  assert.equal(sim.t, t); assert.deepEqual(Array.from(sim.pos), before);
});
test('éphémérides : levers/couchers alternent ; périhélies et aphélies de Kalpra en 130 j', () => {
  const sim = simAt0(), site = find('kebet-temples');
  const sun = runEphemeris(sim, 12, { rot: rotOf(sim), site, kinds: { eclipses: false, alignments: false, apsides: false, sun: true } });
  assert.ok(sun.length >= 14 && sun.every((e, i) => i === 0 || e.type !== sun[i - 1].type), `${sun.length}`);
  const aps = runEphemeris(sim, 130, { rot: rotOf(sim), kinds: { eclipses: false, alignments: false, apsides: true, sun: false } });
  assert.ok(aps.some((e) => e.type === 'Périhélie' && e.who === 'Kalpra') && aps.some((e) => e.type === 'Aphélie' && e.who === 'Kalpra'));
});
test('fiche de scène : contient lumière, ciel, communications et banque d\'images', () => {
  const sim = simAt0(), ctx = siteCtx(sim), site = find('kebet-quartiers'), st = siteState(ctx, site, 0), sky = computeSky(sim, site, st);
  const report = siteReport(ctx, site, st, 0);
  const sc = buildScene({ site, sky, report, events: [{ type: 'Éclipse partielle', t: 0.2, duration: 0.08, by: 'Zirkan', who: 'Kebet' }], t: 0, comms: [{ name: 'Roushan', minutes: 12 }], title: 'T' });
  const heads = sc.blocks.map((b) => b.h).join('|');
  assert.ok(/Lumière/.test(heads) && /Ciel/.test(heads) && /Communications/.test(heads) && /Kebet/.test(heads));
  assert.ok(/Zirkan/.test(sc.text) && /Prochaine éclipse/.test(sc.text) && !/NaN|undefined/.test(sc.text));
});

import { habitabilityScan } from '../app/src/physics/habscan.js';
test('Kebet : habitable en permanence sur 5 ans (température, chauffage de marée), copie sans effet sur la source', () => {
  const sim = simAt0(), t = sim.t, k = sim.bodies.find((b) => b.def.name === 'Kebet').idx;
  const r = habitabilityScan(sim, k, 5);
  assert.ok(r.always, JSON.stringify(r));
  assert.ok(r.T[0] >= 278 && r.T[1] <= 308 && r.heat[1] < 0.5 && r.e[1] < 3e-4, JSON.stringify(r));
  assert.equal(sim.t, t);
});
test('intégrateur d\'ordre 4 : précession parasite de Kalpra < 0,03°/an, RG ≈ 0,0003°/an', () => {
  const run = (gr) => {
    const s = make(); s.gr = gr; s.enterRails(); const el = () => { const q = s.elementState(1); return stateToElements(q.mu, q.r, q.v); };
    const w0 = el().varpi; s.jumpTo(50 * 365.25); let dw = el().varpi - w0; dw = Math.atan2(Math.sin(dw), Math.cos(dw)); return dw * 180 / Math.PI / 50;
  };
  const a = run(false), b = run(true);
  assert.ok(Math.abs(a) < 0.03, `${a}`); assert.ok(Math.abs(b - a) > 1e-4 && Math.abs(b - a) < 8e-4, `GR=${b - a}`);
});
