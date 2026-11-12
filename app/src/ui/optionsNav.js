// Navigation du panneau Options : un rail d'icônes à gauche (en bandeau sur téléphone), une seule section visible à la fois.
// Les sections restent les <details> existants (mêmes identifiants, mêmes branchements) : on les garde ouverts et on masque les autres.
export const SECTIONS = [
  ['lore', '📖', 'Lore'], ['pop', '👥', 'Population'], ['reseau', '📡', 'Réseau'], ['ephem', '🔭', 'Éphémérides'],
  ['compare', '⚖', 'Comparer'], ['carnet', '📷', 'Carnet'], ['settings', '⚙', 'Réglages'], ['apropos', 'ℹ', 'À propos'],
];
const CLE = 'omraon.options.onglet';
const lire = () => { try { return localStorage.getItem(CLE); } catch { return null; } };
const ecrire = (v) => { try { localStorage.setItem(CLE, v); } catch { /* stockage indisponible : l'onglet ne sera pas mémorisé */ } };

/** Construit le rail et branche l'affichage ; envoie `options:tab` (detail = id) à chaque changement de section. */
export function initOptionsNav(root) {
  const panneaux = SECTIONS.filter(([id]) => root.querySelector(`#${id}`));
  const rail = document.createElement('nav');
  rail.id = 'options-rail'; rail.setAttribute('role', 'tablist'); rail.setAttribute('aria-orientation', 'vertical'); rail.setAttribute('aria-label', 'Sections des options');
  rail.innerHTML = panneaux.map(([id, icone, nom]) => `<button type="button" role="tab" id="ot-${id}" aria-controls="${id}" aria-selected="false" tabindex="-1"><span aria-hidden="true">${icone}</span><b>${nom}</b></button>`).join('');
  (root.querySelector('#quick') || root.querySelector('h2')).after(rail);
  for (const [id] of panneaux) {
    const d = root.querySelector(`#${id}`); d.open = true; d.setAttribute('role', 'tabpanel'); d.setAttribute('aria-labelledby', `ot-${id}`);
    const s = d.querySelector(':scope > summary'); if (s) { s.tabIndex = -1; s.addEventListener('click', (e) => e.preventDefault()); }
  }
  const choisir = (id, focus = false) => {
    for (const [p] of panneaux) {
      const actif = p === id, b = rail.querySelector(`#ot-${p}`);
      root.querySelector(`#${p}`).hidden = !actif; b.setAttribute('aria-selected', actif); b.tabIndex = actif ? 0 : -1;
      if (actif && focus) b.focus();
    }
    ecrire(id); root.dispatchEvent(new CustomEvent('options:tab', { detail: id }));
  };
  rail.addEventListener('click', (e) => { const b = e.target.closest('[role=tab]'); if (b) choisir(b.id.slice(3)); });
  rail.addEventListener('keydown', (e) => {
    const i = panneaux.findIndex(([p]) => rail.querySelector(`#ot-${p}`).getAttribute('aria-selected') === 'true'), n = panneaux.length;
    const k = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (k) { e.preventDefault(); choisir(panneaux[(i + k + n) % n][0], true); } else if (e.key === 'Home') { e.preventDefault(); choisir(panneaux[0][0], true); } else if (e.key === 'End') { e.preventDefault(); choisir(panneaux[n - 1][0], true); }
  });
  const memo = lire();
  choisir(panneaux.some(([id]) => id === memo) ? memo : panneaux[0][0]);
  return { choisir };
}
