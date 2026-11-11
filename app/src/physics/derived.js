import { G, M_EARTH, M_JUP, R_EARTH_KM, R_JUP_KM, R_SUN_KM, T_SUN, AU_KM, M_SUN_KG, EARTH_RHO } from './constants.js';

export const starLuminosity = (star) => (star.radiusRsun ** 2) * (star.teff / T_SUN) ** 4; // L☉

// Flux stellaire relatif à la Terre.
export const insolation = (L, dAU) => L / (dAU * dAU);

// Température d'équilibre (rotation rapide, sans effet de serre), K.
export function equilibriumTemp(star, dAU, albedo) {
  const dKm = dAU * AU_KM;
  return star.teff * Math.sqrt(star.radiusRsun * R_SUN_KM / (2 * dKm)) * Math.pow(1 - albedo, 0.25);
}

// Zone habitable — Kopparapu et al. 2013 (planète de 1 M⊕).
const HZ = {
  recentVenus: [1.7753, 1.4316e-4, 2.9875e-9, -7.5702e-12, -1.1635e-15],
  runaway: [1.0512, 1.3242e-4, 1.5418e-8, -7.9895e-12, -1.8328e-15],
  maxGreenhouse: [0.3438, 5.8942e-5, 1.6558e-9, -3.0045e-12, -5.2983e-16],
  earlyMars: [0.3179, 5.4513e-5, 1.5313e-9, -2.7786e-12, -4.8997e-16],
};
export function habitableZone(star) {
  const L = starLuminosity(star), T = star.teff - 5780;
  const seff = ([s, a, b, c, d]) => s + a * T + b * T * T + c * T ** 3 + d * T ** 4;
  const dist = (k) => Math.sqrt(L / seff(HZ[k]));
  return {
    conservative: [dist('runaway'), dist('maxGreenhouse')],
    optimistic: [dist('recentVenus'), dist('earlyMars')],
    seff: { runaway: seff(HZ.runaway), maxGreenhouse: seff(HZ.maxGreenhouse) },
  };
}

export const hillRadius = (aAU, e, m, M) => aAU * (1 - e) * Math.cbrt(m / (3 * M)); // UA
// Limite de stabilité prograde d'un satellite (Domingos et al. 2006).
export const stableSatelliteLimit = (rHill, ePlanet, eSat) => 0.4895 * rHill * (1 - 1.0305 * ePlanet - 0.2738 * eSat);
// Limite de Roche fluide (km).
export const rocheLimitKm = (rPlanetKm, rhoPlanet, rhoMoon) => 2.44 * rPlanetKm * Math.cbrt(rhoPlanet / rhoMoon);

export function bulk(massMsun, radiusKm) {
  const kg = massMsun * M_SUN_KG, rM = radiusKm * 1000;
  const rho = kg / ((4 / 3) * Math.PI * rM ** 3) / 1000; // g/cm³
  const gSurf = (G * massMsun * (AU_KM * 1000) ** 3 / (86400 ** 2)) / (rM * rM); // m/s²
  const vEsc = Math.sqrt(2 * gSurf * rM) / 1000; // km/s
  return { rho, gSurf, vEsc, massKg: kg };
}

export const fmtMass = (m) => (m >= 0.5 ? `${m.toFixed(2)} M☉` : m >= 0.1 * M_JUP ? `${(m / M_JUP).toFixed(3)} M_J` : m >= 0.01 * M_EARTH ? `${(m / M_EARTH).toFixed(3)} M⊕` : `${(m * M_SUN_KG).toExponential(2)} kg`);
export { M_EARTH, M_JUP, R_EARTH_KM, R_JUP_KM, EARTH_RHO };
