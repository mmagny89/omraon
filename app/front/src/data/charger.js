// Chargeur des jeux de données (système, sites, économie). Les valeurs ne sont plus dans le code :
//  - navigateur : GET /api/donnees/<jeu>, réservé aux comptes connectés (valeurs par défaut du canon,
//    éventuellement modifiées par un admin) ;
//  - Node (tests) : le canon d'origine, app/donnees/canon/<jeu>.json.
// Un module de données fait `const d = await charger('jeu')` (await de niveau module), puis ré-exporte
// ses constantes : les importeurs n'ont rien à changer.
const NAVIGATEUR = typeof window !== 'undefined' && typeof document !== 'undefined';

export async function charger(jeu) {
  if (NAVIGATEUR) {
    const r = await fetch(`/api/donnees/${jeu}`, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    if (r.status === 401 || r.status === 403 || r.redirected) { location.assign('/connexion'); await new Promise(() => {}); }
    if (!r.ok) throw new Error(`Données « ${jeu} » indisponibles (${r.status})`);
    return r.json();
  }
  const { readFile } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  const chemin = fileURLToPath(new URL(`../../../donnees/canon/${jeu}.json`, import.meta.url));
  return JSON.parse(await readFile(chemin, 'utf8'));
}
