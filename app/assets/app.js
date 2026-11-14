// Pages Symfony : filtre de liste en direct (recherche sans accents ni casse), sans dépendance.
//   <input type="search" data-filtre="#liste">  +  éléments `[data-filtrable]` dans #liste
//   <select data-filtre-attr="data-corps" data-filtre="#liste">  filtre sur un attribut des éléments
//   <p data-filtre-compte="#liste" aria-live="polite">  annonce le nombre de résultats
const norme = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

document.querySelectorAll('[data-filtre]').forEach((champ) => {
  const liste = document.querySelector(champ.dataset.filtre);
  if (!liste) return;
  const entrees = [...liste.querySelectorAll('[data-filtrable]')];
  const textes = entrees.map((e) => norme(e.textContent));
  const compte = document.querySelector(`[data-filtre-compte="${champ.dataset.filtre}"]`);
  const controles = [...document.querySelectorAll(`[data-filtre="${champ.dataset.filtre}"]`)];
  const appliquer = () => {
    let visibles = 0;
    entrees.forEach((e, i) => {
      const ok = controles.every((c) => (c.dataset.filtreAttr ? !c.value || e.getAttribute(c.dataset.filtreAttr) === c.value : textes[i].includes(norme(c.value.trim()))));
      e.hidden = !ok;
      if (ok) visibles += 1;
    });
    liste.querySelectorAll('[data-groupe]').forEach((g) => { g.hidden = !g.querySelector('[data-filtrable]:not([hidden])'); });
    if (compte) compte.textContent = visibles === entrees.length ? `${visibles} entrées` : `${visibles} sur ${entrees.length}`;
  };
  champ.addEventListener('input', appliquer);
  champ.addEventListener('change', appliquer);
});
