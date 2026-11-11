import { STAR, PLANETS } from './data/omraon.js';
import { buildSystem } from './physics/system.js';
import { Simulation } from './physics/simulation.js';
import { habitableZone, starLuminosity } from './physics/derived.js';
import { World } from './render/world.js';
import { UI } from './ui/ui.js';
import { SITES } from './data/sites.js';
import { kebetIsLand } from './render/textures.js';

// Les sites marqués « land » sont ramenés sur le continent le plus proche (la texture est procédurale).
for (const site of SITES.filter((x) => x.land)) {
  const idx = buildSystem(STAR, PLANETS).bodies.find((b) => b.def.name === site.body).idx, seed = 11 + idx * 7;
  let best = null;
  for (let r = 0; r <= 60 && !best; r += 3) for (let a = 0; a < 360 && !best; a += 20) {
    const lat = Math.max(-80, Math.min(80, site.lat + r * Math.sin(a * Math.PI / 180))), lon = site.lon + r * Math.cos(a * Math.PI / 180);
    if (kebetIsLand(seed, lat, lon)) best = { lat, lon };
  }
  if (best) Object.assign(site, best);
}

const msg = document.getElementById('loader-msg');
const $ = (id) => document.getElementById(id);
const newSim = () => {
  const s = new Simulation(buildSystem(STAR, PLANETS), { particleCount: +$('n-ast').value, trojans: $('t-trojans').checked });
  s.gr = $('t-gr').checked;
  return s;
};
const sim = newSim();
const world = new World($('view'), sim, $('labels'));
await world.build((m) => (msg.textContent = m));
sim.computeRender(0);
world.setSites(SITES, (id) => ui.selectSite(id));
const ui = new UI(sim, world);
ui.view('inner');
world.rig.logD = world.rig.logTarget; // pas d'animation au démarrage

const rebuild = () => {
  const s = newSim();
  world.rebind(s); ui.sim = s; ui.target = 0; ui.hz = habitableZone(STAR); ui.L = starLuminosity(STAR);
  s.computeRender(0);
  window.__omraon.sim = s;
};
ui.onReset = rebuild;

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  const t = ui.update(dt);
  world.frame(t, dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
$('loader').classList.add('done');
window.__omraon = { sim, world, ui };
