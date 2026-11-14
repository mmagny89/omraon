// Infobulles graphiques : un seul élément flottant, alimenté par les attributs data-tip (HTML échappé) des éléments survolés,
// focalisés ou touchés. Les constructeurs (tipTexte, tipJauge, tipRepartition) rendent le contenu ; aucune logique métier ici.

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fr = (n) => n.toLocaleString('fr-FR');

/** Attribut prêt à poser sur un élément : data-tip + focalisable au clavier. */
export const tipAttr = (html) => ` data-tip="${esc(html)}" tabindex="0"`;

/** Infobulle de texte : titre facultatif et ligne(s) de détail. */
export const tipTexte = (titre, detail = '') => `<div class="tp"><div class="tp-h">${titre}</div>${detail ? `<div class="tp-n">${detail}</div>` : ''}</div>`;

/**
 * Jauge horizontale : valeur courante sur une échelle linéaire ou logarithmique, repères nommés et bandes colorées.
 * opts : { titre, texte, v, min, max, log, marques: [{ v, label }], bandes: [{ de, a, cls, label }], note }
 */
export function tipJauge({ titre, texte, v, min, max, log = false, marques = [], bandes = [], note = '' }) {
  const f = (x) => Math.max(0, Math.min(1, log ? (Math.log10(x) - Math.log10(min)) / (Math.log10(max) - Math.log10(min)) : (x - min) / (max - min))) * 100;
  const b = bandes.map((x) => `<span class="band ${x.cls || ''}" style="left:${f(x.de)}%;width:${f(x.a) - f(x.de)}%"></span>`).join('');
  const m = marques.map((x) => `<span class="mk" style="left:${f(x.v)}%"><i></i><em>${x.label}</em></span>`).join('');
  const legende = bandes.filter((x) => x.label).map((x) => `<span class="lg ${x.cls || ''}">${x.label}</span>`).join('');
  return `<div class="tp"><div class="tp-h">${titre}</div><div class="tp-v">${texte}</div>`
    + `<div class="gauge"><div class="track">${b}<span class="cur" style="left:${f(v)}%"></span></div><div class="marks">${m}</div></div>`
    + `${legende ? `<div class="tp-lg">${legende}</div>` : ''}${note ? `<div class="tp-n">${note}</div>` : ''}</div>`;
}

/** Barre de répartition (ex. humains / Tyts) avec légende chiffrée et part du total. */
export function tipRepartition({ titre, parts, note = '' }) {
  const tot = parts.reduce((t, p) => t + p.n, 0) || 1;
  const bar = parts.filter((p) => p.n > 0).map((p) => `<i class="${p.cls}" style="width:${(p.n / tot) * 100}%"></i>`).join('');
  const rows = parts.map((p) => `<div class="rp"><span class="sw ${p.cls}"></span><span>${p.label}</span><b>${fr(p.n)}</b><small>${tot ? Math.round((p.n / tot) * 100) : 0} %</small>${p.partTotale != null ? `<small class="pt">${p.partTotale < 0.1 ? p.partTotale.toFixed(1) : Math.round(p.partTotale)} % du système</small>` : ''}</div>`).join('');
  return `<div class="tp"><div class="tp-h">${titre}</div><div class="split">${bar}</div>${rows}${note ? `<div class="tp-n">${note}</div>` : ''}</div>`;
}

/** Branche l'élément flottant sur le document (à appeler une fois). */
export function initTooltips() {
  const tip = document.createElement('div');
  tip.id = 'tip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true;
  document.body.appendChild(tip);
  let cur = null;
  const place = (el) => {
    const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight, m = 8;
    let x = r.left + r.width / 2 - w / 2, y = r.top - h - m;
    if (y < m) y = r.bottom + m; // pas la place au-dessus : en dessous
    x = Math.max(m, Math.min(innerWidth - w - m, x)); y = Math.max(m, Math.min(innerHeight - h - m, y));
    tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  };
  const show = (el) => {
    if (cur === el) return;
    cur = el; tip.innerHTML = el.dataset.tip; tip.hidden = false; place(el);
    el.setAttribute('aria-describedby', 'tip');
  };
  const hide = () => { if (cur) cur.removeAttribute('aria-describedby'); cur = null; tip.hidden = true; };
  const target = (e) => e.target.closest?.('[data-tip]');
  document.addEventListener('pointerover', (e) => { if (e.pointerType === 'mouse') { const t = target(e); if (t) show(t); } });
  document.addEventListener('pointerout', (e) => { if (e.pointerType === 'mouse' && target(e) && !e.relatedTarget?.closest?.('[data-tip]')) hide(); });
  document.addEventListener('focusin', (e) => { const t = target(e); if (t) show(t); });
  document.addEventListener('focusout', hide);
  document.addEventListener('pointerdown', (e) => { // tactile : un appui affiche, un appui ailleurs masque
    if (e.pointerType === 'mouse') return;
    const t = target(e); if (t) show(t); else hide();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
  document.addEventListener('scroll', hide, true);
  // l'élément survolé peut disparaître lors d'un rafraîchissement de la fiche
  // la fiche se rafraîchit plusieurs fois par seconde : si l'élément survolé a été remplacé, on retrouve son successeur sous le pointeur
  let px = -1, py = -1, mouse = false;
  document.addEventListener('pointermove', (e) => { px = e.clientX; py = e.clientY; mouse = e.pointerType === 'mouse'; });
  new MutationObserver(() => {
    if (!cur || cur.isConnected) return;
    const t = mouse ? document.elementFromPoint(px, py)?.closest?.('[data-tip]') : null;
    cur = null; if (t) show(t); else tip.hidden = true;
  }).observe(document.body, { childList: true, subtree: true });
}
