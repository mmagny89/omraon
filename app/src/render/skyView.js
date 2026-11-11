// Dessin du ciel vu d'un site (canvas 2D, projection équirectangulaire locale : azimut en abscisse, hauteur en ordonnée).
const TWO_PI = Math.PI * 2;
const wrap = (a) => { a = (a + Math.PI) % TWO_PI; if (a < 0) a += TWO_PI; return a - Math.PI; };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

let STARS = null;
function stars() {
  if (STARS) return STARS;
  let s = 987654; const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  STARS = Array.from({ length: 320 }, () => ({ az: (r() - 0.5) * TWO_PI, el: Math.asin(r() * 2 - 1), m: 0.25 + 0.75 * r() ** 3 }));
  return STARS;
}

// Phase : disque sombre + partie éclairée (demi-disque côté étoile + terminateur elliptique)
function phaseDisc(g, x, y, r, color, frac, angle) {
  g.save(); g.translate(x, y); g.beginPath(); g.arc(0, 0, r, 0, TWO_PI); g.clip();
  g.fillStyle = rgb(mix(hex(color), [8, 10, 18], 0.82)); g.fillRect(-r, -r, 2 * r, 2 * r);
  g.rotate(angle); g.fillStyle = color; g.beginPath();
  g.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
  const xr = Math.max(0.01, Math.abs(2 * frac - 1)) * r;
  g.ellipse(0, 0, xr, r, 0, Math.PI / 2, -Math.PI / 2, frac < 0.5);
  g.closePath(); g.fill(); g.restore();
}

/**
 * opts : { center: 'star'|'parent'|'north', fov: degrés, atm: 'none'|'thin'|'earth'|'gas', surface: bool, parentName }
 */
export function drawSky(canvas, sky, opts) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2), cw = canvas.clientWidth || 320, ch = Math.round(cw * 0.56);
  if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) { canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr); canvas.style.height = ch + 'px'; }
  const g = canvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = cw, H = ch, fov = (opts.fov || 180) * Math.PI / 180, ppr = W / fov;
  const star = sky.objs.find((o) => o.type === 'star');
  const parent = sky.objs.find((o) => o.name === opts.parentName);
  const center = opts.center === 'free' ? opts.centerAz : opts.center === 'north' ? 0 : opts.center === 'parent' && parent ? parent.az : star ? star.az : 0;
  const elC = opts.elCenter ?? (opts.surface ? 0.38 : 0); // hauteur au centre de l'image
  const X = (az) => W / 2 + wrap(az - center) * ppr, Y = (el) => H / 2 - (el - elC) * ppr;
  const sunDeg = sky.sunEl * 180 / Math.PI;
  const day = opts.atm === 'none' ? 0 : clamp((sunDeg + 6) / 16, 0, 1) * (opts.atm === 'thin' ? 0.55 : 1);
  // ciel
  const night = [4, 6, 14], pal = { earth: [[58, 118, 200], [160, 200, 240]], gas: [[120, 88, 52], [217, 178, 122]], thin: [[78, 66, 54], [140, 118, 92]], none: [night, night] }[opts.atm || 'none'];
  const grad = g.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, rgb(mix(night, pal[0], day))); grad.addColorStop(1, rgb(mix([10, 14, 30], pal[1], day)));
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  if (opts.atm && opts.atm !== 'none' && sunDeg > -9 && sunDeg < 9 && star) { // lueur du crépuscule autour de l'étoile
    const a = 1 - Math.abs(sunDeg) / 9, gx = X(star.az), gl = g.createRadialGradient(gx, Y(0), 0, gx, Y(0), W * 0.45);
    gl.addColorStop(0, `rgba(255,170,90,${0.55 * a})`); gl.addColorStop(1, 'rgba(255,170,90,0)'); g.fillStyle = gl; g.fillRect(0, 0, W, H);
  }
  // étoiles lointaines
  if (day < 0.7) for (const s of stars()) { const x = X(s.az), y = Y(s.el); if (x < 0 || x > W || y < 0 || y > H) continue; g.fillStyle = `rgba(255,255,255,${s.m * (1 - day / 0.7)})`; g.fillRect(x, y, 1.3, 1.3); }
  // sol / corps sous l'horizon
  const hy = Y(sky.horizon || 0);
  if (hy < H) {
    const c = hex(sky.ownColor || '#888888'), gr = g.createLinearGradient(0, hy, 0, H);
    gr.addColorStop(0, rgb(mix(c, [0, 0, 0], opts.surface ? 0.55 : 0.2))); gr.addColorStop(1, rgb(mix(c, [0, 0, 0], opts.surface ? 0.8 : 0.45)));
    g.fillStyle = gr; g.fillRect(0, Math.max(0, hy), W, H - Math.max(0, hy));
    g.strokeStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.moveTo(0, hy); g.lineTo(W, hy); g.stroke();
  }
  // corps, du plus lointain au plus proche
  const labels = [];
  for (const o of [...sky.objs].sort((a, b) => b.dist - a.dist)) {
    const x = X(o.az), y = Y(o.el), r = Math.max(o.angR * ppr, o.type === 'star' ? 2.2 : 1.7);
    if (x < -r - 40 || x > W + r + 40 || y < -r - 20 || y > H + r + 20) continue;
    if (o.type === 'star') {
      const gl = g.createRadialGradient(x, y, 0, x, y, Math.max(16, r * 7)); gl.addColorStop(0, 'rgba(255,245,220,.95)'); gl.addColorStop(0.2, 'rgba(255,225,170,.35)'); gl.addColorStop(1, 'rgba(255,200,120,0)');
      g.fillStyle = gl; g.beginPath(); g.arc(x, y, Math.max(16, r * 7), 0, TWO_PI); g.fill();
      g.fillStyle = '#fffaf0'; g.beginPath(); g.arc(x, y, r, 0, TWO_PI); g.fill();
    } else if (r < 2.6) { g.fillStyle = o.color; g.beginPath(); g.arc(x, y, r, 0, TWO_PI); g.fill(); }
    else phaseDisc(g, x, y, r, o.color, o.frac, -o.limb);
    if (o.type !== 'star' && (r > 2.6 || o.type === 'planet')) labels.push([o.name, x + r + 3, y - r * 0.2]);
  }
  g.font = '11px system-ui, sans-serif'; g.fillStyle = '#e6ecf8'; g.shadowColor = '#000'; g.shadowBlur = 3;
  for (const [t, x, y] of labels) if (x < W - 20) g.fillText(t, x, y);
  g.shadowBlur = 0;
  // repères cardinaux : sur l'horizon (sol) ou sur le plan local de la station (hauteur 0)
  g.fillStyle = 'rgba(255,226,176,.8)'; g.font = '600 11px system-ui, sans-serif';
  const yc = clamp(Y(0) + 14, 12, H - 4);
  for (const [t, a] of [['N', 0], ['NE', Math.PI / 4], ['E', Math.PI / 2], ['SE', 3 * Math.PI / 4], ['S', Math.PI], ['SO', -3 * Math.PI / 4], ['O', -Math.PI / 2], ['NO', -Math.PI / 4]]) { const x = X(a); if (x > 8 && x < W - 8) { g.globalAlpha = t.length === 1 ? 0.95 : 0.55; g.fillText(t, x - (t.length === 1 ? 3 : 6), yc); } }
  g.globalAlpha = 1;
  return { center, ppr, elC };
}
