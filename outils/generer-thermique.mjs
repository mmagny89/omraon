// Régénère app/tests/fixtures/thermique.json : les températures de chaque astre du canon, calculées par physics/thermique.js.
// Le test PHP compare Thermique.php à ce fichier, le test Node compare thermique.js : un écart entre les deux modèles fait échouer l'un des deux.
// À relancer (node outils/generer-thermique.mjs) quand le canon des astres ou le modèle thermique change.
import fs from 'node:fs';
import { STAR, PLANETS } from '../app/front/src/data/omraon.js';
import { buildSystem } from '../app/front/src/physics/system.js';
import { Simulation } from '../app/front/src/physics/simulation.js';
import { stateToElements } from '../app/front/src/physics/kepler.js';
import { G } from '../app/front/src/physics/constants.js';
import { facesCorps } from '../app/front/src/physics/thermique.js';

export function calculer() {
  const sim = new Simulation(buildSystem(STAR, PLANETS), { particleCount: 300 }); sim.autoTier = false; sim.computeRender(0);
  const el = (i) => {
    const b = sim.bodies[i]; if (b.type === 'star') return null; const p = b.parent;
    const r = [0, 1, 2].map((c) => sim.pos[3 * i + c] - sim.pos[3 * p + c]), v = [0, 1, 2].map((c) => sim.vel[3 * i + c] - sim.vel[3 * p + c]);
    return stateToElements(G * ((p === 0 ? sim.mass[0] : sim.mass[p]) + sim.mass[i]), r, v);
  };
  const out = {};
  for (const b of sim.bodies) { const t = facesCorps(sim, el, b.idx); out[b.def.id] = { mode: t.mode, jour: +t.jour.toFixed(2), nuit: +t.nuit.toFixed(2), moyenne: +t.moyenne.toFixed(2) }; }
  return out;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const f = new URL('../app/tests/fixtures/thermique.json', import.meta.url);
  fs.writeFileSync(f, JSON.stringify(calculer(), null, 2) + '\n'); console.log('écrit', f.pathname);
}
