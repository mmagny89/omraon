// Sites habités. Les ORDRES DE GRANDEUR de population suivent le document « Économie, théologie du travail et échelles » :
// ~300 000 à 800 000 humains au total ; Haut (Kebet) = quelques dizaines de milliers ; Milieu (Roushan, ceinture, lunes) = le gros ;
// Bas (telluriques) = plus rude et clairsemé ; Tyts plus nombreux que les humains dans les zones de travail servile (champ `tyts`).
// Le document nomme les fonctions (mines, octroi, garnison, tribunaux, relais, balise, cités flottantes,
// poste des confins) mais AUCUN emplacement, taille ni population : tout ce qui suit est une proposition de conception
// (invented: true), modifiable dans ce fichier.
//
// type 'surface'      : base au sol (lat, lon en degrés ; la longitude suit la texture du corps)
// type 'orbit'        : station circulaire autour du corps (altKm au-dessus de la surface, inclinaison dans le plan équatorial)
// type 'floating'     : cité flottante au niveau 1 bar d'une géante
// type 'heliocentric' : orbite autour de l'étoile (repaire dans la ceinture)
// population = humains ; tyts = Tyts (esclaves/serviteurs) sur place.
// habitat : 'dome' (coupole blindée) | 'underground' | 'orbital' | 'floating' | 'open' (surface libre)
export const SITES = [
  { id: 'kalpra-mines', name: 'Mines de Kalpra', body: 'Kalpra', type: 'surface', lat: 8, lon: 40, habitat: 'dome', population: 2000, tyts: 1500, invented: true,
    role: 'Exploitation en sous-sol / sous coupole blindée. Peu peuplée, avant-poste extrême.' },
  { id: 'sethis-cite-a', name: 'Cité-mine de Sethis (Tarnel, Théa)', body: 'Sethis', type: 'surface', lat: -12, lon: 130, habitat: 'underground', population: 30000, tyts: 90000, invented: true,
    role: 'Cité-mine principale : humains et Tyts côte à côte, ségrégation officielle mais poreuse (marché, dispensaire, chapelle du père Tarnel).' },
  { id: 'sethis-cite-b', name: 'Cité-mine du désert est', body: 'Sethis', type: 'surface', lat: 18, lon: 250, habitat: 'underground', population: 20000, tyts: 60000, invented: true,
    role: "Autre cité-mine, isolée par le désert : l'isolement empêche de coordonner les révoltes." },
  { id: 'naksun-octroi', name: 'Octroi de Naksun', body: 'Naksun', type: 'orbit', altKm: 900, incl: 5, node: 30, phase: 0, habitat: 'orbital', population: 20000, tyts: 3000, invented: true,
    role: 'Poste de contrôle intérieur : péage, fouille des cargaisons, recensement du flux servile.' },
  { id: 'mahat-tribunaux', name: 'Tribunaux de Mahat', body: 'Mahat', type: 'surface', lat: 15, lon: 0, habitat: 'underground', population: 8000, tyts: 500, invented: true,
    role: 'Lune administrative et judiciaire : tribunaux, archives douanières.' },
  { id: 'sedbou-garnison', name: 'Garnison de Sedbou', body: 'Sedbou', type: 'surface', lat: 0, lon: 180, habitat: 'underground', population: 3000, tyts: 0, invented: true,
    role: "Caserne et prison des mines : la lune d'où l'on surveille les esclaves de Sethis." },
  { id: 'iasha-relais', name: "Relais d'Iasha", body: 'Iasha', type: 'surface', lat: 0, lon: 0, habitat: 'underground', population: 30000, tyts: 0, invented: true,
    role: 'Station de transit et logement des ouvriers-navetteurs du Milieu qui montent entretenir Kebet.' },
  { id: 'astir-balise', name: "Balise d'Astir", body: 'Astir', type: 'surface', lat: 30, lon: 90, habitat: 'underground', population: 8000, tyts: 0, invented: true,
    role: 'Observatoire et balise de navigation vers Kebet ; logement d\'ouvriers-navetteurs.' },
  { id: 'kebet-orbite', name: 'Port orbital de Kebet', body: 'Kebet', type: 'orbit', altKm: 600, incl: 10, node: 0, phase: 90, habitat: 'orbital', population: 5000, tyts: 500, invented: true,
    role: "Port d'entrée du monde habité : douane et transit avant la descente (stations de service, dont celle où Heru fut trouvé). Tenu en place au-dessus de la capitale (conception : aucune orbite ne le permet)." },
  { id: 'kebet-temples', name: "Grands temples d'Osaon", body: 'Kebet', type: 'surface', lat: 30, lon: 20, land: true, habitat: 'open', population: 3000, tyts: 1500, invented: true,
    role: "Centre religieux : archives, Histoire officielle, temples solaires ouverts sur le ciel — bâtis sur le sanctuaire tyt volé." },
  { id: 'kebet-consortium', name: 'Siège du Consortium', body: 'Kebet', type: 'surface', lat: 33, lon: 28, land: true, habitat: 'open', population: 2000, tyts: 800, invented: true,
    role: 'Centre du pouvoir : sièges des corporations, gouvernement ; luxe sobre, vues sur les jardins.' },
  { id: 'kebet-quartiers', name: 'Beaux quartiers de Kebet', body: 'Kebet', type: 'surface', lat: 26, lon: 14, land: true, habitat: 'open', population: 15000, tyts: 5000, invented: true,
    role: "Villas blanches dans le vert : vraie élite, familles-exemples, serviteurs tyts presque invisibles." },
  { id: 'roushan-cites', name: 'Cités flottantes de Roushan', body: 'Roushan', type: 'floating', lat: 12, lon: 60, habitat: 'floating', population: 250000, tyts: 0, invented: true,
    role: "Raffineries de gaz et carburant des moteurs : le gros de la population humaine libre (Milieu). Monde d'origine d'Ella." },
  { id: 'nunka-glace', name: 'Exploitation de glace de Nunka', body: 'Nunka', type: 'surface', lat: 20, lon: 0, habitat: 'underground', population: 5000, tyts: 2000, invented: true,
    role: "Réserve d'eau et de condensats : ravitaillement vital des cités de Roushan." },
  { id: 'roukir-poste', name: 'Poste des confins', body: 'Roukir', type: 'surface', lat: 0, lon: 90, habitat: 'underground', population: 1500, tyts: 0, invented: true,
    role: 'Avant-poste minier et militaire : guet, douane du dehors, contrebande lointaine.' },
  { id: 'shukal-colonie', name: 'Colonie de Shukal (en cours)', body: 'Shukal', type: 'surface', lat: 10, lon: 30, habitat: 'dome', population: 1200, tyts: 300, founded: -12, invented: true,
    role: "Colonisation en cours aux confins : préfabriqués sous coupole, chantiers, très peu de surveillance. Fondée il y a une douzaine d'années." },
  { id: 'shukal-arret', name: "Piste d'arrêt forcé (Mouvement II)", body: 'Shukal', type: 'surface', lat: -15, lon: 200, habitat: 'underground', population: 0, tyts: 0, invented: true,
    role: "Là où le container endommagé force l'arrêt : abri de fortune, loin des yeux de la colonie. C'est là qu'Ella découvre Mira." },
  { id: 'nunzir-repaire', name: 'Repaire de la ceinture', body: 'Nunzir', type: 'heliocentric', orbit: { a: 1.32, e: 0.08, i: 3, Om: 80, w: 120, M: 40 }, habitat: 'underground', population: 1500, tyts: 200, invented: true,
    role: 'Repaire de pirates et de contrebandiers (Onkel, Ella) dans un astéroïde.' },
];

// Le port de Kebet est tenu en place au-dessus de la capitale (le siège du Consortium) : `fixe` remplace son orbite par un point fixe dans le repère du corps,
// à `altKm`. Aucune orbite naturelle ne le permet : celle qui suivrait la rotation de Kebet (≈ 47 000 km) est hors de sa sphère de Hill (voir docs/modifications-lore.md, n° 25).
const capitale = SITES.find((x) => x.id === 'kebet-consortium');
SITES.find((x) => x.id === 'kebet-orbite').fixe = { lat: capitale.lat, lon: capitale.lon };
