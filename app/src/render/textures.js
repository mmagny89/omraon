import * as THREE from 'three';
import { makeNoise } from './noise.js';

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = (x) => Math.max(0, Math.min(1, x));
function ramp(stops, t) {
  t = clamp01(t);
  for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) { const [t0, c0] = stops[i - 1], [t1, c1] = stops[i]; return mix(c0, c1, (t - t0) / (t1 - t0 || 1)); }
  return stops[stops.length - 1][1];
}

// Chaque générateur reçoit la direction (x,y,z) sur la sphère unité, avec lat = z (pôle = +Z du monde).
const styles = {
  kalpra: (n, x, y, z) => {
    const b = n.fbm(x * 3, y * 3, z * 3, 6), ridge = 1 - Math.abs(n.fbm(x * 5 + 9, y * 5, z * 5, 4));
    const base = ramp([[0, hex('#1d1612')], [0.5, hex('#3b2e26')], [1, hex('#6a5646')]], 0.5 + b);
    const lava = clamp01((ridge - 0.86) * 18);
    return { c: mix(base, hex('#ff6a1a'), lava * 0.9), e: lava, h: clamp01(0.5 + b * 0.9 + (ridge - 0.5) * 0.3) };
  },
  sethis: (n, x, y, z) => {
    const b = n.fbm(x * 2.2, y * 2.2, z * 2.2, 6), d = n.fbm(x * 7 + 3, y * 7, z * 7, 4);
    const c = ramp([[0, hex('#6b3d22')], [0.45, hex('#b2723e')], [0.75, hex('#d39a5c')], [1, hex('#e6bd86')]], 0.5 + b * 0.9);
    return { c: mix(c, hex('#4a2a1a'), clamp01(d * 0.8 - 0.1)), h: clamp01(0.5 + b * 0.9) };
  },
  naksun: (n, x, y, z) => {
    const b = n.fbm(x * 2.8, y * 2.8, z * 2.8, 6), cr = n.noise(x * 14, y * 14, z * 14);
    let c = ramp([[0, hex('#4a4f58')], [0.5, hex('#8d939d')], [1, hex('#c0c4cc')]], 0.5 + b);
    c = mix(c, [60, 66, 76], clamp01(-cr * 0.8) * 0.5);
    return { c, h: clamp01(0.5 + b * 0.8 - clamp01(-cr) * 0.3) };
  },
  rockGrey: (n, x, y, z) => {
    const b = n.fbm(x * 4, y * 4, z * 4, 6), cr = n.noise(x * 11, y * 11, z * 11);
    const v = 0.5 + 0.5 * b - clamp01(-cr) * 0.25;
    return { c: [v * 190, v * 186, v * 182], h: clamp01(0.5 + 0.5 * b - clamp01(-cr) * 0.35) };
  },
  rockDark: (n, x, y, z) => {
    const b = n.fbm(x * 4, y * 4, z * 4, 6), cr = n.noise(x * 12, y * 12, z * 12);
    const v = 0.35 + 0.35 * b - clamp01(-cr) * 0.2;
    return { c: [v * 150, v * 140, v * 135], h: clamp01(0.5 + 0.5 * b - clamp01(-cr) * 0.35) };
  },
  ice: (n, x, y, z) => {
    const b = n.fbm(x * 3, y * 3, z * 3, 5), cr = Math.abs(n.noise(x * 9, y * 9, z * 9));
    let c = ramp([[0, hex('#b9d6ee')], [0.6, hex('#e3f1fb')], [1, hex('#ffffff')]], 0.55 + b * 0.6);
    c = mix(c, hex('#7fa8c9'), clamp01(1 - cr * 9) * 0.5);
    return { c, h: clamp01(0.5 + b * 0.5 - clamp01(1 - cr * 9) * 0.2) };
  },
  kebet: (n, x, y, z) => {
    const h = n.fbm(x * 1.8 + 5, y * 1.8, z * 1.8, 7) + 0.25 * n.fbm(x * 6, y * 6, z * 6, 3);
    const lat = Math.abs(z), sea = 0.02;
    let c;
    if (h < sea) c = ramp([[0, hex('#0a2a5c')], [0.7, hex('#14518f')], [1, hex('#2f86b8')]], 1 + (h - sea) * 3.2);
    else {
      const e = h - sea, moist = n.fbm(x * 3 + 20, y * 3, z * 3, 4) + 0.35 - lat * 0.5;
      const veg = ramp([[0, hex('#c9b27a')], [0.35, hex('#6e8f3a')], [0.7, hex('#2c6a2a')], [1, hex('#1f4d25')]], 0.5 + moist);
      c = mix(veg, hex('#8d8478'), clamp01((e - 0.35) * 3));
      c = mix(c, hex('#f2f6f8'), clamp01((e - 0.6) * 4));
    }
    const ice = clamp01((lat - 0.82 + 0.05 * n.noise(x * 8, y * 8, z * 8)) * 14);
    return { c: mix(c, hex('#f4f8fb'), ice), h: h < sea ? 0.3 : clamp01(0.3 + (h - sea) * 1.2) };
  },
  zirkan: gasGiant([[0, '#8a5a36'], [0.25, '#c99a62'], [0.5, '#ecd9b0'], [0.75, '#b8825a'], [1, '#e8cfa0']], 9, 0.5, true),
  roushan: gasGiant([[0, '#a79d80'], [0.3, '#d9cfae'], [0.55, '#efe6c8'], [0.8, '#c3b693'], [1, '#e6dcba']], 7, 0.25, false),
  star: (n, x, y, z) => {
    const g = n.fbm(x * 9, y * 9, z * 9, 5), s = n.fbm(x * 3 + 7, y * 3, z * 3, 3);
    const c = mix(hex('#ffd9a0'), hex('#fffaf0'), clamp01(0.55 + g * 0.8 + s * 0.2));
    return { c };
  },
};
function gasGiant(stops, bands, turb, spot) {
  const st = stops.map(([t, c]) => [t, hex(c)]);
  return (n, x, y, z) => {
    const w = n.fbm(x * 2.5, y * 2.5, z * 6, 5) * turb;
    const lat = z + w * 0.25;
    const t = 0.5 + 0.5 * Math.sin(lat * bands * Math.PI + 1.3 * n.fbm(x * 4, y * 4, z * 1.5, 3));
    let c = ramp(st, t);
    if (spot) {
      const dx = x - 0.82, dy = y + 0.2, dz = (z + 0.28) * 2.2, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      c = mix(c, hex('#b4552e'), clamp01(1 - d / 0.2) * 0.8);
    }
    return { c };
  };
}

export function makeBodyTexture(styleName, seed, w = 512, h = 256, withEmissive = false) {
  const n = makeNoise(seed), gen = styles[styleName] || styles.rockGrey;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(w, h);
  let ev, ectx, eimg, bv, bctx, bimg;
  if (withEmissive) { ev = document.createElement('canvas'); ev.width = w; ev.height = h; ectx = ev.getContext('2d'); eimg = ectx.createImageData(w, h); }
  for (let j = 0; j < h; j++) {
    const lat = Math.PI * (0.5 - (j + 0.5) / h), cl = Math.cos(lat), z = Math.sin(lat);
    for (let i = 0; i < w; i++) {
      const lon = ((i + 0.5) / w) * Math.PI * 2;
      const { c, e = 0, h: hh } = gen(n, cl * Math.cos(lon), cl * Math.sin(lon), z);
      const k = 4 * (j * w + i);
      if (hh !== undefined) {
        if (!bimg) { bv = document.createElement('canvas'); bv.width = w; bv.height = h; bctx = bv.getContext('2d'); bimg = bctx.createImageData(w, h); }
        bimg.data[k] = bimg.data[k + 1] = bimg.data[k + 2] = 255 * hh; bimg.data[k + 3] = 255;
      }
      img.data[k] = c[0]; img.data[k + 1] = c[1]; img.data[k + 2] = c[2]; img.data[k + 3] = 255;
      if (eimg) { eimg.data[k] = 255 * e; eimg.data[k + 1] = 90 * e; eimg.data[k + 2] = 10 * e; eimg.data[k + 3] = 255; }
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; tex.wrapS = THREE.RepeatWrapping;
  let emissive = null;
  if (ev) { ectx.putImageData(eimg, 0, 0); emissive = new THREE.CanvasTexture(ev); emissive.colorSpace = THREE.SRGBColorSpace; }
  let bump = null;
  if (bimg) { bctx.putImageData(bimg, 0, 0); bump = new THREE.CanvasTexture(bv); bump.wrapS = THREE.RepeatWrapping; }
  return { map: tex, emissive, bump };
}

/**
 * Profil radial d'un anneau (1024 × 1 px, RGBA) : bandes de bruit, divisions et bords adoucis.
 * rings : { inner, outer, color, gaps: [[r0, r1]] en rayons planétaires, seed }.
 */
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
/** Opacité (0–1) et couleur (RGB 0–255) de l'anneau à la fraction radiale u (0 = bord intérieur, 1 = bord extérieur). */
function ringAt(n, rings, base, u) {
  const r = rings.inner + u * (rings.outer - rings.inner);
  let a = 0.62 + 0.7 * n.fbm(u * 16, 0.3, 0.7, 4);
  a *= 0.88 + 0.24 * n.fbm(u * 70, 1.1, 0.2, 3);
  for (const [g0, g1] of rings.gaps || []) a *= 1 - (sstep(g0 - 0.01, g0 + 0.01, r) - sstep(g1 - 0.01, g1 + 0.01, r));
  a *= sstep(0, 0.05, u) * sstep(1, 0.93, u);
  const shade = 0.86 + 0.22 * n.fbm(u * 24 + 4, 2.2, 0.5, 3);
  return { a: clamp01(a), c: [base[0] * shade, base[1] * shade, base[2] * shade] };
}

/**
 * Profil radial d'un anneau (1024 × 1 px, RGBA) : bandes de bruit, divisions et bords adoucis.
 * rings : { inner, outer, color, gaps: [[r0, r1]] en rayons planétaires, seed }.
 */
export function makeRingTexture(rings, seed = 1, w = 1024) {
  const n = makeNoise((rings.seed ?? seed) + 101), cv = document.createElement('canvas'); cv.width = w; cv.height = 1;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(w, 1), base = hex(rings.color);
  for (let i = 0; i < w; i++) {
    const { a, c } = ringAt(n, rings, base, (i + 0.5) / w), k = 4 * i;
    img.data[k] = c[0]; img.data[k + 1] = c[1]; img.data[k + 2] = c[2]; img.data[k + 3] = 255 * a;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/** Même profil, en K bandes concentriques [{ a, c }], pour le dessin 2D du ciel (même graine que la texture 3D). */
export function ringProfile(rings, k = 48) {
  const n = makeNoise((rings.seed ?? 1) + 101), base = hex(rings.color);
  return Array.from({ length: k }, (_, i) => ringAt(n, rings, base, (i + 0.5) / k));
}

export function makeCloudTexture(seed, w = 512, h = 256) {
  const n = makeNoise(seed), cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(w, h);
  for (let j = 0; j < h; j++) {
    const lat = Math.PI * (0.5 - (j + 0.5) / h), cl = Math.cos(lat), z = Math.sin(lat);
    for (let i = 0; i < w; i++) {
      const lon = ((i + 0.5) / w) * Math.PI * 2, x = cl * Math.cos(lon), y = cl * Math.sin(lon);
      const a = clamp01((n.fbm(x * 2.6, y * 2.6, z * 4.2, 6) - 0.05) * 2.6);
      const k = 4 * (j * w + i);
      img.data[k] = img.data[k + 1] = img.data[k + 2] = 255; img.data[k + 3] = 255 * a;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function glowTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const g = cv.getContext('2d'), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,248,235,1)'); gr.addColorStop(0.12, 'rgba(255,238,205,0.65)'); gr.addColorStop(0.4, 'rgba(255,214,150,0.14)'); gr.addColorStop(1, 'rgba(255,200,120,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** Vrai si (lat, lon) de la texture 'kebet' tombe sur un continent. Même convention que le rendu (voir physics/sites.js). */
export function kebetIsLand(seed, latDeg, lonDeg) {
  const n = makeNoise(seed), la = latDeg * Math.PI / 180, lo = lonDeg * Math.PI / 180, c = Math.cos(la);
  const x = c * Math.cos(lo), y = c * Math.sin(lo), z = Math.sin(la);
  return n.fbm(x * 1.8 + 5, y * 1.8, z * 1.8, 7) + 0.25 * n.fbm(x * 6, y * 6, z * 6, 3) > 0.12;
}
