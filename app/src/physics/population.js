// Modèle de population et de dégel du système d'Omraon (années internes : 0 = présent du roman, affiché An 300 ; arrivée de l'arche en −560, affichée An −260).
// Calé sur les documents « Économie, théologie du travail et échelles » et « Chronologie » :
//  - une seule arche d'environ 10 000 personnes ; ~300 000 à 800 000 humains au présent (croissance ≈ 0,6–0,8 %/an) ;
//  - les Tyts partent de quelques milliers de pèlerins ; leur nombre est soit subi (croissance sous contrainte), soit géré (« produire » ou « réduire ») ;
//  - le contrôle ne tient que par la capacité de surveillance (savoir d'administration × humains ÷ Tyts) : le savoir se perd, le contrôle se délite (dégel) ;
//  - le verrou principal est le désespoir né du génocide du monde natal (−500), qui s'estompe lentement ;
//  - éveil, fraternisation et révoltes montent quand le contrôle faiblit et que le désespoir guérit ; au présent, le système est « à un point de bascule ».
// Les coefficients sont des paramètres de conception : le document donne les ordres de grandeur, pas les équations.

export const DEFAULTS = {
  arrivalYear: -560, crimeYear: -500, forgetStart: -300,
  N0: 10000, humansNow: 500000, T0: 4000,
  tytMode: 'gestion', tytRatio: 0.7, tytGrowth: 0.008, tytNatural: 0.005, tytAdjust: 0.15, cull: 0.004,
  knowledgeHalfLife: 220, controlNeeded: 1.04, despair0: 0.95, despairHalfLife: 460,
  awakeRate: 0.2, awakeSeed: 5e-5, revoltK: 0.02, guardShare: 0.08, fighterShare: 0.3,
  truthYear: 1e9, truthStrength: 0.6, endYear: 100,
  // Génocide du monde natal tyt (−500, hors système), très franc : le monde natal est vidé. Ne subsistent que trois petits groupes (conception : le canon ne chiffre rien),
  // assez nombreux pour refaire des générations sans consanguinité : les Tyts déjà sur Kebet (T0), des prisonniers de guerre (livrés au système, asservis avec eux) et ceux partis sur Terre.
  // Hybrides humain/Tyt (conception) : très rares, la plupart des grossesses n'aboutissent pas, les accouchements tuent souvent la mère, les enfants et les adultes meurent jeunes de leurs problèmes génétiques ; stérilité supposée.
  // Conceptions par an = hybridContact × √(H·T) / 1e6 (30 pour 1 M d'humains et 1 M de Tyts) ; part menée à terme, mortalité maternelle, survie de l'enfant jusqu'à l'âge adulte, mortalité annuelle des adultes.
  hybridContact: 30, hybridTerm: 0.4, maternalDeath: 0.15, hybridChild: 0.5, hybridMortality: 0.03,
  nativeN0: 30e6, warPrisoners: 2000, earthTyts: 1500, genocideYears: 0.5,
};

const LN2 = Math.LN2;
const smoothstep = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** Simule année par année de l'arrivée (−560) à `endYear`. Renvoie des séries et des résumés. */
export function simulatePopulation(p = {}) {
  const P = { ...DEFAULTS, ...p }, y0 = P.arrivalYear, n = Math.round(P.endYear - y0) + 1, dt = 0.25;
  const rH = Math.log(P.humansNow / P.N0) / (0 - y0);
  const S = { year: new Float64Array(n), H: new Float64Array(n), T: new Float64Array(n), K: new Float64Array(n), C: new Float64Array(n), D: new Float64Array(n), A: new Float64Array(n), ratio: new Float64Array(n), revolts: new Float64Array(n), fighters: new Float64Array(n), guards: new Float64Array(n), bascule: new Float64Array(n) };
  Object.assign(S, { Y: new Float64Array(n), hybConceptions: new Float64Array(n), hybBirths: new Float64Array(n), maternalDeaths: new Float64Array(n), cumMaternal: new Float64Array(n), cumHybrids: new Float64Array(n), N: new Float64Array(n), E: new Float64Array(n), births: new Float64Array(n), prevented: new Float64Array(n), reductions: new Float64Array(n), cumPrevented: new Float64Array(n), cumReductions: new Float64Array(n) });
  let H = P.N0, T = P.T0, A = 0, t = y0, i = 0, cumP = 0, cumR = 0, Y = 0, cumM = 0, cumY = 0;
  const hyb = (H_, T_) => { const c = P.hybridContact * Math.sqrt(H_ * T_) / 1e6, b = c * P.hybridTerm; return { c, b, m: b * P.maternalDeath }; };
  // monde natal : croissance naturelle, puis effondrement lissé sur `genocideYears` à partir de l'An du crime
  const natal = (y) => P.nativeN0 * Math.exp(P.tytNatural * (y - y0)) * (1 - smoothstep((y - P.crimeYear) / P.genocideYears));
  const terre = (y) => (y < P.crimeYear ? 0 : P.earthTyts * Math.exp(P.tytNatural * (y - P.crimeYear))); // survivants partis sur Terre : hors système
  // flux annuels de Tyts du système : naissances décidées, naissances empêchées (potentiel naturel retenu par les humains), Tyts éliminés (« réduire »)
  const flows = (y, H_, T_, A_) => {
    if (y < P.crimeYear) return { b: P.tytNatural * T_, p: 0, r: 0 };
    if (P.tytMode === 'nature') return { b: P.tytGrowth * T_, p: 0, r: 0 };
    const gap = P.tytAdjust * (P.tytRatio * H_ - T_), b = Math.max(0, gap);
    return { b, p: Math.max(0, P.tytGrowth * T_ - b), r: P.cull * A_ * T_ + Math.max(0, -gap) };
  };
  const know = (y) => (y < P.forgetStart ? 1 : Math.exp(-(y - P.forgetStart) * LN2 / P.knowledgeHalfLife));
  const despair = (y) => {
    let d = y < P.crimeYear ? 0 : P.despair0 * Math.exp(-(y - P.crimeYear) * LN2 / P.despairHalfLife);
    if (y >= P.truthYear) d *= 1 - P.truthStrength * smoothstep((y - P.truthYear) / 3); // la vérité rapportée rend l'espérance
    return d;
  };
  const control = (y, H_, T_) => (y < P.crimeYear ? 1 : Math.min(1, (know(y) * H_ / Math.max(T_, 1)) / P.controlNeeded));
  let seeded = false;
  const record = () => {
    const Kk = know(t), C = control(t, H, T), D = despair(t), guards = Kk * H * P.guardShare, fighters = A * T * P.fighterShare;
    S.year[i] = t; S.H[i] = H; S.T[i] = T; S.K[i] = Kk; S.C[i] = C; S.D[i] = D; S.A[i] = A; S.ratio[i] = T / Math.max(H, 1);
    const F = flows(t, H, T, A); const Hy = hyb(H, T); S.Y[i] = Y; S.hybConceptions[i] = Hy.c; S.hybBirths[i] = Hy.b; S.maternalDeaths[i] = Hy.m; S.cumMaternal[i] = cumM; S.cumHybrids[i] = cumY; S.N[i] = natal(t); S.E[i] = terre(t); S.births[i] = F.b; S.prevented[i] = F.p; S.reductions[i] = F.r; S.cumPrevented[i] = cumP; S.cumReductions[i] = cumR;
    S.revolts[i] = P.revoltK * A * (1 - C) * T / 1000; S.guards[i] = guards; S.fighters[i] = fighters; S.bascule[i] = fighters / Math.max(guards, 1);
  };
  record();
  for (i = 1; i < n; i++) {
    for (let k = 0; k < 1 / dt; k++) {
      const C = control(t, H, T), D = despair(t);
      const F = flows(t, H, T, A); cumP += F.p * dt; cumR += F.r * dt;
      const Hy = hyb(H, T); Y += (Hy.b * P.hybridChild - P.hybridMortality * Y) * dt; cumM += Hy.m * dt; cumY += Hy.b * dt;
      H += H * rH * dt;
      if (t < P.crimeYear && t + dt >= P.crimeYear) T += P.warPrisoners; // les prisonniers de guerre arrivent au crime
      if (t < P.crimeYear) T += T * P.tytNatural * dt;
      else if (P.tytMode === 'nature') T += T * P.tytGrowth * dt;
      else T += (P.tytAdjust * (P.tytRatio * H - T) - P.cull * A * T) * dt; // gestion : on « produit » vers le ratio visé, on « réduit » si l'éveil inquiète
      // éveil : logistique freinée par le contrôle et le désespoir, avec une graine (rumeurs, cristaux, contacts)
      A += (P.awakeRate * (1 - C) * (1 - 0.8 * D) * A * (1 - A) + P.awakeSeed * (1 - C) * (1 - A)) * dt;
      if (t >= P.truthYear && !seeded) { A = Math.min(1, A + 0.05 * P.truthStrength); seeded = true; }
      t += dt;
    }
    t = y0 + i; record();
  }
  const at = (year) => { const f = Math.min(n - 1, Math.max(0, year - y0)), a = Math.floor(f), b = Math.min(n - 1, a + 1), u = f - a, o = { year }; for (const k of Object.keys(S)) if (k !== 'year') o[k] = S[k][a] + (S[k][b] - S[k][a]) * u; o.arrived = year >= y0; return o; };
  const firstYear = (fn) => { for (let j = 0; j < n; j++) if (fn(j)) return S.year[j]; return null; };
  const now = at(0);
  return {
    params: P, series: S, at, growth: rH,
    summary: {
      humansNow: now.H, tytsNow: now.T, ratioNow: now.ratio, controlNow: now.C, awakeNow: now.A, revoltsNow: now.revolts, basculeNow: now.bascule, despairNow: now.D,
      thawYear: firstYear((j) => S.year[j] >= P.crimeYear && S.C[j] < 0.98), thawHalf: firstYear((j) => S.year[j] >= P.crimeYear && S.C[j] < 0.5),
      genocide: { year: P.crimeYear, victims: P.nativeN0 * Math.exp(P.tytNatural * (P.crimeYear - y0)), kebet: P.T0 * Math.exp(P.tytNatural * (P.crimeYear - y0)), prisoners: P.warPrisoners, earth: P.earthTyts },
      preventedByNow: now.cumPrevented, reductionsByNow: now.cumReductions,
      tippingYear: firstYear((j) => S.year[j] >= P.crimeYear && S.bascule[j] >= 1), canonHumans: now.H >= 3e5 && now.H <= 8e5, hybridsNow: now.Y, maternalByNow: now.cumMaternal,
    },
  };
}
