// Carnet de scènes : signets de vues (adresse #…, lieu, date, vignette, texte de la fiche de scène) rangés dans localStorage,
// et export Markdown. Logique pure, sans DOM : le stockage est passé en paramètre (testable sous Node).

export const CLE = 'omraon:carnet:v1';
export const MAX = 40;
const valide = (s) => s && typeof s.id === 'string' && typeof s.nom === 'string' && typeof s.hash === 'string' && s.hash.startsWith('#');

/** Lit la liste ; tout ce qui est illisible ou mal formé est ignoré (le carnet n'est jamais bloquant). */
export function lire(storage) {
  try { const v = JSON.parse(storage.getItem(CLE) || '[]'); return Array.isArray(v) ? v.filter(valide).slice(0, MAX) : []; } catch { return []; }
}

/** Écrit la liste ; retourne false si le stockage est plein ou indisponible. */
export function ecrire(storage, liste) {
  try { storage.setItem(CLE, JSON.stringify(liste.slice(0, MAX))); return true; } catch { return false; }
}

/** Nouvelle entrée : champs de texte bornés, vignette (data URL d'image) acceptée seulement si elle en est une. */
export function nouvelleScene({ nom, hash, lieu = '', date = '', texte = '', vignette = '' }, maintenant = Date.now()) {
  return {
    id: `s${maintenant.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    nom: String(nom || lieu || 'Scène').slice(0, 80), hash, lieu: String(lieu).slice(0, 80), date: String(date).slice(0, 80),
    texte: String(texte).slice(0, 4000), vignette: /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(vignette) && vignette.length < 60000 ? vignette : '', creee: maintenant,
  };
}

/** Export Markdown du carnet. `base` : adresse de la page sans fragment (le lien d'une scène = base + hash). */
export function versMarkdown(scenes, base) {
  const out = ['# Carnet de scènes — système d\'Omraon', '', `${scenes.length} scène(s). Les liens rouvrent la même vue (date, lieu, caméra) dans l'application.`, ''];
  for (const s of scenes) {
    out.push(`## ${s.nom}`, '');
    if (s.lieu) out.push(`- Lieu : ${s.lieu}`);
    if (s.date) out.push(`- Date : ${s.date}`);
    out.push(`- Vue : ${base}${s.hash}`, '');
    if (s.texte) out.push('### Fiche de scène', '', ...s.texte.split('\n').map((l) => (l.trim() ? `> ${l}` : '>')), '');
  }
  out.push('---', '© 2026 Magny. Tous droits réservés.', '');
  return out.join('\n');
}

/** Nom de fichier sûr (ASCII, tirets) à partir d'un libellé. */
export const slug = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'omraon';
