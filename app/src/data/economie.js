// Économie du système : marchandises, monnaie, profils des sites, transporteurs.
// TOUT ce fichier est de la CONCEPTION (invented) : le roman nomme les fonctions (mines, octroi, raffineries, glace de Nunka,
// contrebande, transporteuse) mais aucun prix, aucune production, aucune soute. Valeurs modifiables ici, listées dans
// docs/hypotheses.md et docs/modifications-lore.md. Unité de masse : la tonne (1 unité de marchandise = 1 t, sauf `volume`).

/** Monnaie : le nom n'est pas fixé par l'autrice (2026-11-13). `provisoire` : ne jamais l'afficher comme canon. */
export const MONNAIE = { nom: 'crédit', pluriel: 'crédits', symbole: 'cr', provisoire: true };

/**
 * prixBase : prix d'équilibre (crédits par unité) quand le stock couvre `joursCible` de consommation.
 * volume : place occupée en soute par unité (un Tyt = 0,25 : compartiment, vivres et eau du trajet compris).
 * Les Tyts sont aussi une marchandise (décision de l'autrice, 2026-11-13) : leur flux est celui que l'octroi « recense ».
 */
export const MARCHANDISES = [
  { id: 'eau', nom: 'Eau et glace', prixBase: 8, volume: 1 },
  { id: 'carburant', nom: 'Carburant raffiné', prixBase: 40, volume: 1 },
  { id: 'minerai', nom: 'Minerai brut', prixBase: 25, volume: 1 },
  { id: 'metaux', nom: 'Métaux traités', prixBase: 120, volume: 1 },
  { id: 'vivres', nom: 'Vivres', prixBase: 60, volume: 1 },
  { id: 'equipements', nom: 'Pièces et équipements', prixBase: 300, volume: 1 },
  { id: 'luxe', nom: 'Produits de luxe', prixBase: 1500, volume: 0.2 },
  { id: 'tyts', nom: 'Tyts (main-d’œuvre servile)', prixBase: 2500, volume: 0.25 },
];

/** Consommation par habitant et par jour (tonnes ; net du recyclage). Les Tyts mangent un peu moins, ne consomment pas de luxe. */
export const CONSO_HABITANT = {
  humain: { eau: 0.0004, vivres: 0.0006, carburant: 0.0003, metaux: 0.00008, equipements: 0.00008 },
  tyt: { eau: 0.0003, vivres: 0.0005, carburant: 0.00005, metaux: 0.00002, equipements: 0.00002 },
};
/** Luxe : seulement les lieux de l'élite, par humain et par jour. */
export const CONSO_LUXE = { 'kebet-quartiers': 0.001, 'kebet-consortium': 0.002, 'kebet-temples': 0.0006, 'kebet-orbite': 0.0006, 'roushan-cites': 0.00001 };

/**
 * Profil de chaque site (clé = id de data/sites.js).
 *  prod       : production par jour à pleine main-d'œuvre.
 *  conso      : consommation industrielle par jour, en plus de celle des habitants.
 *  tytsRequis : main-d'œuvre servile nécessaire ; sous ce seuil la production baisse au prorata.
 *  tytsAn     : variation naturelle des Tyts par an (fraction, conception) : naissances autorisées moins usure du travail.
 *               Le détail démographique relève de `physics/population.js` ; ici, une approximation à relier plus tard.
 *  puits      : vitesse de libération du lieu (km/s) : plus elle est haute, plus il coûte de carburant de décoller avec de la cargaison (0 = astéroïde, quai en orbite).
 *  zone       : 'interieur' (mines, derrière l'octroi de Naksun) ou 'exterieur'.
 *  taxe       : part de la valeur des marchandises importées prélevée à l'arrivée (douane).
 *  peage      : part de la valeur prélevée au site (octroi) sur tout voyage qui franchit la limite de la zone intérieure.
 */
export const PROFILS = {
  'kalpra-mines': { puits: 7.9, prod: { minerai: 20, metaux: 6 }, tytsRequis: 2000, tytsAn: -0.06, zone: 'interieur' },
  'sethis-cite-a': { puits: 11.0, prod: { minerai: 120, metaux: 20 }, tytsRequis: 85000, tytsAn: 0.012, zone: 'interieur' },
  'sethis-cite-b': { puits: 11.0, prod: { minerai: 80, metaux: 12 }, tytsRequis: 55000, tytsAn: 0.012, zone: 'interieur' },
  'naksun-octroi': { prod: {}, tytsRequis: 0, zone: 'interieur', peage: 0.06 },
  'mahat-tribunaux': { puits: 0.1, prod: {}, tytsRequis: 0, zone: 'interieur' },
  'sedbou-garnison': { puits: 0.05, prod: {}, tytsRequis: 0, zone: 'interieur' },
  'iasha-relais': { puits: 0.1, prod: { equipements: 22 }, tytsRequis: 0, zone: 'exterieur' },
  'astir-balise': { puits: 0.05, prod: {}, tytsRequis: 0, zone: 'exterieur' },
  // Le port est tenu en place par une poussée continue (≈ 0,8 g, docs/modifications-lore.md n° 25) : il brûle en permanence ; 60 t/jour est un ordre de grandeur de conception.
  'kebet-orbite': { prod: {}, conso: { carburant: 60 }, tytsRequis: 400, tytsAn: 0, zone: 'exterieur', taxe: 0.1 },
  'kebet-temples': { puits: 10.5, prod: { vivres: 40, eau: 6 }, tytsRequis: 1400, tytsAn: 0.005, zone: 'exterieur' },
  'kebet-consortium': { puits: 10.5, prod: { eau: 5 }, tytsRequis: 700, tytsAn: 0.005, zone: 'exterieur' },
  'kebet-quartiers': { puits: 10.5, prod: { vivres: 280, luxe: 30, eau: 25 }, tytsRequis: 4000, tytsAn: 0.01, zone: 'exterieur' },
  'roushan-cites': { puits: 12, prod: { carburant: 330, equipements: 22, vivres: 20 }, conso: { minerai: 200 }, tytsRequis: 0, zone: 'exterieur' },
  'nunka-glace': { puits: 0.4, prod: { eau: 120 }, tytsRequis: 2500, tytsAn: -0.02, zone: 'exterieur' },
  'roukir-poste': { puits: 0.05, prod: { minerai: 5 }, tytsRequis: 0, zone: 'exterieur' },
  'shukal-colonie': { puits: 4.4, prod: {}, tytsRequis: 600, tytsAn: 0, zone: 'exterieur' },
  'shukal-arret': { prod: {}, tytsRequis: 0, zone: 'exterieur' },
  'nunzir-repaire': { puits: 0, prod: {}, tytsRequis: 0, zone: 'ceinture' },
  'ceinture-fonderies': { puits: 0, prod: { minerai: 45, metaux: 14 }, tytsRequis: 150, tytsAn: 0.01, zone: 'ceinture' },
  'troyens-roushan': { puits: 0, prod: { eau: 30, minerai: 12 }, tytsRequis: 200, tytsAn: 0.01, zone: 'exterieur' },
  'froide-relais': { puits: 0, prod: { eau: 15 }, tytsRequis: 0, zone: 'exterieur' },
  'ceinture-glace': { puits: 0, prod: { eau: 35 }, tytsRequis: 0, zone: 'ceinture' },
};

/**
 * Transporteurs. faction : 'consortium' (flotte officielle) | 'libre' (capitaine indépendant) | 'contrebande' (évite douane et péage,
 * mais perd en moyenne `risque` de sa cargaison, saisie à la fouille). soute en unités de volume ; aG : accélération (g).
 * « Mai » et Ella Corren sont canon (transporteuse) ; leur soute, leur caisse et les autres convois sont inventés.
 */
export const TRANSPORTEURS = [
  // Flottes (un « transporteur » est ici une flottille agrégée : soute en tonnes de volume, caisse en crédits).
  { id: 'consortium-1', nom: 'Flotte du Consortium I', faction: 'consortium', soute: 4000, aG: 8, base: 'kebet-orbite', caisse: 2000000 },
  { id: 'consortium-2', nom: 'Flotte du Consortium II', faction: 'consortium', soute: 4000, aG: 8, base: 'kebet-orbite', caisse: 2000000 },
  { id: 'consortium-3', nom: 'Flotte du Consortium III', faction: 'consortium', soute: 4000, aG: 8, base: 'kebet-quartiers', caisse: 2000000 },
  { id: 'roushan-1', nom: 'Flottille de Roushan I', faction: 'libre', soute: 3000, aG: 8, base: 'roushan-cites', caisse: 1000000 },
  { id: 'roushan-2', nom: 'Flottille de Roushan II', faction: 'libre', soute: 3000, aG: 8, base: 'roushan-cites', caisse: 1000000 },
  { id: 'roushan-3', nom: 'Flottille de Roushan III', faction: 'libre', soute: 3000, aG: 8, base: 'roushan-cites', caisse: 1000000 },
  { id: 'roushan-4', nom: 'Flottille de Roushan IV', faction: 'libre', soute: 3000, aG: 8, base: 'roushan-cites', caisse: 1000000 },
  { id: 'glace-1', nom: 'Chalands de glace I', faction: 'libre', soute: 2500, aG: 4, base: 'nunka-glace', caisse: 400000 },
  { id: 'glace-2', nom: 'Chalands de glace II', faction: 'libre', soute: 2500, aG: 4, base: 'nunka-glace', caisse: 400000 },
  { id: 'mineurs-1', nom: 'Convoi des mines I', faction: 'libre', soute: 3000, aG: 6, base: 'sethis-cite-a', caisse: 800000 },
  { id: 'mineurs-2', nom: 'Convoi des mines II', faction: 'libre', soute: 3000, aG: 6, base: 'sethis-cite-b', caisse: 800000 },
  { id: 'mineurs-3', nom: 'Convoi de Kalpra', faction: 'libre', soute: 1500, aG: 6, base: 'kalpra-mines', caisse: 300000 },
  // Cabotage : petits armateurs indépendants qui desservent les sites trop petits pour une flotte.
  { id: 'cabotage-1', nom: 'Cabotier de Naksun', faction: 'libre', soute: 150, aG: 8, base: 'naksun-octroi', caisse: 40000 },
  { id: 'cabotage-2', nom: 'Cabotier d\u2019Iasha', faction: 'libre', soute: 150, aG: 8, base: 'iasha-relais', caisse: 40000 },
  { id: 'cabotage-3', nom: 'Cabotier des confins', faction: 'libre', soute: 120, aG: 8, base: 'roukir-poste', caisse: 40000 },
  { id: 'cabotage-4', nom: 'Cabotier de Shukal', faction: 'libre', soute: 120, aG: 8, base: 'shukal-colonie', caisse: 40000 },
  { id: 'cabotage-5', nom: 'Cabotier de Mahat', faction: 'libre', soute: 150, aG: 8, base: 'mahat-tribunaux', caisse: 40000 },
  { id: 'cabotage-6', nom: 'Cabotier d\u2019Astir', faction: 'libre', soute: 150, aG: 8, base: 'astir-balise', caisse: 40000 },
  // La ceinture, hors du contrôle du Consortium
  { id: 'ceinture-1', nom: 'Mineurs libres de la ceinture', faction: 'libre', soute: 2500, aG: 6, base: 'ceinture-fonderies', caisse: 500000 },
  { id: 'ceinture-2', nom: 'Chalands de la ceinture', faction: 'libre', soute: 2500, aG: 4, base: 'ceinture-glace', caisse: 500000 },
  { id: 'onkel-2', nom: 'Passeurs d\u2019Onkel', faction: 'contrebande', soute: 600, aG: 8, base: 'nunzir-repaire', caisse: 80000, risque: 0.12 },
  { id: 'troyens-1', nom: 'Chalands des troyens', faction: 'libre', soute: 1200, aG: 6, base: 'troyens-roushan', caisse: 300000 },
  { id: 'cabotage-7', nom: 'Cabotier de la ceinture froide', faction: 'libre', soute: 120, aG: 8, base: 'froide-relais', caisse: 40000 },
  // Personnages
  { id: 'mai', nom: 'Le Mai (Ella Corren)', faction: 'libre', soute: 60, aG: 8, base: 'roushan-cites', caisse: 20000 },
  { id: 'onkel-1', nom: 'Réseau d\u2019Onkel', faction: 'contrebande', soute: 80, aG: 8, base: 'nunzir-repaire', caisse: 30000, risque: 0.12 },
];

/** Paramètres du moteur (conception). */
export const REGLAGES = {
  joursCible: 30, // un stock « normal » couvre un mois de consommation (ou de production, pour un site qui ne fait que produire)
  elasticite: 0.7, // prix = base × (cible / stock)^élasticité
  prixMin: 0.2, prixMax: 5, // bornes en multiple du prix de base
  reserve: 0.25, // part de la cible qu'un site refuse de vendre au transporteur
  carburantParJour: 0.012, // carburant par jour de vol, par unité de soute, à pleine charge (proportionnel au chargement)
  lancement: 0.04, // carburant par unité de cargaison qui quitte un lieu à 10 km/s de vitesse de libération ; ∝ (vitesse/10)²
  carburantVide: 0.004, // idem à vide
  escaleJours: 0.5, // chargement et déchargement
  profitMin: 50, // crédits : en dessous, le transporteur ne part pas
  tranches: 8, // finesse de l'intégration du prix pendant un achat ou une vente
};
