// Comparateur de lieux : fusion de deux rapports de site (sections de lignes [libellé, valeur]) et liaison entre les deux sites.
// Logique pure, sans DOM : testable sous Node.
import { AU_KM } from '../physics/constants.js';
import { planFlight } from '../physics/flight.js';

const C_MS = 299792458;

/**
 * Fusionne deux listes de sections [{ title, rows: [[libellé, valeur]] }] en [{ titre, lignes: [[libellé, a, b, differe]] }].
 * Une ligne absente d'un côté vaut « — ». Les sections et lignes gardent l'ordre de A, puis ce que seul B apporte.
 */
export function fusionner(sa = [], sb = []) {
  const out = [], index = new Map();
  const ajouter = (sections, cote) => {
    for (const sec of sections) {
      let s = index.get(sec.title);
      if (!s) { s = { titre: sec.title, lignes: [], pos: new Map() }; index.set(sec.title, s); out.push(s); }
      for (const [k, v] of sec.rows) {
        let l = s.pos.get(k);
        if (!l) { l = [k, '—', '—', false]; s.pos.set(k, l); s.lignes.push(l); }
        l[1 + cote] = String(v);
      }
    }
  };
  ajouter(sa, 0); ajouter(sb, 1);
  for (const s of out) { for (const l of s.lignes) l[3] = l[1] !== l[2]; delete s.pos; }
  return out;
}

/** Liaison entre deux positions (UA) : distance, délai de message à la lumière, trajet en hyperpropulsion (accélération aG, 0,95 c). */
export function liaison(posA, posB, aG = 8) {
  const km = Math.hypot(posA[0] - posB[0], posA[1] - posB[1], posA[2] - posB[2]) * AU_KM;
  return { km, lumiereS: (km * 1000) / C_MS, volS: planFlight(Math.max(km * 1000, 1000), aG, 0.95).total };
}
