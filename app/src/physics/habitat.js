import { equilibriumTemp, bulk, starLuminosity } from './derived.js';
import { doseRemPerDay } from './habitability.js';
import { AU_KM, R_JUP_KM } from './constants.js';

const SIGMA = 5.670374e-8, T_HAB = 293; // K
export const PERSON = { internalKW: 1.5, baselineKW: 2.0, leakWperK: 5, hydroponicKW: 6, o2: 0.84, co2: 1.0, water: 0.1, food: 0.62, spinTonnes: 20 };
const DOSE_TARGET = 0.2; // mSv/jour visé à l'intérieur de l'habitat
const fmt = (x, d = 1) => (!Number.isFinite(x) ? '—' : Math.abs(x) >= 1e5 || (Math.abs(x) < 0.01 && x !== 0) ? x.toExponential(1) : x.toFixed(d));

/** Épaisseur (g/cm²) de protection pour ramener une dose à la cible : RCG (pénétrant) + ceintures de radiation (mou). */
export function shieldingGcm2(gcr, belt, target = DOSE_TARGET) {
  const dose = (x) => gcr * Math.exp(-x / 300) + belt * Math.exp(-x / 15);
  if (dose(0) <= target) return 0;
  let lo = 0, hi = 5000;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (dose(m) > target) lo = m; else hi = m; }
  return hi;
}

/** Chauffage ou climatisation (W électriques par personne) pour tenir 293 K dans une enveloppe isolée. */
export function thermalPowerPerPerson(Tenv) {
  const leak = PERSON.leakWperK * (Tenv - T_HAB), load = PERSON.internalKW * 1000 + Math.max(0, leak);
  if (Tenv > T_HAB) { const cop = Math.min(10, 0.4 * T_HAB / (Tenv - T_HAB)); return { cooling: load / cop, heating: 0 }; }
  return { cooling: 0, heating: Math.max(0, -leak - PERSON.internalKW * 1000) };
}

/** Rapport complet d'un site : environnement, thermique, rayonnement, énergie, vie, structure. */
export function siteReport(ctx, site, st, t) {
  const sim = ctx.sim, star = sim.bodies[0].def, L = starLuminosity(star), sp = sim.rPos;
  const dStar = Math.hypot(st.pos[0] - sp[0], st.pos[1] - sp[1], st.pos[2] - sp[2]);
  const S = L / (dStar * dStar), flux = 1361 * S;
  const body = site.type === 'heliocentric' ? null : sim.bodies[st.idx];
  const d = body?.def || {};
  const albedo = d.albedo ?? 0.15;
  const gasParent = body && body.type === 'moon' && sim.bodies[body.parent].def.kind === 'gas' ? sim.bodies[body.parent] : null;
  const eclFrac = gasParent ? Math.asin(Math.min(1, gasParent.radiusKm / (ctx.el(body.idx).a * AU_KM))) / Math.PI : 0;
  const Teq = equilibriumTemp(star, dStar, albedo) * Math.pow(1 - eclFrac, 0.25);
  const hab = d.habitat || {}, P = hab.pressureBar ?? 0, atm = P >= 0.3;
  const parent = body && body.type === 'moon' ? sim.bodies[body.parent] : null;
  const sections = [], notes = [];
  const sec = (title, rows) => sections.push({ title, rows });

  // --- Environnement ---
  const env = [['Distance à l\'étoile', `${fmt(dStar, 3)} UA`], ['Éclairement', `${fmt(S, 2)} × Terre (${fmt(flux, 0)} W/m²)`]];
  let Tenv = Teq, gcr, belt = 0, g = 0;
  const sunDir = [0, 1, 2].map((k) => sp[k] - st.pos[k]), sl = Math.hypot(...sunDir); sunDir.forEach((_, k) => (sunDir[k] /= sl));
  if (site.type === 'surface') {
    const cosz = st.normal[0] * sunDir[0] + st.normal[1] * sunDir[1] + st.normal[2] * sunDir[2];
    const elev = Math.asin(Math.max(-1, Math.min(1, cosz))) / (Math.PI / 180), la = Math.abs(site.lat) * Math.PI / 180;
    env.push(['Soleil', cosz > 0 ? `jour, élévation ${fmt(elev, 0)}°` : `nuit (${fmt(-elev, 0)}° sous l'horizon)`]);
    g = bulk(body.mass, body.radiusKm).gSurf / 9.80665;
    if (atm) {
      const Tmean = Teq + (hab.greenhouseK ?? 0) - 30 * Math.sin(la) ** 2;
      env.push(['Température au sol (moyenne)', `${fmt(Tmean, 0)} K (${fmt(Tmean - 273.15, 0)} °C)`]);
      Tenv = Tmean; gcr = 0.007 * P;
    } else {
      const Tmean = Teq * Math.pow(Math.max(Math.cos(la), 0.3), 0.25);
      const Tnow = cosz > 0 ? Math.max(0.35 * Teq, Teq * Math.SQRT2 * Math.pow(cosz, 0.25)) : 0.35 * Teq;
      env.push(['Température au sol, maintenant', `${fmt(Tnow, 0)} K (${fmt(Tnow - 273.15, 0)} °C)`], ['Température moyenne (sous-sol)', `${fmt(Tmean, 0)} K (${fmt(Tmean - 273.15, 0)} °C)`]);
      Tenv = site.habitat === 'dome' ? Teq : Tmean; gcr = 0.65;
    }
    env.push(['Gravité', `${fmt(g, g < 0.1 ? 3 : 2)} g`]);
  } else if (site.type === 'orbit' && site.fixe) {
    // station tenue en place au-dessus d'un point : pas de période orbitale ; la poussée qui l'y maintient fait le poids des occupants
    const gl = (bulk(body.mass, body.radiusKm).gSurf / 9.80665) * (body.radiusKm / st.radiusKm) ** 2;
    env.push(['Maintien en place', `poussée continue ≈ ${fmt(gl, 2)} g`], ['Éclipse par ' + d.name, 'la moitié du jour (nuit sous la station)']);
    Tenv = Teq; gcr = 1.8; g = gl;
    env.push(['Gravité', `${fmt(gl, 2)} g (la poussée fait le poids)`]);
  } else if (site.type === 'orbit') {
    const R = body.radiusKm, a = st.radiusKm, ecl = R / a < 1 ? Math.asin(R / a) / Math.PI : 0;
    env.push(['Période orbitale', `${fmt(st.orbitalPeriod * 24, 2)} h`], ['Éclipse par ' + d.name, `≈ ${fmt(ecl * 100, 0)} % de l'orbite (${fmt(ecl * st.orbitalPeriod * 24 * 60, 0)} min)`]);
    if (parent) { const ep = Math.asin(Math.min(1, parent.radiusKm / (ctx.el(parent.idx === 0 ? 0 : body.idx)?.a * AU_KM || 1e12))) / Math.PI; void ep; }
    Tenv = Teq; gcr = 1.8; g = 0;
    env.push(['Gravité', 'microgravité']);
  } else if (site.type === 'floating') {
    const T1 = (hab.internalHeat ?? 1.5) * Teq;
    env.push(['Niveau', '1 bar'], ['Température ambiante', `${fmt(T1, 0)} K (${fmt(T1 - 273.15, 0)} °C)`], ['Gravité', `${fmt(bulk(body.mass, body.radiusKm).gSurf / 9.80665, 2)} g`]);
    Tenv = T1; gcr = 0.02; g = bulk(body.mass, body.radiusKm).gSurf / 9.80665;
  } else {
    env.push(['Gravité', 'microgravité (astéroïde)']);
    Tenv = Teq; gcr = 1.8;
  }
  // rayonnement piégé des géantes
  if (parent && parent.def.kind === 'gas') {
    const el = ctx.el(body.idx), rEff = el.a * AU_KM / parent.radiusKm;
    belt = doseRemPerDay(rEff, parent.def.habitat?.magnetosphere ?? 1) * 10;
  }
  if (site.type === 'surface' && P > 0 && P < 0.3) notes.push(`Atmosphère ténue (${fmt(P, 2)} bar, non respirable) : vents et poussière, grandes amplitudes jour/nuit — cohérent avec « Quotidien sensoriel ».`);
  sec('Environnement', env);

  // --- Thermique ---
  const th = thermalPowerPerPerson(Tenv), rows = [['Température extérieure (habitat)', `${fmt(Tenv, 0)} K`]];
  if (site.type === 'orbit' || site.type === 'heliocentric') {
    const rad = PERSON.internalKW * 1000 / (2 * 0.9 * SIGMA * 300 ** 4);
    rows.push(['Radiateurs', `≈ ${fmt(rad, 1)} m² par habitant (à 300 K)`]);
    if (site.type === 'heliocentric') rows.push(['Chauffage / froid', `${fmt(th.cooling + th.heating, 0)} W par habitant`]);
  } else {
    rows.push([th.cooling > 0 ? 'Climatisation (pompe à chaleur)' : 'Chauffage', `${fmt((th.cooling + th.heating) / 1000, 2)} kW par habitant`]);
    if (Tenv > 600) notes.push('Au-delà de ~600 K, les matériaux courants (plomb, soudures, polymères) lâchent : habitat très profond ou refroidi par liquide.');
  }
  if (site.habitat === 'underground' && site.type === 'surface' && !atm) rows.push(['Profondeur', `~10 m suffisent pour lisser le cycle jour/nuit (sous-sol ≈ ${fmt(Tenv, 0)} K)`]);
  sec('Thermique', rows);

  // --- Rayonnement ---
  const x = shieldingGcm2(gcr, belt), regolith = x / 150, water = x / 100;
  sec('Rayonnement', [
    ['Rayons cosmiques', `${fmt(gcr, 2)} mSv/j`], ['Ceintures de la géante', belt > 0 ? `${fmt(belt, 1)} mSv/j` : 'aucune'],
    ['Blindage pour ' + DOSE_TARGET + ' mSv/j', x === 0 ? 'inutile' : `${fmt(x, 0)} g/cm² ≈ ${fmt(regolith, 1)} m de régolithe ou ${fmt(water, 1)} m d'eau`],
  ]);

  // --- Énergie ---
  const pop = (site.population || 0) + (site.tyts || 0), perKW = PERSON.baselineKW + (th.cooling + th.heating) / 1000;
  const sunAvg = site.type === 'surface' ? flux / Math.PI : flux, area = perKW * 1000 / (0.25 * sunAvg);
  const uKg = perKW * 1000 * 3.156e7 / (8.2e13 * 0.33);
  sec('Énergie', [
    ['Besoin par habitant', `${fmt(perKW, 1)} kW (base ${PERSON.baselineKW} kW)`], ['Besoin du site', `${fmt(pop * perKW / 1000, 1)} MW`],
    ['Solaire (rendement 25 %)', `${fmt(area, 0)} m² par habitant${site.type === 'surface' ? ' + stockage nocturne' : ''}`],
    ['Fission', `${fmt(uKg, 2)} kg d'uranium par habitant et par an`],
  ]);
  if (area > 5000) notes.push('Le solaire est irréaliste ici : énergie nucléaire.');

  // --- Vie ---
  sec('Vie (' + pop.toLocaleString('fr-FR') + ' habitants' + (site.tyts ? ', dont ' + site.tyts.toLocaleString('fr-FR') + ' Tyts' : '') + ')', [
    ['Oxygène', `${fmt(pop * PERSON.o2 / 1000, 1)} t/jour`], ['Eau (pertes après recyclage 98 %)', `${fmt(pop * PERSON.water / 1000, 1)} t/jour`],
    ['Nourriture sèche', `${fmt(pop * PERSON.food / 1000, 1)} t/jour`],
    ['Autosuffisance alimentaire', `+${PERSON.hydroponicKW} kW par habitant (éclairage des cultures)`],
  ]);

  // --- Structure ---
  const struct = [];
  if ((site.type === 'orbit' && !site.fixe) || site.type === 'heliocentric') struct.push(['Gravité artificielle', `rayon ≈ ${fmt(9.80665 / (2 * Math.PI * 2 / 60) ** 2, 0)} m pour 1 g à 2 tr/min`]);
  if (site.type === 'surface' && g > 0 && g < 0.1) struct.push(['Gravité artificielle', `${fmt(g * 1000, 1)} mg au sol : rotation ou séjours courts`]);
  if (site.type === 'floating') {
    const T1 = Tenv, rho = (P || 1) * 1e5 * 0.0023 / (8.314 * T1), Tin = 330, lift = rho * (1 - T1 / Tin), vol = PERSON.spinTonnes * 1000 / Math.max(lift, 1e-6);
    struct.push(['Portance', `${fmt(lift, 3)} kg/m³ d'hydrogène chaud (330 K) dans ${fmt(rho, 2)} kg/m³ ambiants`], ['Enveloppe', `${fmt(vol, 0)} m³ par habitant (${PERSON.spinTonnes} t) → ${fmt(vol * pop / 1e9, 1)} km³ pour le site`]);
    notes.push("Dans une atmosphère d'hydrogène, l'air respirable est plus lourd que le gaz ambiant : une cité ne flotte que portée par une enveloppe d'hydrogène chauffé.");
    if (T1 > Tin) notes.push("Ici l'atmosphère est plus chaude que l'enveloppe : aucune portance sans la chauffer davantage.");
  }
  if (struct.length) sec('Structure', struct);
  return { sections, notes, derived: { dStar, Tenv, belt, gcr, perKW } };
}
void R_JUP_KM;
