// Économie du système, modèle simple et déterministe (pas d'aléa) : stocks, prix par rareté, transporteurs qui arbitrent.
// Sans DOM, sans Three.js. Données et réglages : data/economie.js (tout y est de la conception).
//
// Boucle quotidienne : 1. chaque site produit (au prorata de sa main-d'œuvre tyt) et consomme ; 2. les convois arrivés vendent
// (prix au stock réel d'alors) ; 3. chaque convoi à quai choisit le trajet (marchandise × destination) au meilleur profit par jour,
// achète, paie carburant et péage, et part. Le temps de vol vient de `flight.js` (hyperpropulsion).
// Argent : un grand livre fermé. Chaque site a un solde, chaque convoi une caisse ; un échange déplace de l'argent, rien n'en crée
// (voir `masseMonetaire`, testée constante). Limites : les distances sont figées à la date des positions fournies ; le carburant des vaisseaux est pris à la raffinerie (Roushan), pas au quai de départ.
import { planFlight } from './flight.js';
import { AU_KM, DAYS_PER_YEAR } from './constants.js';
import { MARCHANDISES, CONSO_HABITANT, CONSO_LUXE, PROFILS, TRANSPORTEURS, REGLAGES } from '../data/economie.js';

const AU_M = AU_KM * 1000;
const RESERVE_TYTS = 1; // jamais sous la main-d'œuvre requise : on n'exporte que le surplus

/** Distances en UA entre deux sites, à partir de leurs positions (Map id → [x, y, z], UA). */
export const distanceDepuis = (pos) => (a, b) => { const p = pos.get(a), q = pos.get(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };

/** Durée d'un vol en jours (hyperpropulsion 0,95 c, repos moteur au-delà de 6 jours de poussée). */
export const tempsVol = (dUA, aG, vmax = 0.95) => planFlight(Math.max(dUA * AU_M, 1), aG, vmax).total / 86400;

/** Consommation par jour d'une marchandise sur un site : habitants, Tyts, luxe de l'élite, besoins industriels. */
export function besoinJour(site, profil, g) {
  if (g === 'tyts') return 0;
  let n = site.population * (CONSO_HABITANT.humain[g] ?? 0) + site.tyts * (CONSO_HABITANT.tyt[g] ?? 0);
  if (g === 'luxe') n = site.population * (CONSO_LUXE[site.id] ?? 0);
  return n + (profil.conso?.[g] ?? 0);
}

/**
 * Événements datés : { type, de, duree, cible, valeur } en jours depuis le début de la simulation.
 *  'blocus'    cible = id de site : aucun convoi n'y arrive ni n'en part ;
 *  'piraterie' cible = id de site, valeur = part de la cargaison perdue (0–1) sur tout voyage qui en part ou y arrive ;
 *  'greve'     cible = faction ('consortium', 'libre', 'contrebande') : ses convois restent à quai ;
 *  'peage'     valeur = multiplicateur du péage de l'octroi.
 */
export function creerEconomie({ sites, dist, profils = PROFILS, marchandises = MARCHANDISES, transporteurs = TRANSPORTEURS, reglages = REGLAGES, evenements = [] }) {
  const biens = new Map(marchandises.map((m) => [m.id, m]));
  const noeuds = new Map();
  for (const site of sites) {
    const profil = profils[site.id] ?? { prod: {}, tytsRequis: 0, zone: 'exterieur' };
    const cible = {}, stock = {}, besoin = {};
    for (const m of marchandises) {
      besoin[m.id] = besoinJour(site, profil, m.id);
      cible[m.id] = m.id === 'tyts' ? (profil.tytsRequis ?? 0) : reglages.joursCible * Math.max(besoin[m.id], profil.prod[m.id] ?? 0);
      stock[m.id] = m.id === 'tyts' ? site.tyts : cible[m.id];
    }
    noeuds.set(site.id, { site, profil, cible, stock, besoin, solde: 0, penurie: {}, enRoute: {} });
  }
  const convois = transporteurs.filter((c) => noeuds.has(c.base)).map((def) => ({ def, caisse: def.caisse, lieu: def.base, dispo: 0, voyage: null, gain: 0, voyages: 0 }));
  const vols = new Map();
  const duree = (a, b, aG) => { const k = `${a}|${b}|${aG}`; if (!vols.has(k)) vols.set(k, tempsVol(dist(a, b), aG)); return vols.get(k); };
  // Avitaillement : les vaisseaux prennent leur carburant aux raffineries (le site qui en produit le plus), à leur prix, quel que soit le quai.
  const raffinerie = [...noeuds.values()].sort((a, b) => (b.profil.prod.carburant ?? 0) - (a.profil.prod.carburant ?? 0))[0];
  return {
    t: 0, evenements, actifs: [], raffinerie, octroi: [...noeuds.values()].find((n) => n.profil.peage), noeuds, convois, biens, reglages, dist, duree, journal: [], flux: new Map(), taxes: {}, transporte: {},
    masseInitiale: convois.reduce((s, c) => s + c.caisse, 0),
  };
}

/** Prix unitaire d'une marchandise sur un site au niveau de stock donné ; null si le site n'est pas un marché pour elle. */
export function prixAuStock(etat, noeud, g, stock) {
  const cible = noeud.cible[g];
  if (!(cible > 0)) return null;
  const r = etat.reglages;
  const ratio = cible / Math.max(stock, cible * 0.02);
  return etat.biens.get(g).prixBase * Math.min(r.prixMax, Math.max(r.prixMin, ratio ** r.elasticite));
}
export const prix = (etat, siteId, g) => { const n = etat.noeuds.get(siteId); return prixAuStock(etat, n, g, n.stock[g]); };

// Prix moyen payé (sens = -1, achat : le stock baisse) ou reçu (sens = +1, vente : le stock monte) pour q unités : le prix bouge pendant l'échange.
function valeurEchange(etat, noeud, g, stock0, q, sens) {
  const n = etat.reglages.tranches; let v = 0;
  for (let i = 0; i < n; i++) v += (prixAuStock(etat, noeud, g, stock0 + sens * ((i + 0.5) * q) / n) ?? 0) * q / n;
  return v;
}

function livrer(etat, c) {
  const v = c.voyage, n = etat.noeuds.get(v.to);
  for (const x of v.cargo) {
    const brut = valeurEchange(etat, n, x.g, n.stock[x.g], x.qLivree, +1);
    const taxe = v.contrebande ? 0 : brut * (n.profil.taxe ?? 0), net = brut - taxe;
    n.stock[x.g] += x.qLivree; n.enRoute[x.g] -= x.qLivree;
    n.solde -= net; c.caisse += net;
    etat.taxes[v.to] = (etat.taxes[v.to] ?? 0) + taxe;
    etat.transporte[x.g] = (etat.transporte[x.g] ?? 0) + x.qLivree;
    const k = `${v.from}|${v.to}|${x.g}`; etat.flux.set(k, (etat.flux.get(k) ?? 0) + x.qLivree);
    c.gain += net;
  }
  c.gain -= v.depense; c.voyages++;
  c.lieu = v.to; c.dispo = v.tArr + etat.reglages.escaleJours; c.voyage = null;
}

/**
 * Meilleure cargaison (plusieurs marchandises possibles) et meilleure destination pour le convoi `c` supposé à quai en `lieu`.
 * Pour chaque destination : on remplit la soute en commençant par la marchandise qui rapporte le plus par unité de volume,
 * on n'ajoute une marchandise que si elle rapporte net (achat, péage compris), et on essaie la soute pleine, à moitié, au quart.
 * Ne modifie rien.
 */
function meilleur(etat, c, lieu) {
  const r = etat.reglages, { def } = c, src = etat.noeuds.get(lieu), contrebande = def.faction === 'contrebande';
  const octroi = etat.octroi, raff = etat.raffinerie, dispo = {}, pSrc = {}, ev = etat.actifs;
  if (ev.some((e) => e.type === 'blocus' && e.cible === lieu)) return null;
  const multPeage = ev.filter((e) => e.type === 'peage').reduce((m, e) => m * (e.valeur ?? 1), 1);
  for (const g of etat.biens.keys()) {
    const d = src.stock[g] - (g === 'tyts' ? RESERVE_TYTS : r.reserve) * src.cible[g], p = prix(etat, lieu, g);
    if (d > 0 && p != null) { dispo[g] = d; pSrc[g] = p; }
  }
  const goods = Object.keys(dispo);
  if (!goods.length) return null;
  let best = null;
  for (const [idD, nd] of etat.noeuds) {
    if (idD === lieu || ev.some((e) => e.type === 'blocus' && e.cible === idD)) continue;
    const pirates = 1 - ev.filter((e) => e.type === 'piraterie' && (e.cible === lieu || e.cible === idD)).reduce((m, e) => m * (1 - (e.valeur ?? 0.2)), 1);
    const pD = {}, cand = goods.filter((g) => { if (!(nd.cible[g] > 0)) return false; pD[g] = prixAuStock(etat, nd, g, nd.stock[g] + (nd.enRoute[g] ?? 0)); return pD[g] > pSrc[g]; }); // élagage : jamais rentable sinon
    if (!cand.length) continue;
    cand.sort((x, y) => (pD[y] - pSrc[y]) / etat.biens.get(y).volume - (pD[x] - pSrc[x]) / etat.biens.get(x).volume);
    const d = etat.duree(lieu, idD, def.aG), vol = d + r.escaleJours, tauxPeage = !contrebande && octroi && src.profil.zone !== nd.profil.zone && (src.profil.zone === 'interieur' || nd.profil.zone === 'interieur') ? octroi.profil.peage * multPeage : 0;
    const taxeD = contrebande ? 0 : nd.profil.taxe ?? 0;
    for (const f of [1, 0.5, 0.25]) {
      let reste = def.soute * f, utilise = 0, achatT = 0, netT = 0; const cargo = [];
      for (const g of cand) {
        if (reste <= 1e-9) break;
        const bien = etat.biens.get(g), q = Math.min(reste / bien.volume, dispo[g]);
        if (!(q > 0)) continue;
        const achat = valeurEchange(etat, src, g, src.stock[g], q, -1), qLivree = (contrebande ? q * (1 - (def.risque ?? 0)) : q) * (1 - pirates);
        const net = valeurEchange(etat, nd, g, nd.stock[g] + (nd.enRoute[g] ?? 0), qLivree, +1) * (1 - taxeD);
        if (net <= achat * (1 + tauxPeage)) continue;
        cargo.push({ g, q, qLivree, achat }); reste -= q * bien.volume; utilise += q * bien.volume; achatT += achat; netT += net;
      }
      if (!cargo.length) continue;
      const carb = d * def.soute * (r.carburantVide + r.carburantParJour * utilise / def.soute);
      const retenu = raff === src ? cargo.find((x) => x.g === 'carburant')?.q ?? 0 : 0, stockRaff = raff.stock.carburant - retenu;
      if (stockRaff < carb || carb > raff.stock.carburant * 0.2) continue;
      const fuel = valeurEchange(etat, raff, 'carburant', stockRaff, carb, -1), peage = achatT * tauxPeage;
      if (achatT + fuel + peage > c.caisse) continue;
      const profit = netT - achatT - fuel - peage;
      if (profit > r.profitMin && (!best || profit / vol > best.score)) best = { idD, d, cargo, achat: achatT, fuel, peage, carb, profit, score: profit / vol };
    }
  }
  return best;
}

function partir(etat, c, o) {
  const { def } = c, src = etat.noeuds.get(c.lieu), raff = etat.raffinerie, octroi = etat.octroi;
  const { idD, d, cargo, achat, fuel, peage, carb } = o, dest = etat.noeuds.get(idD);
  for (const x of cargo) { src.stock[x.g] -= x.q; dest.enRoute[x.g] = (dest.enRoute[x.g] ?? 0) + x.qLivree; }
  src.solde += achat;
  raff.stock.carburant -= carb; raff.solde += fuel;
  if (peage) { octroi.solde += peage; etat.taxes[octroi.site.id] = (etat.taxes[octroi.site.id] ?? 0) + peage; }
  c.caisse -= achat + fuel + peage;
  c.voyage = { from: c.lieu, to: idD, cargo, contrebande: def.faction === 'contrebande', tDep: etat.t, tArr: etat.t + d, depense: achat + fuel + peage };
  const grand = cargo.reduce((m, x) => (!m || x.q * etat.biens.get(x.g).volume > m.q * etat.biens.get(m.g).volume ? x : m), null);
  if (etat.journal.length < 20000) etat.journal.push({ t: etat.t, tArr: etat.t + d, convoi: def.id, from: c.lieu, to: idD, g: grand?.g ?? null, q: grand?.q, cargo: cargo.map((x) => ({ g: x.g, q: x.q })), jours: d, contrebande: def.faction === 'contrebande' });
}

function choisir(etat, c) {
  if (etat.actifs.some((e) => (e.type === 'greve' && e.cible === c.def.faction) || (e.type === 'blocus' && e.cible === c.lieu))) { c.dispo = etat.t + 1; return; } // grève, ou convoi retenu par un blocus
  const best = meilleur(etat, c, c.lieu);
  if (best) return partir(etat, c, best);
  // Rien à gagner ici : repositionnement à vide vers le quai d'où le meilleur trajet, net du voyage à vide, rapporte le plus.
  const r = etat.reglages, { def } = c, raff = etat.raffinerie;
  let pick = null;
  for (const idX of etat.noeuds.keys()) {
    if (idX === c.lieu || etat.actifs.some((e) => e.type === 'blocus' && e.cible === idX)) continue;
    const d = etat.duree(c.lieu, idX, def.aG), carb = d * def.soute * r.carburantVide;
    if (raff.stock.carburant < carb) continue;
    const fuel = valeurEchange(etat, raff, 'carburant', raff.stock.carburant, carb, -1);
    const o = meilleur(etat, c, idX);
    if (!o || o.profit - fuel <= r.profitMin || fuel > c.caisse) continue;
    const score = (o.profit - fuel) / (d + o.d + 2 * r.escaleJours);
    if (!pick || score > pick.score) pick = { score, idX, d, carb, fuel };
  }
  if (pick) return partir(etat, c, { cargo: [], idD: pick.idX, d: pick.d, achat: 0, fuel: pick.fuel, peage: 0, carb: pick.carb });
  c.dispo = etat.t + 2; // rien nulle part : on réessaie dans deux jours
}

/** Avance l'économie d'un jour. */
function jour(etat) {
  const t1 = etat.t + 1;
  etat.actifs = etat.evenements.filter((e) => etat.t >= e.de && etat.t < e.de + e.duree);
  for (const n of etat.noeuds.values()) {
    const req = n.profil.tytsRequis ?? 0, lambda = req > 0 ? Math.min(1, n.stock.tyts / req) : 1;
    for (const g of etat.biens.keys()) {
      if (g === 'tyts') { n.stock.tyts = Math.max(0, n.stock.tyts * (1 + (n.profil.tytsAn ?? 0) / DAYS_PER_YEAR)); continue; }
      n.stock[g] = Math.min(n.cible[g] * 10 || Infinity, n.stock[g] + (n.profil.prod[g] ?? 0) * lambda);
      const need = n.besoin[g];
      if (need > 0) {
        if (n.stock[g] >= need) n.stock[g] -= need;
        else { n.penurie[g] = (n.penurie[g] ?? 0) + 1 - n.stock[g] / need; n.stock[g] = 0; }
      }
    }
  }
  for (const c of etat.convois) if (c.voyage && c.voyage.tArr <= t1) livrer(etat, c);
  for (const c of etat.convois) if (!c.voyage && c.dispo <= t1) choisir(etat, c);
  etat.t = t1;
}
export function avancer(etat, jours) { for (let i = 0; i < jours; i++) jour(etat); return etat; }

/** Somme de tous les soldes de sites et de toutes les caisses : constante (rien ne crée ni ne détruit d'argent). */
export const masseMonetaire = (etat) => [...etat.noeuds.values()].reduce((s, n) => s + n.solde, 0) + etat.convois.reduce((s, c) => s + c.caisse, 0);

/** Résumé : jours de pénurie cumulés, volumes transportés, taxes perçues, gain des convois. */
export function indicateurs(etat) {
  const penuries = {};
  for (const n of etat.noeuds.values()) for (const [g, j] of Object.entries(n.penurie)) penuries[g] = (penuries[g] ?? 0) + j;
  return {
    t: etat.t, penuries, transporte: { ...etat.transporte }, taxes: { ...etat.taxes },
    voyages: etat.convois.reduce((s, c) => s + c.voyages, 0),
    gains: Object.fromEntries(etat.convois.map((c) => [c.def.id, c.gain])),
  };
}

/** Relevé des prix (en multiple du prix de base, null hors marché) de tous les sites à la date courante. */
export const releverPrix = (etat) => ({
  t: etat.t,
  prix: Object.fromEntries([...etat.noeuds].map(([id, n]) => [id, Object.fromEntries([...etat.biens].map(([g, b]) => { const p = prixAuStock(etat, n, g, n.stock[g]); return [g, p == null ? null : p / b.prixBase]; }))])),
});

/**
 * Misère du système : part de la population qui manque de l'essentiel (vivres, eau, un peu de carburant), moyennée sur la durée simulée.
 * Par site : somme pondérée des jours de pénurie ÷ jours simulés (plafonnée à 1). Pondération par la population du site.
 * Renvoie { tyts, humains, total } (parts de 0 à 1) et le détail par site.
 */
export function misereSysteme(etat, poids = { vivres: 1, eau: 1, carburant: 0.4 }) {
  const jours = Math.max(etat.t, 1), parSite = new Map();
  let ht = 0, tt = 0, hm = 0, tm = 0;
  for (const [id, n] of etat.noeuds) {
    const f = Math.min(1, Object.entries(poids).reduce((s, [g, w]) => s + w * (n.penurie[g] ?? 0), 0) / jours);
    parSite.set(id, f);
    ht += n.site.population; tt += n.site.tyts; hm += n.site.population * f; tm += n.site.tyts * f;
  }
  return { humains: hm / Math.max(ht, 1), tyts: tm / Math.max(tt, 1), total: (hm + tm) / Math.max(ht + tt, 1), parSite };
}

/** Simule `jours` jours et renvoie l'état final et l'historique des prix (un relevé tous les `pas` jours). */
export function simulerEconomie(params, jours, pas = 5) {
  const etat = creerEconomie(params), historique = [releverPrix(etat)];
  for (let i = 0; i < jours; i++) { jour(etat); if ((i + 1) % pas === 0) historique.push(releverPrix(etat)); }
  return { etat, historique };
}
