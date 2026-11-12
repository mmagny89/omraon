import { STAR, PLANETS } from './data/omraon.js';
import { buildSystem } from './physics/system.js';
import { Simulation } from './physics/simulation.js';
import { habitableZone, starLuminosity } from './physics/derived.js';
import { World } from './render/world.js';
import { UI } from './ui/ui.js';
import { SITES } from './data/sites.js';
import { decoderEtat } from './ui/lien.js';
import { calibrerJour } from './physics/calendrier.js';
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

const msg = document.getElementById('loader-msg'), bar = document.getElementById('loader-bar'), loader = document.getElementById('loader');
const $ = (id) => document.getElementById(id);
// Astuces du chargement : une au hasard
const ASTUCES = [
  'Touches : H masque l\'interface, P photographie la vue, Espace lance ou met en pause.',
  'Le jour de Kebet (24 h de Kebet, environ 1,28 jour Terre) est l\'unité de temps affichée.',
  'Sur la frise du haut, cliquez ou glissez pour voyager dans le temps (An 0 = début de l\'Ère confédérale, présent = An 300).',
  'Le bouton Visite présente le système en neuf étapes, de l\'étoile à la chronologie.',
  'Le bouton Lien copie l\'adresse exacte de votre vue : date, lieu, caméra.',
];
document.getElementById('loader-tip').textContent = ASTUCES[Math.floor(Math.random() * ASTUCES.length)];
const progression = (m, p) => { msg.textContent = m; if (p != null) bar.value = Math.round(Math.min(1, p) * 92); };
// Échec (WebGL absent, module en erreur) : on le dit au lieu de laisser tourner le chargement
window.addEventListener('error', () => { if (!loader.classList.contains('done')) { loader.classList.add('failed'); msg.textContent = 'Impossible de démarrer la simulation.'; bar.removeAttribute('value'); } });
window.addEventListener('unhandledrejection', () => { if (!loader.classList.contains('done')) { loader.classList.add('failed'); msg.textContent = 'Impossible de démarrer la simulation.'; } });
const newSim = () => {
  const s = new Simulation(buildSystem(STAR, PLANETS), { particleCount: +$('n-ast').value, trojans: $('t-trojans').checked });
  s.gr = $('t-gr').checked;
  return s;
};
const sim = newSim();
calibrerJour(sim); // le jour de Kebet fait référence pour les jours et les heures affichés
const world = new World($('view'), sim, $('labels'));
await world.build(progression);
progression('Mise en place de l\'interface…', 1);
sim.computeRender(0);
world.setSites(SITES, (id) => ui.selectSite(id));
const ui = new UI(sim, world);
ui.view('inner');
world.rig.logD = world.rig.logTarget; // pas d'animation au démarrage
{ const e = decoderEtat(location.hash); if (Object.keys(e).length) ui.restoreState(e); } // vue partagée par adresse

const rebuild = () => {
  const s = newSim();
  ui.cancelVoyage(); world.rebind(s); ui.sim = s; ui.target = 0; ui.hz = habitableZone(STAR); ui.L = starLuminosity(STAR);
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
bar.value = 100;
$('loader').classList.add('done');
window.__omraon = { sim, world, ui };
