// État d'une vue ⇄ fragment d'adresse (#t=…&b=…&s=…&az=…&el=…&d=…&v=…&p=1). Pur, sans DOM : testable sous Node.
// t : date (jours terrestres depuis l'An 0) · b : corps · s : site · az/el : angles de caméra (rad) · d : distance de caméra (log) · v : vitesse · p : pause.

const NOMBRES = { t: [-1e7, 1e7], az: [-1e3, 1e3], el: [-1.6, 1.6], d: [-5, 40], v: [0, 99] };
const r = (x, n) => String(Math.round(x * 10 ** n) / 10 ** n);

/** État → fragment d'adresse (sans le « # »). Les champs absents ou non finis sont omis. */
export function encoderEtat(e) {
  const p = [];
  if (Number.isFinite(e.t)) p.push(`t=${r(e.t, 4)}`);
  if (e.b) p.push(`b=${encodeURIComponent(e.b)}`);
  if (e.s) p.push(`s=${encodeURIComponent(e.s)}`);
  if (Number.isFinite(e.az)) p.push(`az=${r(e.az, 3)}`);
  if (Number.isFinite(e.el)) p.push(`el=${r(e.el, 3)}`);
  if (Number.isFinite(e.d)) p.push(`d=${r(e.d, 3)}`);
  if (Number.isFinite(e.v)) p.push(`v=${Math.round(e.v)}`);
  if (e.p) p.push('p=1');
  return p.join('&');
}

/** Fragment d'adresse → état validé : une valeur hors bornes ou illisible est ignorée, jamais propagée. */
export function decoderEtat(hash) {
  const e = {};
  for (const part of String(hash || '').replace(/^#/, '').split('&')) {
    const i = part.indexOf('='); if (i < 1) continue;
    const k = part.slice(0, i); let v;
    try { v = decodeURIComponent(part.slice(i + 1)); } catch { continue; }
    if (k in NOMBRES) { const x = Number(v), [lo, hi] = NOMBRES[k]; if (v !== '' && Number.isFinite(x) && x >= lo && x <= hi) e[k] = x; }
    else if ((k === 'b' || k === 's') && /^[\p{L}\p{N} _'’.-]{1,60}$/u.test(v)) e[k] = v;
    else if (k === 'p' && v === '1') e.p = true;
  }
  return e;
}
