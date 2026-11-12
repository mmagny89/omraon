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
  tytMode: 'gestion', tytRatio: 1.2, tytGrowth: 0.008, tytNatural: 0.005, tytAdjust: 0.15, cull: 0.004,
  knowledgeHalfLife: 220, controlNeeded: 0.6, despair0: 0.95, despairHalfLife: 460,
  awakeRate: 0.2, awakeSeed: 5e-5, revoltK: 0.02, guardShare: 0.08, fighterShare: 0.3,
  truthYear: 1e9, truthStrength: 0.6, endYear: 100,
  // Génocide du monde natal tyt (−500, hors système). Effectif et part exterminée : conception (le canon ne chiffre rien).
  nativeN0: 30e6, genocideToll: 0.99, genocideYears: 3,
};

const LN2 = Math.LN2;
const smoothstep = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** Simule année par année de l'arrivée (−560) à `endYear`. Renvoie des séries et des résumés. */
export function simulatePopulation(p = {}) {
  const P = { ...DEFAULTS, ...p }, y0 = P.arrivalYear, n = Math.round(P.endYear - y0) + 1, dt = 0.25;
  const rH = Math.log(P.humansNow / P.N0) / (0 - y0);
  const S = { year: new Float64Array(n), H: new Float64Array(n), T: new Float64Array(n), K: new Float64Array(n), C: new Float64Array(n), D: new Float64Array(n), A: new Float64Array(n), ratio: new Float64Array(n), revolts: new Float64Array(n), fighters: new Float64Array(n), guards: new Float64Array(n), bascule: new Float64Array(n) };
  Object.assign(S, { N: new Float64Array(n), births: new Float64Array(n), prevented: new Float64Array(n), reductions: new Float64Array(n), cumPrevented: new Float64Array(n), cumReductions: new Float64Array(n) });
  let H = P.N0, T = P.T0, A = 0, t = y0, i = 0, cumP = 0, cumR = 0;
  // monde natal : croissance naturelle, puis effondrement lissé sur `genocideYears` à partir de l'An du crime
  const natal = (y) => P.nativeN0 * Math.exp(P.tytNatural * (y - y0)) * (1 - P.genocideToll * smoothstep((y - P.crimeYear) / P.genocideYears));
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
    const F = flows(t, H, T, A); S.N[i] = natal(t); S.births[i] = F.b; S.prevented[i] = F.p; S.reductions[i] = F.r; S.cumPrevented[i] = cumP; S.cumReductions[i] = cumR;
    S.revolts[i] = P.revoltK * A * (1 - C) * T / 1000; S.guards[i] = guards; S.fighters[i] = fighters; S.bascule[i] = fighters / Math.max(guards, 1);
  };
  record();
  for (i = 1; i < n; i++) {
    for (let k = 0; k < 1 / dt; k++) {
      const C = control(t, H, T), D = despair(t);
      const F = flows(t, H, T, A); cumP += F.p * dt; cumR += F.r * dt;
      H += H * rH * dt;
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
      genocide: { year: P.crimeYear, victims: natal(P.crimeYear - 1e-9) * P.genocideToll, survivors: P.nativeN0 * Math.exp(P.tytNatural * (P.crimeYear + P.genocideYears - y0)) * (1 - P.genocideToll) },
      preventedByNow: now.cumPrevented, reductionsByNow: now.cumReductions,
      tippingYear: firstYear((j) => S.year[j] >= P.crimeYear && S.bascule[j] >= 1), canonHumans: now.H >= 3e5 && now.H <= 8e5, canonRatio: now.ratio > 1,
    },
  };
}
