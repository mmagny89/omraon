// Traducteur tyt ⇄ français, mot à mot. Logique pure, sans DOM : testable sous Node.
// Il ne traduit que ce que le glossaire (canon) contient : aucun mot, aucune conjugaison ni règle d'ordre n'est inventé.
// Morphologie admise (canon, doc 02) : composés à trait d'union, suffixes -an (pluriel/collectif) et -ku (agent).
// Un mot inconnu reste visible entre crochets plutôt que deviné.

const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’`]/g, "'");
const ARTICLES = new Set(['le', 'la', 'les', 'l', 'un', 'une', 'des', 'de', 'du', 'd', 'au', 'aux']);
const VIDES = new Set(['et', 'qui', 'que', 'est', 'ce', 'celui', 'celle', 'avec', 'son', 'ses', 'mon', 'ton', 'sur', 'par', 'pour', 'dans', 'est']);
const MOT = /[\p{L}'’]+(?:-[\p{L}'’]+)*/gu, MOT_FR = /\p{L}+/gu;
const PLUS = { an: 'pluriel', ku: 'agent' }; // sens court des suffixes canon

/** Gloss court d'une entrée : sa première proposition, sans guillemets ni parenthèses. */
export function glose(e) {
  const q = e.sens.match(/^« ([^»]+) »(?:$|\s|,)/), c = q ? q[1] : e.sens.split(/ \(|\s—|\s;|\s:/)[0].replace(/[«»]/g, '').trim();
  return c.length > 70 ? c.slice(0, 67).trimEnd() + '…' : c;
}

const radical = (m) => { const s = norm(m); return s.length > 3 ? s.replace(/[sx]$/, '') : s; };
const mots = (s) => norm(s).split(/[^\p{L}]+/u).filter(Boolean);

/** Construit les deux index depuis la liste du glossaire (lexique + noms des mondes + mois). */
export function indexer(liste) {
  const tyt = new Map(), fr = new Map(), suffixes = new Map();
  const ajoute = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
  for (const e of liste) {
    if (e.mot.startsWith('-')) { suffixes.set(norm(e.mot.slice(1)), e); continue; }
    if (/\s/.test(e.mot)) continue; // « Nom – Sum – Kaha » : une structure, pas un mot
    ajoute(tyt, norm(e.mot), e);
    for (const alias of (e.note || '').matchAll(/courant\s*:?\s*([\p{L}'’-]+)/gu)) ajoute(tyt, norm(alias[1]), e);
    if (e.cat === 'Calendrier confédéral') continue; // noms de mois : leur sens est une explication, pas un mot français
    const clause = e.sens.split(/ \(|\s—|\s;|\s:/)[0].replace(/[«»]/g, '');
    for (const p of clause.split(/,| ou /)) {
      const ws = mots(p).filter((w) => !ARTICLES.has(w));
      if (!ws.length) continue;
      ajoute(fr, ws.map(radical).join(' '), { e, poids: 3 });
      if (ws.length > 1) for (const w of ws) if (w.length > 3 && !VIDES.has(w)) ajoute(fr, radical(w), { e, poids: 1 });
    }
  }
  return { tyt, fr, suffixes };
}

/** Cherche un mot tyt : exact, alias courant, suffixe -an / -ku sur radical connu, puis composé à trait d'union. */
function chercherTyt(token, idx) {
  const k = norm(token);
  if (idx.tyt.has(k)) return { entree: idx.tyt.get(k)[0] };
  for (const [suf, es] of idx.suffixes) {
    if (k.length > suf.length + 1 && k.endsWith(suf) && idx.tyt.has(k.slice(0, -suf.length))) return { entree: idx.tyt.get(k.slice(0, -suf.length))[0], suffixe: es };
  }
  if (k.includes('-')) {
    const parts = k.split('-').map((p) => chercherTyt(p, idx));
    if (parts.every((p) => p.entree)) return { parts };
  }
  return {};
}

const texteTyt = (r) => {
  if (r.parts) return r.parts.map((p) => texteTyt(p)).join(' + ');
  if (!r.entree) return null;
  const g = glose(r.entree);
  return r.suffixe ? `${g} (${r.suffixe.mot} : ${glose(r.suffixe)})` : g;
};
const courtTyt = (r, s) => {
  if (r.parts) return r.parts.map((p) => courtTyt(p, p.entree ? glose(p.entree) : '')).join('-');
  return r.suffixe ? `${glose(r.entree)} (${PLUS[norm(r.suffixe.mot.slice(1))] || r.suffixe.mot})` : s;
};

/** Tyt → français : une ligne par mot ; `trouve` faux si le mot est absent du glossaire. */
export function versFrancais(texte, idx) {
  const lignes = [...String(texte).matchAll(MOT)].map(([mot]) => {
    const r = chercherTyt(mot, idx), g = texteTyt(r);
    return { src: mot, sens: g, court: g === null ? null : courtTyt(r, g), trouve: g !== null };
  });
  return { lignes, resultat: lignes.map((l) => (l.trouve ? l.court : `[${l.src}]`)).join(' ') };
}

/** Français → tyt : mot à mot, groupes de trois mots au plus (« mon amour » → sunazu). `alt` : autres candidats. */
export function versTyt(texte, idx) {
  const w = [...String(texte).matchAll(MOT_FR)].map(([m]) => m);
  const lignes = [];
  for (let i = 0; i < w.length;) {
    if (ARTICLES.has(norm(w[i]))) { i++; continue; }
    let trouve = null;
    for (let n = Math.min(3, w.length - i); n >= 1 && !trouve; n--) {
      const cle = w.slice(i, i + n).map((x) => radical(x)).join(' ');
      const c = idx.fr.get(cle);
      if (c) trouve = { n, cands: c };
    }
    if (!trouve) { lignes.push({ src: w[i], tyt: null, alt: [] }); i++; continue; }
    const uniques = [...new Map(trouve.cands.sort((a, b) => b.poids - a.poids).map((c) => [c.e.mot, c.e])).values()];
    lignes.push({ src: w.slice(i, i + trouve.n).join(' '), tyt: uniques[0].mot, sens: glose(uniques[0]), alt: uniques.slice(1, 4).map((e) => e.mot) });
    i += trouve.n;
  }
  return { lignes, resultat: lignes.map((l) => (l.tyt ? l.tyt : `[${l.src}]`)).join(' ') };
}
