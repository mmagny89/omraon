import { fmtDuree } from './calendrier.js';
import { equilibriumTemp, bulk, hillRadius, stableSatelliteLimit, rocheLimitKm } from './derived.js';
import { AU_KM, R_SUN_KM, G, DAYS_PER_YEAR, M_SUN_KG } from './constants.js';

const K_B = 1.380649e-23, AMU = 1.66053907e-27;

/** Distance (UA) où la température d'équilibre vaut T (K), pour un albédo donné. */
export function distanceForTemp(star, albedo, T) {
  return (star.radiusRsun * R_SUN_KM / 2 / AU_KM) * (star.teff / T) ** 2 * Math.sqrt(1 - albedo);
}

// Dose de rayonnement piégé autour de Jupiter (Galileo, rem/jour) : Io, Europe, Ganymède, Callisto.
const BELT = [[5.9, 3600], [9.4, 540], [15, 8], [26, 0.01]];
/** Dose sans protection (rem/jour) à r rayons planétaires, pour un champ f fois celui de Jupiter. Estimation par analogie. */
export function doseRemPerDay(r, f = 1) {
  if (f <= 0) return 0;
  let i = BELT.findIndex((q) => r <= q[0]);
  if (i < 0) i = BELT.length - 1;
  if (i === 0) i = 1;
  const [r0, d0] = BELT[i - 1], [r1, d1] = BELT[i];
  const ln = Math.log(d0) + ((r - r0) / (r1 - r0)) * (Math.log(d1) - Math.log(d0));
  return Math.min(1e6, Math.max(1e-9, Math.exp(ln))) * f;
}

/** Flux de chaleur de marée à la surface d'un satellite (W/m²) — Peale et al. 1979. */
export function tidalHeatingWm2({ Mp, R, a, e, k2Q = 0.01 }) {
  const n = Math.sqrt(6.674e-11 * Mp / a ** 3);
  const P = 10.5 * k2Q * 6.674e-11 * Mp * Mp * R ** 5 * n * e * e / a ** 6;
  return P / (4 * Math.PI * R * R);
}

const st = (v, ok, warn, higherBad = true) => {
  const [lo, hi] = higherBad ? [ok, warn] : [warn, ok];
  void lo; void hi;
  return v;
};
void st;
const band = (v, okLo, okHi, wLo, wHi) => (v >= okLo && v <= okHi ? 'ok' : v >= wLo && v <= wHi ? 'warn' : 'bad');
const fmt = (x, d = 2) => (Math.abs(x) >= 1e4 || (Math.abs(x) < 0.01 && x !== 0) ? x.toExponential(1) : x.toFixed(d));

/**
 * Évalue ce qu'une habitation humaine peut supporter sur un corps.
 * ctx : { star (def), L, hz, bodies, el(idx), prot(idx) -> période de rotation (j) ou 0 }
 */
export function assess(ctx, idx) {
  const b = ctx.bodies[idx], d = b.def, star = ctx.star;
  if (b.type === 'star') return { mode: 'none', level: 'info', label: 'Étoile', criteria: [], suggestions: [] };
  const crit = [], sugg = [];
  const planetIdx = b.type === 'moon' ? b.parent : idx;
  const pEl = ctx.el(planetIdx), pBody = ctx.bodies[planetIdx];
  if (!pEl) return { mode: 'none', level: 'info', label: '…', criteria: [], suggestions: [] };
  const aStar = pEl.a, eStar = pEl.e;
  const hab = d.habitat || {};
  const P = hab.pressureBar ?? 0, gh = hab.greenhouseK ?? 0;
  const albedo = d.albedo ?? 0.3;
  const bk = bulk(b.mass, b.radiusKm), g = bk.gSurf / 9.80665;
  const Seff = ctx.L / (aStar * aStar * Math.sqrt(1 - eStar * eStar));
  // éclipses par la géante parente : une part de l'orbite sans étoile abaisse le flux moyen
  const eclipse = b.type === 'moon' && pBody.def.kind === 'gas' ? Math.asin(Math.min(1, pBody.radiusKm / (ctx.el(idx).a * AU_KM))) / Math.PI : 0;
  const Teq = equilibriumTemp(star, aStar, albedo) * Math.pow(1 - eclipse, 0.25);

  // ------ Géantes gazeuses : habitat flottant ------
  if (d.kind === 'gas') {
    const T1 = (hab.internalHeat ?? 1.5) * Teq; // estimation : chaleur interne + effet de serre à 1 bar (Jupiter 1,5 ; Saturne 1,63)
    const kappa = 0.29; // adiabatique H2/He
    const p288 = (288 / T1) ** (1 / kappa);
    crit.push({ label: 'Température à 1 bar', value: `${fmt(T1, 0)} K`, status: band(T1, 270, 310, 90, 340), note: T1 < 270 ? 'habitats chauffés (énergie des raffineries)' : 'estimation (≈1,5 × T équilibre)' });
    crit.push({ label: 'Niveau à 288 K', value: `${fmt(p288, 2)} bar`, status: p288 >= 0.5 && p288 <= 3 ? 'ok' : 'info', note: p288 > 3 ? 'trop profond pour flotter : on reste vers 1 bar et on chauffe' : 'pression ambiante à la température de confort' });
    crit.push({ label: 'Gravité (1 bar)', value: `${fmt(g, 2)} g`, status: band(g, 0.6, 1.5, 0.3, 2.2), note: '' });
    if (T1 < 200) sugg.push(`À 1 bar il fait ${fmt(T1, 0)} K : les cités flottantes doivent être chauffées (énergie des raffineries). Rapprocher la géante de l'étoile ou augmenter sa chaleur interne les rendrait confortables.`);
    if (p288 > 10) sugg.push(`Le niveau à 288 K est à ${fmt(p288, 0)} bar : les cités restent vers 1 bar, chauffées. Pour un niveau confortable à ~1–3 bar, il faut T(1 bar) ≈ ${fmt(288 / Math.pow(2, kappa), 0)} K.`);
    const level = crit.some((c) => c.status === 'bad') ? 'bad' : crit.some((c) => c.status === 'warn') ? 'warn' : 'ok';
    return { mode: 'flottant', level, label: level === 'ok' ? 'Cités flottantes confortables' : level === 'warn' ? 'Cités flottantes chauffées (énergie requise)' : 'Habitat flottant artificiel seulement', criteria: crit, suggestions: sugg, notes: ['Aucune surface : seule la haute atmosphère est exploitable.'] };
  }

  // ------ Corps solides ------
  const surface = P >= 0.3;
  const station = !surface && g < 0.1;
  const Tsurf = Teq + gh;
  const vTh = (m) => Math.sqrt(3 * K_B * Math.max(600, 1000 * Math.sqrt(Math.max(Seff, 0.05))) / (m * AMU));
  const retain = (bk.vEsc * 1000) / vTh(28);

  if (surface) {
    crit.push({ label: 'Température de surface', value: `${fmt(Tsurf, 0)} K (${fmt(Tsurf - 273.15, 0)} °C)`, status: band(Tsurf, 278, 308, 250, 340), note: `T équilibre ${fmt(Teq, 0)} K + effet de serre ${fmt(gh, 0)} K` });
    const need = 288 - Teq;
    if (Math.abs(Tsurf - 288) > 10) {
      const aReq = 1 - ((288 - gh) / (Teq / Math.pow(1 - albedo, 0.25))) ** 4;
      sugg.push(`Pour ≈ 15 °C (288 K) : effet de serre de ${fmt(need, 0)} K (actuel ${fmt(gh, 0)} K)${aReq >= 0 && aReq <= 0.9 ? `, ou albédo ${fmt(aReq, 2)}` : ''}, ou distance à l'étoile de ${fmt(distanceForTemp(star, albedo, 288 - gh), 2)} UA${b.type === 'moon' ? ` pour ${pBody.def.name}` : ''}.`);
    }
    crit.push({ label: 'Pression atmosphérique', value: `${fmt(P, 2)} bar`, status: band(P, 0.5, 2, 0.3, 5), note: '' });
    crit.push({ label: 'Rétention de N₂', value: `v_lib / v_th = ${fmt(retain, 1)}`, status: retain >= 6 ? 'ok' : retain >= 4 ? 'warn' : 'bad', note: 'critère de Jeans (≥ 6 : stable sur des Gyr)' });
    crit.push({ label: 'Eau liquide', value: Tsurf > 273 && Tsurf < 373 ? 'possible' : Tsurf <= 273 ? 'gelée' : 'vaporisée', status: Tsurf > 273 && Tsurf < 373 ? 'ok' : 'bad', note: `à ${fmt(P, 1)} bar` });
  } else {
    const tSub = Teq; // un sous-sol à quelques mètres suit la température moyenne
    crit.push({ label: 'Température moyenne (sous-sol)', value: `${fmt(tSub, 0)} K (${fmt(tSub - 273.15, 0)} °C)`, status: band(tSub, 200, 320, 120, 450), note: `sans atmosphère, albédo ${albedo}` });
    crit.push({ label: 'Face éclairée au zénith', value: `${fmt(tSub * Math.SQRT2, 0)} K`, status: tSub * Math.SQRT2 < 400 ? 'ok' : tSub * Math.SQRT2 < 600 ? 'warn' : 'bad', note: 'dôme exposé à l\'étoile' });
    crit.push({ label: 'Atmosphère possible', value: `v_lib / v_th = ${fmt(retain, 1)}`, status: 'info', note: retain >= 6 ? 'pourrait retenir N₂' : 'ne retient pas N₂ : habitat scellé obligatoire' });
    if (tSub > 450) sugg.push(`T moyenne ${fmt(tSub, 0)} K : refroidissement actif permanent. Pour ≤ 320 K, distance ≥ ${fmt(distanceForTemp(star, albedo, 320), 2)} UA${b.type === 'moon' ? ` (orbite de ${pBody.def.name})` : ''}, ou albédo plus élevé.`);
    if (tSub < 120) sugg.push(`T moyenne ${fmt(tSub, 0)} K : chauffage permanent (énergie nucléaire ou géothermie).`);
  }
  crit.push(station
    ? { label: 'Gravité de surface', value: `${fmt(g * 1000, 1)} mg`, status: 'info', note: 'quasi-apesanteur : gravité artificielle par rotation, ou séjours courts' }
    : { label: 'Gravité de surface', value: `${fmt(g, 2)} g (${fmt(bk.gSurf, 1)} m/s²)`, status: band(g, 0.6, 1.5, 0.3, 2.2), note: 'santé humaine à long terme : ~0,5–1,5 g' });

  // rayonnement piégé (satellites de géantes)
  if (b.type === 'moon' && pBody.def.kind === 'gas') {
    const rEff = ctx.el(idx).a * AU_KM / pBody.radiusKm;
    const dose = doseRemPerDay(rEff, pBody.def.habitat?.magnetosphere ?? 1);
    const st0 = surface ? 'info' : dose < 0.1 ? 'ok' : dose < 5 ? 'warn' : 'bad'; // en surface, l'atmosphère protège : seule la vie en orbite est concernée
    crit.push({ label: 'Rayonnement (orbite, nu)', value: `${fmt(dose, dose < 1 ? 3 : 1)} rem/j = ${fmt(dose * 10, 1)} mSv/j`, status: st0, note: surface ? `à ${fmt(rEff, 1)} rayons de ${pBody.def.name} : concerne seulement les stations en orbite (blindage, voir leur fiche) ; ISS ≈ 1 mSv/j` : `à ${fmt(rEff, 1)} rayons de ${pBody.def.name} ; ISS ≈ 1 mSv/j` });
    if (surface) {
      const shielded = dose < 500;
      crit.push({ label: 'Rayonnement (surface)', value: shielded ? 'atténué par l\'atmosphère' : 'trop intense', status: shielded ? 'ok' : 'bad', note: `${fmt(P, 1)} bar ≈ ${fmt(P * 10, 0)} m d'eau équivalent` });
    }
    if (st0 !== 'ok' && st0 !== 'info') {
      let rOk = rEff;
      while (rOk < 200 && doseRemPerDay(rOk, pBody.def.habitat?.magnetosphere ?? 1) >= 0.1) rOk += 0.25;
      sugg.push(`Pour < 1 mSv/j en orbite : au-delà de ${fmt(rOk, 1)} rayons de ${pBody.def.name} (${fmt(rOk * pBody.radiusKm, 0)} km), ou blindage lourd (mètres d'eau/régolithe).`);
    }
    // marées
    const el = ctx.el(idx);
    const th = tidalHeatingWm2({ Mp: pBody.mass * M_SUN_KG, R: b.radiusKm * 1000, a: el.a * AU_KM * 1000, e: el.e });
    crit.push({ label: 'Chauffage de marée', value: `${fmt(th, th < 0.01 ? 4 : 2)} W/m²`, status: th < 0.5 ? 'ok' : th < 3 ? 'warn' : 'bad', note: 'Terre ≈ 0,09 ; Io ≈ 2,4 (volcanisme)' });
    // éclipses
    const rr = pBody.radiusKm / (el.a * AU_KM);
    if (rr < 1) {
      crit.push({ label: 'Taille de ' + pBody.def.name + ' dans le ciel', value: `${fmt(2 * Math.asin(rr) / (Math.PI / 180), 1)}°`, status: 'info', note: `éclipse ≈ ${fmt(rr / Math.PI * 100, 1)} % de l'orbite ; jour = ${fmtDuree(el.period)} (rotation synchrone)` });
    }
  }
  // saisons
  const ratio = ((1 + eStar) / (1 - eStar)) ** 2 - 1;
  crit.push({ label: 'Variation de flux (saisons)', value: `${fmt(ratio * 100, 0)} %`, status: !surface ? 'info' : ratio < 0.25 ? 'ok' : ratio < 0.6 ? 'warn' : 'bad', note: `e = ${fmt(eStar, 3)} ; Terre 7 %, Mars 40 %` });
  // stabilité dynamique
  if (b.type === 'moon') {
    const rh = hillRadius(pEl.a, pEl.e, ctx.mEff[planetIdx], star.massMsun), lim = stableSatelliteLimit(rh, pEl.e, ctx.el(idx).e);
    const ok = ctx.el(idx).a < lim, rocheOk = ctx.el(idx).a * AU_KM > rocheLimitKm(pBody.radiusKm, bulk(pBody.mass, pBody.radiusKm).rho, bk.rho);
    crit.push({ label: 'Orbite stable (Hill / Roche)', value: ok && rocheOk ? 'oui' : 'non', status: ok && rocheOk ? 'ok' : 'bad', note: '' });
  }
  // verrouillage de marée par l'étoile
  if (b.type === 'planet') {
    const m = b.mass * M_SUN_KG, a = aStar * AU_KM * 1000, R = b.radiusKm * 1000;
    const w = 2 * Math.PI / ((ctx.prot(idx) || 1) * 86400);
    const t = 0.4 * w * a ** 6 * m * 100 / (3 * 6.674e-11 * (star.massMsun * M_SUN_KG) ** 2 * 0.3 * R ** 3) / (86400 * DAYS_PER_YEAR);
    crit.push({ label: 'Verrouillage par l\'étoile', value: t < 1e9 ? `< ${fmt(Math.max(t, 1) / 1e6, 1)} Myr (verrouillée/résonante)` : `${fmt(t / 1e9, 1)} Gyr`, status: 'info', note: 'Q = 100, k₂ = 0,3' });
  }
  if (surface) {
    const life = 10 * star.massMsun ** -2.5, rem = life - (star.ageGyr ?? 3);
    crit.push({ label: 'Étoile : durée restante', value: `${fmt(rem, 1)} Gyr (âge ${fmt(star.ageGyr ?? 3, 1)} / vie ${fmt(life, 1)})`, status: rem >= 2 ? 'ok' : rem >= 0.5 ? 'warn' : 'bad', note: 'biosphère complexe : ≥ ~2–4 Gyr' });
  }
  const bad = crit.filter((c) => c.status === 'bad').length, warn = crit.filter((c) => c.status === 'warn').length;
  const level = bad ? 'bad' : warn ? 'warn' : 'ok';
  const labels = surface
    ? { ok: 'Biosphère possible', warn: 'Surface limite : ajustements requis', bad: 'Surface invivable' }
    : station
      ? { ok: 'Base ou station viable', warn: 'Base ou station exigeante', bad: 'Base ou station non viable sans technologie lourde' }
      : { ok: 'Habitat protégé aisé', warn: 'Habitat protégé exigeant', bad: 'Habitat non viable sans technologie lourde' };
  return { mode: surface ? 'surface' : station ? 'station' : 'protege', level, label: labels[level], criteria: crit, suggestions: sugg, notes: [] };
}
