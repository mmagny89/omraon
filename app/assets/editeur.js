// Éditeur de valeurs par formulaires : construit un formulaire depuis le JSON d'une section (nombres, textes, cases, couleurs,
// listes d'éléments à ajouter, dupliquer, déplacer, supprimer) et le retransforme en JSON au moment d'enregistrer.
// Le serveur valide le JSON comme avant (DonneesService::valider) : ce script ne fait que fabriquer le texte. Sans JavaScript,
// le champ JSON reste utilisable tel quel.
(() => {
  const LIBELLES = {
    id: 'Identifiant', name: 'Nom', nom: 'Nom', titre: 'Titre', role: 'Rôle', resume: 'Résumé', texte: 'Texte', kind: 'Type',
    massEarth: 'Masse (M⊕)', massJup: 'Masse (M♃)', massMsun: 'Masse (M☉)', radiusKm: 'Rayon (km)', radiusRsun: 'Rayon (R☉)', density: 'Densité (kg/m³)',
    albedo: 'Albédo', color: 'Couleur', texture: 'Texture', teff: 'Température de surface (K)', ageGyr: 'Âge (Gyr)',
    orbit: 'Orbite', a: 'Demi-grand axe', e: 'Excentricité', i: 'Inclinaison (°)', Om: 'Nœud ascendant (°)', w: 'Périastre (°)', M: 'Anomalie moyenne (°)',
    rotation: 'Rotation', periodH: 'Période (h)', spinOrbitRatio: 'Rapport rotation/orbite', tiltDeg: 'Obliquité (°)', nodeDeg: 'Nœud de l\'axe (°)',
    habitat: 'Habitat', pressureBar: 'Pression (bar)', greenhouseK: 'Effet de serre (K)', internalHeat: 'Chaleur interne (× Teq)',
    atmosphere: 'Atmosphère', strength: 'Intensité', height: 'Épaisseur', moons: 'Lunes', names: 'Noms', tyt: 'Nom tyt', tytCourant: 'Courant', sens: 'Sens',
    fonction: 'Rôle dans le système', lien: 'Lien', erosion: 'Du tyt à l\'humain', explication: 'Explication',
    body: 'Astre', type: 'Type', lat: 'Latitude (°)', lon: 'Longitude (°)', altKm: 'Altitude (km)', incl: 'Inclinaison (°)', node: 'Nœud (°)', phase: 'Phase (°)',
    population: 'Humains', tyts: 'Tyts', fixe: 'Point de maintien', marche: 'Marché partagé avec', invented: 'Valeur de conception', land: 'Sur terre ferme',
    aMin: 'Rayon intérieur (UA)', aMax: 'Rayon extérieur (UA)', share: 'Part', gaps: 'Lacunes', hilda: 'Amas de Hilda', spread: 'Étalement',
    count: 'Nombre', qMin: 'Périhélie min (UA)', qMax: 'Périhélie max (UA)', QMin: 'Aphélie min (UA)', QMax: 'Aphélie max (UA)',
    espece: 'Espèce', age: 'Âge', vivant: 'Vivant', origine: 'Origine', corps: 'Astre', site: 'Site', statut: 'Statut', portrait: 'Portrait', fiche: 'Fiche',
    niveau: 'Niveau', source: 'Source', horsSysteme: 'Hors système', mot: 'Mot', cat: 'Thème', note: 'Note', label: 'Libellé', from: 'De', to: 'À', year: 'Année',
    canon: 'Canon', voir: 'Voir', entendre: 'Entendre', sentir: 'Sentir', toucher: 'Toucher', faussenote: 'La fausse note',
  };
  const genre = (v) => (v === null ? 'null' : Array.isArray(v) ? 'liste' : typeof v === 'object' ? 'objet' : typeof v);
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const libelle = (cle) => LIBELLES[cle] ?? cle;
  const titreDe = (el, i) => (el && typeof el === 'object' && !Array.isArray(el) ? (el.name ?? el.nom ?? el.titre ?? el.mot ?? el.label ?? el.id ?? `Élément ${i + 1}`) : `Élément ${i + 1}`);

  /** Valeur « vide » de même forme que le modèle (nombres à 0, textes vides, listes vides, objets reconstruits). */
  const squelette = (m) => {
    switch (genre(m)) {
      case 'number': return 0;
      case 'string': return '';
      case 'boolean': return false;
      case 'null': return null;
      case 'liste': return [];
      default: return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, squelette(v)]));
    }
  };

  // Exposé pour les tests (Node, sans DOM).
  globalThis.EditeurJson = { squelette, genre, titreDe, libelle };
  if (typeof document === 'undefined') return;

  const CLS = {
    champ: 'min-h-11 w-full rounded-lg border border-ligne bg-fond px-3 text-texte placeholder:text-doux focus:border-accent',
    bouton: 'inline-flex min-h-11 items-center justify-center rounded-lg border border-ligne px-3 text-sm hover:border-accent hover:text-accent',
    danger: 'inline-flex min-h-11 items-center justify-center rounded-lg border border-danger/50 px-3 text-sm text-danger hover:bg-danger/10',
    carte: 'rounded-lg border border-ligne bg-fond/40',
  };
  let compteur = 0;
  const el = (tag, classe = '', attrs = {}, texte = null) => {
    const e = document.createElement(tag);
    if (classe) e.className = classe;
    Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    if (texte !== null) e.textContent = texte;
    return e;
  };
  const bouton = (texte, classe, onClick, aria = null) => {
    const b = el('button', classe, { type: 'button', ...(aria ? { 'aria-label': aria } : {}) }, texte);
    b.addEventListener('click', onClick);
    return b;
  };

  /** Construit le contrôle d'une valeur : renvoie { noeud, lire } où lire() redonne la valeur JSON. */
  function construire(valeur, cle = null) {
    const id = `ed-${++compteur}`;
    switch (genre(valeur)) {
      case 'number': {
        const i = el('input', CLS.champ, { id, type: 'number', step: 'any', inputmode: 'decimal', value: String(valeur) });
        return { noeud: i, lire: () => (i.value === '' ? 0 : Number(i.value)), id };
      }
      case 'boolean': {
        const i = el('input', 'size-5 accent-accent', { id, type: 'checkbox' });
        i.checked = valeur;
        return { noeud: i, lire: () => i.checked, id, ligne: true };
      }
      case 'null': {
        const i = el('input', CLS.champ, { id, type: 'text', placeholder: '(vide)' });
        return { noeud: i, lire: () => (i.value === '' ? null : i.value), id };
      }
      case 'string': {
        if (/^#[0-9a-fA-F]{6}$/.test(valeur)) {
          const i = el('input', 'h-11 w-20 rounded-lg border border-ligne bg-fond p-1', { id, type: 'color', value: valeur.toLowerCase() });
          return { noeud: i, lire: () => i.value, id };
        }
        const long = valeur.length > 70 || valeur.includes('\n');
        const i = long ? el('textarea', `${CLS.champ} py-2 leading-relaxed`, { id, rows: String(Math.min(8, Math.ceil(valeur.length / 70) + 1)) }) : el('input', CLS.champ, { id, type: 'text' });
        i.value = valeur;
        return { noeud: i, lire: () => i.value, id };
      }
      case 'liste': return liste(valeur, cle, id);
      default: return objet(valeur, id);
    }
  }

  function objet(valeur, id) {
    const racine = el('div', 'grid gap-3');
    const lecteurs = [];
    Object.entries(valeur).forEach(([k, v]) => {
      const c = construire(v, k);
      const composite = ['objet', 'liste'].includes(genre(v));
      const ligne = el('div', composite ? 'space-y-1.5' : (c.ligne ? 'flex min-h-11 items-center gap-3' : 'grid gap-1.5 sm:grid-cols-[minmax(10rem,16rem)_1fr] sm:items-center'));
      const lib = el('label', 'text-sm font-medium text-doux', { for: c.id, title: k }, libelle(k));
      if (composite) {
        const d = el('details', `${CLS.carte} p-3`, { open: '' });
        const s = el('summary', 'flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-accent');
        s.append(el('span', '', {}, libelle(k)), el('code', 'text-xs font-normal text-doux', {}, k));
        d.append(s, c.noeud);
        ligne.append(d);
      } else if (c.ligne) { ligne.append(c.noeud, lib); } else { ligne.append(lib, c.noeud); }
      racine.append(ligne);
      lecteurs.push([k, c.lire]);
    });
    return { noeud: racine, lire: () => Object.fromEntries(lecteurs.map(([k, l]) => [k, l()])), id };
  }

  function liste(valeur, cle, id) {
    const racine = el('div', 'space-y-2');
    const corps = el('div', 'space-y-2');
    const modele = valeur.length ? valeur.at(-1) : 0;
    const items = []; // { ligne, lire }
    const complexe = valeur.some((v) => ['objet', 'liste'].includes(genre(v))) || ['objet', 'liste'].includes(genre(modele));

    const rafraichir = () => items.forEach((it, i) => {
      if (it.titre) it.titre.textContent = it.titreDe(i);
      it.haut.disabled = i === 0; it.bas.disabled = i === items.length - 1;
    });
    function ajouter(v, position = null) {
      const c = construire(v);
      const barre = el('div', 'flex flex-wrap gap-2');
      const haut = bouton('↑', CLS.bouton, () => deplacer(it, -1), 'Monter');
      const bas = bouton('↓', CLS.bouton, () => deplacer(it, 1), 'Descendre');
      const dup = bouton('Dupliquer', CLS.bouton, () => ajouter(clone(it.lire()), items.indexOf(it) + 1));
      const sup = bouton('Supprimer', CLS.danger, () => { items.splice(items.indexOf(it), 1); it.ligne.remove(); rafraichir(); }, 'Supprimer cet élément');
      let ligne; let titre = null;
      if (complexe) {
        ligne = el('details', CLS.carte);
        const s = el('summary', 'flex min-h-11 cursor-pointer items-center gap-2 px-3 text-sm font-semibold');
        titre = el('span');
        s.append(titre);
        const dedans = el('div', 'space-y-3 p-3 pt-0');
        barre.append(haut, bas, dup, sup);
        dedans.append(barre, c.noeud);
        ligne.append(s, dedans);
      } else {
        ligne = el('div', 'flex items-center gap-2');
        c.noeud.classList.add('flex-1');
        barre.className = 'flex gap-2';
        barre.append(haut, bas, sup);
        ligne.append(c.noeud, barre);
      }
      const it = { ligne, lire: c.lire, titre, haut, bas, titreDe: (i) => titreDe(it.lire(), i) };
      if (position === null || position >= items.length) { items.push(it); corps.append(ligne); } else { items.splice(position, 0, it); corps.insertBefore(ligne, items[position + 1].ligne); }
      rafraichir();
      if (position !== null) (ligne.querySelector('input,textarea') ?? ligne).focus?.();
    }
    function deplacer(it, sens) {
      const i = items.indexOf(it), j = i + sens;
      if (j < 0 || j >= items.length) return;
      items.splice(i, 1); items.splice(j, 0, it);
      corps.insertBefore(it.ligne, sens < 0 ? items[j + 1].ligne : items[j - 1].ligne.nextSibling);
      rafraichir();
    }
    valeur.forEach((v) => ajouter(v));
    racine.append(corps, bouton('+ Ajouter', CLS.bouton, () => ajouter(squelette(valeur.length || items.length ? modele : 0)), 'Ajouter un élément'));
    return { noeud: racine, lire: () => items.map((it) => it.lire()), id };
  }

  // ---- Branchement sur la page d'édition ----
  const zone = document.querySelector('[data-editeur]');
  if (!zone) return;
  const texte = zone.querySelector('textarea');
  const formulaire = zone.closest('form');
  const hote = el('div', 'space-y-3');
  const erreur = el('p', 'hidden rounded-lg border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-danger', { role: 'alert' });
  const bascule = bouton('Éditer en JSON', CLS.bouton, () => (mode === 'form' ? versJson() : versFormulaire()));
  let mode = 'form'; let lire = null;

  function versFormulaire() {
    let valeur;
    try { valeur = JSON.parse(texte.value); } catch (e) { erreur.textContent = `JSON invalide : ${e.message}`; erreur.classList.remove('hidden'); return false; }
    erreur.classList.add('hidden');
    compteur = 0; hote.replaceChildren();
    const c = construire(valeur); hote.append(c.noeud); lire = c.lire;
    texte.closest('[data-json]').hidden = true; hote.hidden = false; bascule.textContent = 'Éditer en JSON'; mode = 'form';
    return true;
  }
  function versJson() {
    texte.value = JSON.stringify(lire(), null, 2);
    texte.closest('[data-json]').hidden = false; hote.hidden = true; bascule.textContent = 'Revenir au formulaire'; mode = 'json';
  }
  zone.insertBefore(bascule, zone.firstChild);
  zone.insertBefore(erreur, bascule.nextSibling);
  zone.insertBefore(hote, erreur.nextSibling);
  versFormulaire();
  formulaire.addEventListener('submit', (e) => {
    if (mode === 'form') texte.value = JSON.stringify(lire());
    else { try { JSON.parse(texte.value); } catch (x) { e.preventDefault(); erreur.textContent = `JSON invalide : ${x.message}`; erreur.classList.remove('hidden'); } }
  });
})();
