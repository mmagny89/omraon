// Économie du système, modèle simple et déterministe (pas d'aléa) : stocks, prix par rareté, transporteurs qui arbitrent.
// Sans DOM, sans Three.js. Données et réglages : data/economie.js (tout y est de la conception).
//
// Boucle quotidienne : 1. chaque site produit (au prorata de sa main-d'œuvre tyt) et consomme ; 2. les convois arrivés vendent
// (prix au stock réel d'alors) ; 3. chaque convoi à quai choisit le trajet (marchandise × destination) au meilleur profit par jour,
// achète, paie carburant et péage, et part. Le temps de vol vient de `flight.js` (hyperpropulsion).
// Argent : un grand livre fermé. Chaque site a un solde, chaque convoi une caisse ; un échange déplace de l'argent, rien n'en crée
// (voir `masseMonetaire`, testée constante). Limites : les distances sont figées à la date des positions fournies ; un convoi ne
// transporte qu'une marchandise par voyage ; le carburant des vaisseaux est pris à la raffinerie (Roushan), pas au quai de départ.
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

export function creerEconomie({ sites, dist, profils = PROFILS, marchandises = MARCHANDISES, transporteurs = TRANSPORTEURS, reglages = REGLAGES }) {
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
    t: 0, raffinerie, octroi: [...noeuds.values()].find((n) => n.profil.peage), noeuds, convois, biens, reglages, dist, duree, journal: [], taxes: {}, transporte: {},
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
  if (v.g) {
    const brut = valeurEchange(etat, n, v.g, n.stock[v.g], v.qLivree, +1);
    const taxe = v.contrebande ? 0 : brut * (n.profil.taxe ?? 0), net = brut - taxe;
    n.stock[v.g] += v.qLivree; n.enRoute[v.g] -= v.qLivree;
    n.solde -= net; c.caisse += net;
    etat.taxes[v.to] = (etat.taxes[v.to] ?? 0) + taxe;
    etat.transporte[v.g] = (etat.transporte[v.g] ?? 0) + v.qLivree;
    c.gain += net;
  }
  c.gain -= v.depense; c.voyages++;
  c.lieu = v.to; c.dispo = v.tArr + etat.reglages.escaleJours; c.voyage = null;
}

/** Meilleur trajet marchand (une marchandise, une destination) pour le convoi `c` supposé à quai en `lieu`. Ne modifie rien. */
function meilleur(etat, c, lieu) {
  const r = etat.reglages, { def } = c, src = etat.noeuds.get(lieu), contrebande = def.faction === 'contrebande';
  const octroi = etat.octroi, raff = etat.raffinerie;
  let best = null;
  for (const [g, bien] of etat.biens) {
    const reserve = (g === 'tyts' ? RESERVE_TYTS : r.reserve) * src.cible[g];
    const dispo = src.stock[g] - reserve;
    const pSrc = prix(etat, lieu, g);
    if (!(dispo > 0) || pSrc == null) continue;
    const qMax = Math.min(def.soute / bien.volume, dispo), retenu = raff === src && g === 'carburant';
    for (const [idD, nd] of etat.noeuds) {
      if (idD === lieu || !(nd.cible[g] > 0)) continue;
      if (prixAuStock(etat, nd, g, nd.stock[g] + (nd.enRoute[g] ?? 0)) <= pSrc) continue; // jamais rentable : élagage
      const d = etat.duree(lieu, idD, def.aG), vol = d + r.escaleJours;
      const franchit = src.profil.zone !== nd.profil.zone && (src.profil.zone === 'interieur' || nd.profil.zone === 'interieur');
      for (const q0 of [qMax, qMax / 2, qMax / 4]) {
        const carb = d * def.soute * (r.carburantVide + r.carburantParJour * q0 * bien.volume / def.soute);
        const stockRaff = raff.stock.carburant - (retenu ? q0 : 0);
        if (stockRaff < carb || carb > raff.stock.carburant * 0.2) continue;
        const achat = valeurEchange(etat, src, g, src.stock[g], q0, -1);
        const fuel = valeurEchange(etat, raff, 'carburant', stockRaff, carb, -1);
        const peage = !contrebande && franchit && octroi ? achat * octroi.profil.peage : 0;
        if (achat + fuel + peage > c.caisse) continue;
        const qLivree = contrebande ? q0 * (1 - (def.risque ?? 0)) : q0;
        const brut = valeurEchange(etat, nd, g, nd.stock[g] + (nd.enRoute[g] ?? 0), qLivree, +1);
        const profit = brut * (1 - (contrebande ? 0 : nd.profil.taxe ?? 0)) - achat - fuel - peage;
        if (profit > r.profitMin && (!best || profit / vol > best.score)) best = { g, idD, q: q0, qLivree, d, achat, fuel, peage, carb, profit, score: profit / vol };
      }
    }
  }
  return best;
}

function partir(etat, c, o) {
  const { def } = c, src = etat.noeuds.get(c.lieu), raff = etat.raffinerie, octroi = etat.octroi;
  const { g, idD, q, qLivree, d, achat, fuel, peage, carb } = o, dest = etat.noeuds.get(idD);
  if (g) { src.stock[g] -= q; src.solde += achat; dest.enRoute[g] = (dest.enRoute[g] ?? 0) + qLivree; }
  raff.stock.carburant -= carb; raff.solde += fuel;
  if (peage) { octroi.solde += peage; etat.taxes[octroi.site.id] = (etat.taxes[octroi.site.id] ?? 0) + peage; }
  c.caisse -= achat + fuel + peage;
  c.voyage = { from: c.lieu, to: idD, g, q, qLivree, contrebande: def.faction === 'contrebande', tDep: etat.t, tArr: etat.t + d, depense: achat + fuel + peage };
  if (etat.journal.length < 2000) etat.journal.push({ t: etat.t, convoi: def.id, from: c.lieu, to: idD, g, q, jours: d });
}

function choisir(etat, c) {
  const best = meilleur(etat, c, c.lieu);
  if (best) return partir(etat, c, best);
  // Rien à gagner ici : repositionnement à vide vers le quai d'où le meilleur trajet, net du voyage à vide, rapporte le plus.
  const r = etat.reglages, { def } = c, raff = etat.raffinerie;
  let pick = null;
  for (const idX of etat.noeuds.keys()) {
    if (idX === c.lieu) continue;
    const d = etat.duree(c.lieu, idX, def.aG), carb = d * def.soute * r.carburantVide;
    if (raff.stock.carburant < carb) continue;
    const fuel = valeurEchange(etat, raff, 'carburant', raff.stock.carburant, carb, -1);
    const o = meilleur(etat, c, idX);
    if (!o || o.profit - fuel <= r.profitMin || fuel > c.caisse) continue;
    const score = (o.profit - fuel) / (d + o.d + 2 * r.escaleJours);
    if (!pick || score > pick.score) pick = { score, idX, d, carb, fuel };
  }
  if (pick) return partir(etat, c, { g: null, idD: pick.idX, d: pick.d, achat: 0, fuel: pick.fuel, peage: 0, carb: pick.carb });
  c.dispo = etat.t + 2; // rien nulle part : on réessaie dans deux jours
}

/** Avance l'économie d'un jour. */
function jour(etat) {
  const t1 = etat.t + 1;
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

/** Simule `jours` jours et renvoie l'état final et l'historique des prix (un relevé tous les `pas` jours). */
export function simulerEconomie(params, jours, pas = 5) {
  const etat = creerEconomie(params), historique = [];
  const releve = () => historique.push({ t: etat.t, prix: Object.fromEntries([...etat.noeuds].map(([id, n]) => [id, Object.fromEntries([...etat.biens.keys()].map((g) => [g, prixAuStock(etat, n, g, n.stock[g])]))])) });
  releve();
  for (let i = 0; i < jours; i++) { jour(etat); if ((i + 1) % pas === 0) releve(); }
  return { etat, historique };
}
