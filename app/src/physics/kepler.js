import { TWO_PI } from './constants.js';

export function wrapPi(x) {
  x = (x + Math.PI) % TWO_PI;
  if (x < 0) x += TWO_PI;
  return x - Math.PI;
}

export function solveKepler(M, e) {
  M = wrapPi(M);
  let E = e < 0.8 ? M : Math.PI * Math.sign(M || 1);
  for (let k = 0; k < 40; k++) {
    const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-14) break;
  }
  return E;
}

// Base orbitale (P, Q) dans le repère de référence à partir de Ω, i, ω.
export function orbitBasis(Om, i, w) {
  const cO = Math.cos(Om), sO = Math.sin(Om), ci = Math.cos(i), si = Math.sin(i), cw = Math.cos(w), sw = Math.sin(w);
  return {
    P: [cO * cw - sO * ci * sw, sO * cw + cO * ci * sw, si * sw],
    Q: [-cO * sw - sO * ci * cw, -sO * sw + cO * ci * cw, si * cw],
  };
}

// Éléments képlériens -> état (r, v) relatif au centre, mu = G(M+m).
export function elementsToState(mu, { a, e, i, Om, w, M }) {
  const E = solveKepler(M, e);
  const cE = Math.cos(E), sE = Math.sin(E);
  const b = a * Math.sqrt(1 - e * e);
  const r = a * (1 - e * cE);
  const n = Math.sqrt(mu / (a * a * a));
  const { P, Q } = orbitBasis(Om, i, w);
  const x = a * (cE - e), y = b * sE;
  const vx = (-a * n * sE) / (1 - e * cE), vy = (b * n * cE) / (1 - e * cE);
  void r;
  return {
    r: [0, 1, 2].map((k) => x * P[k] + y * Q[k]),
    v: [0, 1, 2].map((k) => vx * P[k] + vy * Q[k]),
  };
}

export function stateToElements(mu, r, v) {
  const [x, y, z] = r, [vx, vy, vz] = v;
  const rm = Math.hypot(x, y, z);
  const v2 = vx * vx + vy * vy + vz * vz;
  const hx = y * vz - z * vy, hy = z * vx - x * vz, hz = x * vy - y * vx;
  const hm = Math.hypot(hx, hy, hz);
  const rv = x * vx + y * vy + z * vz;
  const ex = (vy * hz - vz * hy) / mu - x / rm;
  const ey = (vz * hx - vx * hz) / mu - y / rm;
  const ez = (vx * hy - vy * hx) / mu - z / rm;
  const e = Math.hypot(ex, ey, ez);
  const a = 1 / (2 / rm - v2 / mu);
  const inc = Math.acos(Math.max(-1, Math.min(1, hz / hm)));
  const Om = Math.hypot(hx, hy) > 1e-14 ? Math.atan2(hx, -hy) : 0;
  // base orbitale
  let P;
  if (e > 1e-10) P = [ex / e, ey / e, ez / e];
  else {
    const nm = Math.hypot(hx, hy);
    P = nm > 1e-14 ? [-hy / nm, hx / nm, 0] : [1, 0, 0];
  }
  const Q = [(hy * P[2] - hz * P[1]) / hm, (hz * P[0] - hx * P[2]) / hm, (hx * P[1] - hy * P[0]) / hm];
  const xp = x * P[0] + y * P[1] + z * P[2];
  const yp = x * Q[0] + y * Q[1] + z * Q[2];
  const nu = Math.atan2(yp, xp);
  const w = Math.sin(inc) > 1e-10 ? Math.atan2(P[2], Q[2]) : Math.atan2(P[1], P[0]) - Om;
  const E = 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(nu / 2), Math.sqrt(1 + e) * Math.cos(nu / 2));
  const M = E - e * Math.sin(E);
  const n = Math.sqrt(mu / Math.abs(a * a * a));
  void rv;
  return {
    a, e, i: inc, Om, w, M, nu, n, P, Q, h: [hx, hy, hz], r: rm,
    period: TWO_PI / n, rp: a * (1 - e), ra: a * (1 + e), varpi: Om + w,
  };
}

// Points d'une ellipse osculatrice (relatifs au foyer).
export function ellipsePoints(el, count, out, ox, oy, oz, scale) {
  const b = el.a * Math.sqrt(1 - el.e * el.e);
  for (let k = 0; k < count; k++) {
    const E = (k / (count - 1)) * TWO_PI;
    const x = el.a * (Math.cos(E) - el.e), y = b * Math.sin(E);
    out[3 * k] = (x * el.P[0] + y * el.Q[0] + ox) * scale;
    out[3 * k + 1] = (x * el.P[1] + y * el.Q[1] + oy) * scale;
    out[3 * k + 2] = (x * el.P[2] + y * el.Q[2] + oz) * scale;
  }
}

// Propagation analytique d'une orbite (satellite « sur rails »).
export function railState(rail, t, outR, outV) {
  const M = rail.M0 + rail.n * (t - rail.t0);
  const E = solveKepler(M, rail.e);
  const cE = Math.cos(E), sE = Math.sin(E), d = 1 - rail.e * cE;
  const x = rail.a * (cE - rail.e), y = rail.b * sE;
  const vx = (-rail.a * rail.n * sE) / d, vy = (rail.b * rail.n * cE) / d;
  for (let k = 0; k < 3; k++) {
    outR[k] = x * rail.P[k] + y * rail.Q[k];
    outV[k] = vx * rail.P[k] + vy * rail.Q[k];
  }
}
