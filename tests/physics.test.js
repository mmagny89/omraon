import test from 'node:test';
import assert from 'node:assert/strict';
import { STAR, PLANETS } from '../app/src/data/omraon.js';
import { buildSystem } from '../app/src/physics/system.js';
import { Simulation } from '../app/src/physics/simulation.js';
import { elementsToState, stateToElements } from '../app/src/physics/kepler.js';
import { habitableZone, hillRadius, stableSatelliteLimit, bulk } from '../app/src/physics/derived.js';
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

import { planFlight, planVoyage, voyageAt } from '../app/src/physics/flight.js';
test('vol : profil cohérent (distance parcourue = distance, vitesses nulles aux extrémités)', () => {
  const d = 3.96e11, p = planFlight(d, 8, 0.95);
  assert.ok(Math.abs(p.distAt(p.total) / d - 1) < 1e-9 && p.speedAt(0) === 0 && p.speedAt(p.total) < 1e-3);
  assert.ok(Math.abs(p.total / 86400 - 1.64) < 0.05, `${p.total / 86400} j`); // 2,65 UA à 8 g : 2·√(d/a) = 1,64 j
  assert.equal(p.hasRest, false);
});
test('vol : 35 UA = repos moteur au milieu, jamais plus de 6 j de poussée continue', () => {
  const d = 35 * 149597870700, p = planFlight(d, 4, 0.95); // 4 g : trajet de ~11 j > 6 j
  assert.ok(p.hasRest && p.segs.some((s) => s.kind === 'rest'));
  assert.ok(p.segs.filter((s) => s.kind !== 'rest').every((s) => s.dur <= 6 * 86400 + 1), 'poussées ≤ 6 j');
  assert.ok(Math.abs(p.distAt(p.total) / d - 1) < 1e-9);
  const noRest = planFlight(d, 8, 0.95); assert.equal(noRest.hasRest, false); // 8 g : 35 UA en ~6 j sans repos
});
test('vol : plafond de vitesse 0,1 c (subliminique) → croisière', () => {
  const p = planFlight(1e14, 1, 0.1); assert.ok(p.segs.some((s) => s.kind === 'cruise') && Math.abs(p.peak / 299792458 - 0.1) < 1e-9);
});
test('voyage : intercepte une destination mobile (arrivée = position prévue)', () => {
  const dest = (t) => [1.5 + 0.01 * t, 0.3 * Math.sin(0.1 * t), 0]; // cible qui se déplace de 0,01 UA/j
  const v = planVoyage({ A0: [0, 0, 0], tDep: 0, destPosAt: dest, aG: 8, vmax: 0.95 });
  const end = voyageAt(v, v.tArr, dest(v.tArr)), B = dest(v.tArr);
  assert.ok(Math.hypot(end.pos[0] - B[0], end.pos[1] - B[1], end.pos[2] - B[2]) < 1e-9 && end.done);
  const mid = voyageAt(v, v.tDep + (v.tArr - v.tDep) / 2, dest(v.tDep + (v.tArr - v.tDep) / 2));
  assert.ok(mid.speed > 0 && mid.progress > 0.3 && mid.progress < 0.7);
});

import { simulateSpread, lightDelayDays } from '../app/src/physics/network.js';
const netPos = (sim) => { sim.computeRender(0); const ctx = siteCtx(sim); return new Map(SITES.map((s) => [s.id, siteState(ctx, s, 0).pos])); };
test('réseau : délai lumière = distance × 8,3167 min/UA', () => {
  assert.ok(Math.abs(lightDelayDays([0, 0, 0], [1, 0, 0]) * 1440 - 8.3167) < 1e-9);
});
test('réseau : diffusion directe = lumière + saut ; via le Consortium = détour (jamais plus tôt)', () => {
  const pos = netPos(make()), base = { sites: SITES, pos, origin: 'nunzir-repaire', horizonDays: 7 };
  const d = simulateSpread({ ...base, topology: 'direct' }), c = simulateSpread({ ...base, topology: 'controle' });
  for (const n of d.nodes) { const m = c.nodes.find((x) => x.id === n.id); assert.ok(m.tReceive >= n.tReceive - 1e-12, n.id); }
  const o = d.nodes.find((n) => n.id === 'nunzir-repaire'); assert.equal(o.tReceive, 0);
  const far = d.nodes.find((n) => n.id === 'roukir-poste'), near = d.nodes.find((n) => n.id === 'kebet-orbite');
  assert.ok(far.tReceive > 0 && near.tReceive > 0);
});
test('réseau : proportions croissantes, ≤ 1, la répression réduit la portée, le bouche-à-oreille est plus lent', () => {
  const pos = netPos(make()), base = { sites: SITES, pos, origin: 'sethis-cite-a', horizonDays: 30, topology: 'direct' };
  const r = simulateSpread(base);
  for (let i = 1; i < r.curve.length; i++) { assert.ok(r.curve[i].humans >= r.curve[i - 1].humans - 1e-12 && r.curve[i].humans <= 1 + 1e-12); }
  const slowKill = simulateSpread({ ...base, detectMin: 100000 }), fastKill = simulateSpread({ ...base, detectMin: 1 });
  assert.ok(fastKill.summary.finalH < slowKill.summary.finalH, `${fastKill.summary.finalH} vs ${slowKill.summary.finalH}`);
  const bo = simulateSpread({ ...base, mode: 'bouche' });
  const tmax = (x) => Math.max(...x.nodes.map((n) => n.tReceive));
  assert.ok(tmax(bo) > tmax(r) * 10, `${tmax(bo)} vs ${tmax(r)}`);
  assert.ok(Number.isFinite(r.summary.finalH) && r.summary.reached >= 1);
});

import { horizonDistance, surfaceDrop, horizonDip } from '../app/src/physics/horizon.js';
test('vue à hauteur d\'yeux : horizon de la Terre ≈ 4,7 km, courbure cohérente', () => {
  assert.ok(Math.abs(horizonDistance(6371e3, 1.7) / 4650 - 1) < 0.02, `${horizonDistance(6371e3, 1.7)}`);
  assert.ok(Math.abs(surfaceDrop(6371e3, 4650) - 1.7) < 0.01);
  const kebet = horizonDistance(0.95 * 6371e3, 1.7), sedbou = horizonDistance(38e3, 1.7);
  assert.ok(kebet > 4000 && kebet < 5000 && sedbou > 300 && sedbou < 400, `${kebet} ${sedbou}`); // un astéroïde : horizon à 360 m
  assert.ok(horizonDip(6371e3, 400e3) > 15 && horizonDip(6371e3, 400e3) < 25); // ISS : ~19,7°
});

import { simulatePopulation } from '../app/src/physics/population.js';
test('population : arrivée, croissance et présent dans le canon', () => {
  const m = simulatePopulation({}), a0 = m.at(-560), n = m.at(0);
  assert.equal(Math.round(a0.H), 10000); assert.equal(Math.round(a0.T), 4000);
  assert.ok(Math.abs(n.H / 500000 - 1) < 0.01, `${n.H}`);
  assert.ok(m.growth > 0.005 && m.growth < 0.009, `${m.growth}`); // ~0,7 %/an
  assert.ok(m.summary.canonHumans);
  assert.ok(n.ratio > 1 && n.ratio < 1.3, `${n.ratio}`); // Tyts plus nombreux que les humains (mode « gestion », ratio visé 1,2)
});
test('dégel : contrôle intact jusqu\'à la perte du savoir, puis déclin ; désespoir né du génocide qui s\'estompe', () => {
  const m = simulatePopulation({});
  assert.equal(m.at(-400).C, 1); assert.ok(m.summary.thawYear > -300 && m.summary.thawYear < -100, `${m.summary.thawYear}`);
  assert.ok(m.at(0).C < m.at(-150).C && m.at(0).C > 0.3 && m.at(0).C < 0.8);
  assert.ok(Math.abs(m.at(-500).D - 0.95) < 0.01 && m.at(0).D < m.at(-400).D && m.at(0).D > 0.3);
  assert.ok(m.at(0).bascule > 0.5 && m.at(0).bascule < 2, `bascule ${m.at(0).bascule}`); // « le système est à un point de bascule »
  assert.ok(m.at(0).A > 0.03 && m.at(0).A < 0.2 && m.at(0).revolts > 0.05 && m.at(0).revolts < 2);
});
test('dégel : la vérité rapportée accélère l\'éveil ; mode nature ≠ mode gestion', () => {
  const base = simulatePopulation({}), truth = simulatePopulation({ truthYear: 0, truthStrength: 0.8 });
  assert.ok(truth.at(30).A > base.at(30).A * 1.5, `${truth.at(30).A} vs ${base.at(30).A}`);
  assert.ok(truth.at(-1).A === base.at(-1).A || Math.abs(truth.at(-1).A - base.at(-1).A) < 1e-9);
  const nat = simulatePopulation({ tytMode: 'nature' });
  assert.ok(Math.abs(nat.at(0).T - base.at(0).T) > 1000);
  const moreArch = simulatePopulation({ N0: 20000, humansNow: 500000 }); assert.ok(moreArch.growth < base.growth); // plus de passagers → croissance plus faible pour le même présent
});

test('confins : Shukal, petite planète-colonie stable près de Roukir, gravité de type Mars', () => {
  const sim = make(), b = sim.bodies.find((x) => x.def.name === 'Shukal'), roushan = sim.bodies.find((x) => x.def.name === 'Roushan');
  assert.ok(b && b.parent === roushan.idx && b.def.provisional);
  const g = bulk(b.mass, b.radiusKm).gSurf / 9.80665; assert.ok(g > 0.3 && g < 0.5, `${g} g`);
  sim.advance(300 * 365.25, 1e9);
  const q = sim.elementState(b.idx), el = stateToElements(q.mu, q.r, q.v);
  assert.ok(el.e < 0.12 && Math.abs(el.a * AU_KM / 9.5e6 - 1) < 0.1, `e=${el.e} a=${el.a * AU_KM}`);
  const hab = assess(ctxOf(sim), b.idx); assert.ok(['protege', 'station'].includes(hab.mode)); // pas d'atmosphère viable
});

import { calibrerJour, decouperDate, fmtDuree, fmtSecondes, jourKebet } from '../app/src/physics/calendrier.js';
test('calendrier de Kebet : le jour de Kebet fait référence pour jours et heures', () => {
  const sim = make(), j = calibrerJour(sim), el = ctxOf(sim).el(sim.bodies.find((b) => b.def.name === 'Kebet').idx);
  assert.ok(Math.abs(j - el.period) / el.period < 0.01, `jour=${j} période=${el.period}`);
  assert.equal(jourKebet(), j);
  const d = decouperDate(j * (3.5 + 30.5 / 86400)); // 3 jours de Kebet, 12 h 00 min 30 s
  assert.deepEqual([d.an, d.jour, d.h, d.min, d.s], [0, 3, 12, 0, 30]);
  assert.match(fmtDuree(j), /^24\.0 h \(30\.\d h Terre\)$/); assert.match(fmtDuree(j * 5), /^5\.00 j \(\d\.\d\d j Terre\)$/); assert.match(fmtSecondes(j * 3600), /^60 min \(.* Terre\)$/); assert.match(fmtSecondes(j * 10800), /^3\.0 h \(.* Terre\)$/);
});

import { encoderEtat, decoderEtat } from '../app/src/ui/lien.js';
test('lien partageable : aller-retour, bornes et valeurs hostiles', () => {
  const e = { t: 1234.56789, b: 'Kebet', s: 'kebet-quartiers', az: 0.6, el: 0.55, d: 14.25, v: 3, p: true };
  assert.deepEqual(decoderEtat('#' + encoderEtat(e)), { t: 1234.5679, b: 'Kebet', s: 'kebet-quartiers', az: 0.6, el: 0.55, d: 14.25, v: 3, p: true });
  assert.deepEqual(decoderEtat('#t=abc&el=9&d=1e9&b=<script>&s=%E0%A4%A&p=2&x=1&=3'), {}, 'tout ce qui est illisible ou hors bornes est ignoré');
  assert.deepEqual(decoderEtat(''), {}); assert.equal(encoderEtat({ t: NaN }), '');
});

import { lire as lireCarnet, ecrire as ecrireCarnet, nouvelleScene, versMarkdown, slug, CLE, MAX } from '../app/src/ui/carnet.js';
test('carnet de scènes : stockage tolérant, export Markdown, noms de fichier sûrs', () => {
  const mem = new Map(), st = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  assert.deepEqual(lireCarnet(st), [], 'carnet vide');
  const s = nouvelleScene({ nom: 'Éclipse', hash: '#t=0.47&b=Kebet', lieu: 'Kebet', date: 'An 0', texte: 'ligne 1\n\nligne 2', vignette: 'data:image/jpeg;base64,AAAA' }, 1);
  assert.ok(ecrireCarnet(st, [s]) && lireCarnet(st).length === 1 && lireCarnet(st)[0].nom === 'Éclipse');
  assert.equal(nouvelleScene({ nom: 'x', hash: '#a', vignette: 'javascript:alert(1)' }).vignette, '', 'vignette qui n\'est pas une image : refusée');
  mem.set(CLE, '{pas du json'); assert.deepEqual(lireCarnet(st), [], 'contenu corrompu ignoré');
  mem.set(CLE, JSON.stringify([{ id: 1 }, s, { id: 's', nom: 'n', hash: 'sans-diese' }])); assert.equal(lireCarnet(st).length, 1, 'entrées mal formées écartées');
  assert.equal(ecrireCarnet({ setItem() { throw new Error('quota'); } }, [s]), false, 'stockage plein : false, sans exception');
  assert.equal(ecrireCarnet(st, Array.from({ length: MAX + 10 }, () => s)) && lireCarnet(st).length, MAX);
  const md = versMarkdown([s], 'https://x/'); assert.match(md, /## Éclipse/); assert.match(md, /Vue : https:\/\/x\/#t=0\.47&b=Kebet/); assert.match(md, />\s*ligne 1\n>\n> ligne 2/);
  assert.equal(slug('Cité-mine de Sethis — An −5 · jour 3'), 'cite-mine-de-sethis-an-5-jour-3');
});

import { fusionner, liaison } from '../app/src/ui/comparaison.js';
test('comparateur : fusion de deux rapports et liaison entre deux sites', () => {
  const A = [{ title: 'Environnement', rows: [['Gravité', '0,93 g'], ['Soleil', 'jour']] }], B = [{ title: 'Environnement', rows: [['Gravité', '0,99 g'], ['Soleil', 'jour'], ['Pression', '0,05 bar']] }, { title: 'Énergie', rows: [['Solaire', '1 kW']] }];
  const m = fusionner(A, B);
  assert.deepEqual(m.map((s) => s.titre), ['Environnement', 'Énergie']);
  assert.deepEqual(m[0].lignes, [['Gravité', '0,93 g', '0,99 g', true], ['Soleil', 'jour', 'jour', false], ['Pression', '—', '0,05 bar', true]]);
  assert.deepEqual(m[1].lignes, [['Solaire', '—', '1 kW', true]]);
  assert.deepEqual(fusionner(), []);
  const L = liaison([0, 0, 0], [1, 0, 0]); // 1 UA
  assert.ok(Math.abs(L.lumiereS - 499) < 1 && L.km > 1.49e8 && L.km < 1.50e8, `lumière ${L.lumiereS}`);
  assert.ok(L.volS > 0 && L.volS < 86400 * 6, `1 UA en hyperpropulsion : ${L.volS} s`);
});
