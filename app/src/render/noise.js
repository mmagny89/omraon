// Bruit simplex 3D (Gustavson, domaine public) + fbm, graine déterministe.
const grad3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
export function makeNoise(seed = 1) {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  let s = seed >>> 0 || 1;
  for (let i = 255; i > 0; i--) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; const j = s % (i + 1); [p[i], p[j]] = [p[j], p[i]]; }
  const perm = new Uint8Array(512), pm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) { perm[i] = p[i & 255]; pm[i] = perm[i] % 12; }
  const F3 = 1 / 3, G3 = 1 / 6;
  function noise(x, y, z) {
    const s = (x + y + z) * F3, i = Math.floor(x + s), j = Math.floor(y + s), k = Math.floor(z + s);
    const t = (i + j + k) * G3, x0 = x - (i - t), y0 = y - (j - t), z0 = z - (k - t);
    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) { if (y0 >= z0) { i1=1;j1=0;k1=0;i2=1;j2=1;k2=0; } else if (x0 >= z0) { i1=1;j1=0;k1=0;i2=1;j2=0;k2=1; } else { i1=0;j1=0;k1=1;i2=1;j2=0;k2=1; } }
    else { if (y0 < z0) { i1=0;j1=0;k1=1;i2=0;j2=1;k2=1; } else if (x0 < z0) { i1=0;j1=1;k1=0;i2=0;j2=1;k2=1; } else { i1=0;j1=1;k1=0;i2=1;j2=1;k2=0; } }
    const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3, x2 = x0 - i2 + 2*G3, y2 = y0 - j2 + 2*G3, z2 = z0 - k2 + 2*G3, x3 = x0 - 1 + 3*G3, y3 = y0 - 1 + 3*G3, z3 = z0 - 1 + 3*G3;
    const ii = i & 255, jj = j & 255, kk = k & 255;
    const c = (t0, g, x, y, z) => { if (t0 < 0) return 0; t0 *= t0; const q = grad3[g]; return t0 * t0 * (q[0]*x + q[1]*y + q[2]*z); };
    return 32 * (
      c(0.6 - x0*x0 - y0*y0 - z0*z0, pm[ii + perm[jj + perm[kk]]], x0, y0, z0) +
      c(0.6 - x1*x1 - y1*y1 - z1*z1, pm[ii + i1 + perm[jj + j1 + perm[kk + k1]]], x1, y1, z1) +
      c(0.6 - x2*x2 - y2*y2 - z2*z2, pm[ii + i2 + perm[jj + j2 + perm[kk + k2]]], x2, y2, z2) +
      c(0.6 - x3*x3 - y3*y3 - z3*z3, pm[ii + 1 + perm[jj + 1 + perm[kk + 1]]], x3, y3, z3));
  }
  function fbm(x, y, z, oct = 5, lac = 2, gain = 0.5) {
    let a = 1, f = 1, sum = 0, norm = 0;
    for (let o = 0; o < oct; o++) { sum += a * noise(x * f, y * f, z * f); norm += a; a *= gain; f *= lac; }
    return sum / norm;
  }
  return { noise, fbm };
}
