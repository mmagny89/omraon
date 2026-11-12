// Système d'Omraon — bible géographique v3 (ordre figé : 3 telluriques → ceinture → 2 gazeuses).
// Le document ne fixe AUCUNE valeur physique hormis l'ordre, les rôles, les noms et « ~35 UA du centre au bord ».
// Toutes les valeurs numériques ci-dessous sont des choix de conception (marqués « conception »), pensés pour
// qu'un système plausible existe : Zirkan dans la zone habitable pour que Kebet puisse être un monde vivant.
// Les racines égyptiennes sont des notes d'auteur « jamais affichées » : volontairement absentes de l'interface.

export const STAR = {
  id: 'omraon',
  name: 'Omraon',
  massMsun: 1.10, // conception : étoile de type G0V, un peu plus massive que le Soleil
  radiusRsun: 1.10,
  teff: 5900,
  rotation: { periodH: 360 }, // conception : étoile âgée, rotation ralentie (≈ 15 jours)
  ageGyr: 5.8, // CANON (lore) : le système est plus vieux que celui du Soleil (≈ 4,6 Gyr) car l'étoile a abrité une ancienne civilisation ; la valeur 5,8 Gyr est de conception (durée de vie sur la séquence principale ≈ 7,9 Gyr)
  color: '#ffeccc',
  names: { tyt: "ASHK-KH'RU", tytCourant: 'Ashru', sens: 'la Lumière-sacrée' },
  role: "Astre-père du dogme, fondue avec le dieu unique (Osaon-Omraon). Le nom humain a perdu ashk- (le sacré).",
};

export const SYSTEM_EDGE_AU = 35; // document : « ~35 UA du centre au bord (provisoire) »

// Orbites planétaires : éléments héliocentriques J2000-like dans l'écliptique du système.
// Orbites des lunes : éléments dans le plan équatorial de la planète (a en km).
export const PLANETS = [
  {
    id: 'kalpra', name: 'Kalpra', kind: 'rocky', texture: 'kalpra', color: '#ff8a4a',
    massEarth: 0.4, radiusKm: 0.8 * 6371, albedo: 0.12,
    orbit: { a: 0.32, e: 0.12, i: 3.0, Om: 48, w: 29, M: 100 },
    rotation: { spinOrbitRatio: 1.5, tiltDeg: 0.03, nodeDeg: 0 }, // résonance spin-orbite 3:2 (comme Mercure)
    names: { tyt: 'KAL-PYR', tytCourant: 'Kalpyr', sens: 'la Pierre-brûlée' },
    role: 'La brûlée : roche sans atmosphère respirable, avant-poste extrême, exploitation en sous-sol sous coupole blindée.',
    moons: [],
  },
  {
    id: 'sethis', name: 'Sethis', kind: 'rocky', texture: 'sethis', color: '#c98a52',
    massEarth: 0.95, radiusKm: 0.98 * 6371, albedo: 0.3,
    orbit: { a: 0.52, e: 0.04, i: 1.5, Om: 76, w: 54, M: 220 },
    rotation: { periodH: 31, tiltDeg: 12, nodeDeg: 40 },
    atmosphere: { color: '#d9a16a', strength: 0.25, height: 0.03 }, // rendu seulement : voile de poussière, atmosphère ténue (0,05 bar)
    habitat: { pressureBar: 0.05, greenhouseK: 5 }, // conception : atmosphère ténue et poussiéreuse (le doc « Quotidien sensoriel » parle de vent, de poussière, de nuits glaciales)
    names: { tyt: 'SET-KAL-DURUK', tytCourant: 'Setkal', sens: 'la Pierre-de-peine' },
    role: 'Monde-mine par excellence : aride, riche en métaux, forte concentration de Tyts esclaves. Monde d\'origine de Théa.',
    moons: [
      {
        id: 'sedbou', name: 'Sedbou', texture: 'rockDark', color: '#9a9aa2',
        radiusKm: 38, density: 2800, albedo: 0.07,
        orbit: { a: 95000, e: 0.02, i: 1.0, Om: 20, w: 120, M: 10 },
        names: { tyt: 'Sun-Dub', tytCourant: 'Sun-Dub', sens: '' },
        role: 'Petite lune-garnison : caserne et prison des mines. Sinistre.',
      },
    ],
  },
  {
    id: 'naksun', name: 'Naksun', kind: 'rocky', texture: 'naksun', color: '#9aa3b0',
    massEarth: 1.9, radiusKm: 1.22 * 6371, albedo: 0.3,
    orbit: { a: 0.75, e: 0.03, i: 1.0, Om: 131, w: 292, M: 15 },
    rotation: { periodH: 22.6, tiltDeg: 19, nodeDeg: 200 },
    names: { tyt: 'NAKH-SUNN', tytCourant: 'Nakhsun', sens: 'la Gardienne du seuil' },
    role: "Poste de contrôle intérieur : octroi des mines, péage, fouille des cargaisons, surveillance du flux servile.",
    moons: [
      {
        id: 'mahat', name: 'Mahat', texture: 'rockGrey', color: '#b5b0a8',
        radiusKm: 140, density: 2400, albedo: 0.12,
        orbit: { a: 180000, e: 0.01, i: 0.5, Om: 200, w: 40, M: 250 },
        names: { tyt: 'Maa-it', tytCourant: 'Maa-it', sens: '' },
        role: 'Lune administrative et judiciaire : tribunaux, archives douanières. Nom ironique.',
      },
    ],
  },
  {
    id: 'zirkan', name: 'Zirkan', kind: 'gas', texture: 'zirkan', color: '#e0c08a',
    massJup: 1.05, radiusKm: 1.02 * 71492, albedo: 0.5,
    orbit: { a: 1.9, e: 0.05, i: 1.3, Om: 100, w: 273, M: 250 },
    rotation: { periodH: 9.8, tiltDeg: 3.1, nodeDeg: 150 },
    names: { tyt: 'ZIR-KAAN', tytCourant: 'Zirkaan', sens: 'la Voûte-qui-porte' },
    role: 'Géante-ciel qui porte la lune habitable Kebet. Pas de surface ; seuls les navigateurs la nomment.',
    atmosphere: { color: '#f2d9a8', strength: 0.85, height: 0.07 }, // rendu seulement (halo de la géante)
    rings: { inner: 1.2, outer: 2.0, color: '#9b8b78', opacity: 0.22, seed: 5 }, // conception, rendu seulement : anneau poussiéreux et ténu, bien à l'intérieur de Kebet (4,7 R) et de la limite de Roche
    habitat: { magnetosphere: 0.0005 }, // conception : champ très faible (Kebet est à 4,7 rayons de Zirkan ; avec un champ jovien la dose serait mortelle)
    moons: [
      {
        id: 'iasha', name: 'Iasha', texture: 'rockGrey', color: '#d8d8e0',
        radiusKm: 90, density: 2000, albedo: 0.3,
        orbit: { a: 2400000, e: 0.005, i: 0.3, Om: 60, w: 10, M: 130 },
        names: { tyt: 'Ii-Ashk', tytCourant: 'Iashk', sens: 'la Petite-Lumière' },
        role: 'Lune-relais orbitale, station de transit : premier arrêt avant de descendre sur « la Promise ».',
      },
      {
        id: 'kebet', name: 'Kebet', texture: 'kebet', color: '#4a90d9',
        massEarth: 0.84, radiusKm: 0.95 * 6371, albedo: 0.3, locked: true,
        orbit: { a: 345000, e: 0.0001, i: 0.3, Om: 210, w: 80, M: 40 }, // conception : 4,7 rayons de Zirkan -> jour (rotation synchrone) ≈ 1,28 j ; e ≈ 0 pour limiter le chauffage de marée
        names: { tyt: 'GEB-NAN-KAHA', tytCourant: 'Gebnan', sens: 'la Terre-maison' },
        role: "Seul monde habité du système : lune vivante (sol, forêts, océans), sanctuaire tyt volé. Cœur du roman.",
        atmosphere: { color: '#6fb4ff', strength: 1.0 },
        habitat: { pressureBar: 1.1, greenhouseK: 90 }, // conception : atmosphère un peu plus dense et très riche en gaz à effet de serre (Zirkan est au bord extérieur de la zone habitable d'une étoile G0V : sans cela Kebet serait gelée ; +90 K ≈ 288 K au sol, minimum annuel ≥ 278 K)
        clouds: true,
      },
      {
        id: 'astir', name: 'Astir', texture: 'rockGrey', color: '#c6d2e6',
        radiusKm: 60, density: 2200, albedo: 0.2,
        orbit: { a: 3500000, e: 0.01, i: 0.6, Om: 330, w: 200, M: 300 },
        names: { tyt: 'Ashk-Tyr', tytCourant: 'Ashtyr', sens: 'la Lumière-qui-appelle' },
        role: 'Lune-observatoire et balise de navigation : le phare qui guide les vaisseaux vers Kebet.',
      },
    ],
  },
  {
    id: 'roushan', name: 'Roushan', kind: 'gas', texture: 'roushan', color: '#d8d0b4',
    massJup: 0.35, radiusKm: 0.86 * 71492, albedo: 0.4,
    orbit: { a: 30, e: 0.03, i: 0.9, Om: 290, w: 14, M: 60 },
    rotation: { periodH: 10.7, tiltDeg: 26, nodeDeg: 80 },
    names: { tyt: 'RUKH-SHU', tytCourant: 'Rukhshu', sens: 'le Grand-Souffle' },
    role: 'Géante externe pâle et froide : cités flottantes, raffineries de gaz, carburant des moteurs. Monde d\'origine d\'Ella.',
    atmosphere: { color: '#e9e2c4', strength: 0.75, height: 0.07 }, // rendu seulement (halo de la géante)
    rings: { inner: 1.3, outer: 2.3, color: '#ece5cf', opacity: 0.8, gaps: [[1.85, 1.92], [2.12, 2.14]], seed: 9 }, // conception, rendu seulement : anneaux de glace, divisions à l'esprit de Cassini ; Nunka (11 R) est loin au-delà
    habitat: { magnetosphere: 0.03, internalHeat: 1.63 }, // champ de type Saturne ; T(1 bar) ≈ 1,63 × T équilibre comme Saturne
    moons: [
      {
        id: 'nunka', name: 'Nunka', texture: 'ice', color: '#dff0ff',
        radiusKm: 520, density: 1500, albedo: 0.7,
        orbit: { a: 700000, e: 0.01, i: 0.4, Om: 10, w: 90, M: 70 },
        names: { tyt: 'Nunn-Kal', tytCourant: 'Nunkal', sens: "l'Eau-dure" },
        role: "Lune glacée : réserve d'eau et de condensats du système, ravitaillement vital des cités de Roushan.",
      },
      {
        id: 'roukir', name: 'Roukir', texture: 'rockDark', color: '#8a7f78',
        radiusKm: 85, density: 1900, albedo: 0.06,
        orbit: { a: 4500000, e: 0.02, i: 1.5, Om: 250, w: 330, M: 180 },
        names: { tyt: 'Rukh-Kir', tytCourant: 'Rukhir', sens: "l'Enfant-du-vent" },
        role: 'Poste avancé : la vraie frontière extérieure du système, avant-poste minier et militaire des confins.',
      },
      {
        // Planète en cours de colonisation du Mouvement II (le document la situe « autour de Roukir », sans la nommer ni fixer sa nature).
        // Choix de conception : une petite planète rocheuse (Mercure/Mars) sur une orbite lointaine de Roushan, deux fois plus loin que Roukir :
        // stable (0,06 UA, bien sous 0,49 rayon de Hill), voisine du poste de Roukir qui la surveille à peine, sans atmosphère viable, gravité de type Mars.
        // NOM PROVISOIRE : SHU-KAL « la Pierre-du-vide » (shu : le vide ; kal : la pierre), à forger pour de bon.
        id: 'shukal', name: 'Shukal', texture: 'rockGrey', color: '#b9b4a8', provisional: true,
        massEarth: 0.06, radiusKm: 0.38 * 6371, albedo: 0.12,
        orbit: { a: 9500000, e: 0.03, i: 2.0, Om: 140, w: 60, M: 200 },
        names: { tyt: 'SHU-KAL', tytCourant: 'Shukal', sens: 'la Pierre-du-vide' },
        role: "Planète en cours de colonisation (Mouvement II) : sans atmosphère viable, peu surveillée, aux confins, autour de Roukir. Le container endommagé y force l'arrêt, et c'est là qu'Ella découvre Mira. Nom et nature provisoires (le document ne les fixe pas).",
        habitat: { pressureBar: 0 },
      },
    ],
  },
];

export const BELT = {
  name: 'Nunzir', // ceinture d'astéroïdes
  names: { tyt: 'NUNN-ZIR', tytCourant: 'Nunzir', sens: "l'Abîme-nuit" },
  role: "Vaste nuage d'astéroïdes entre les telluriques et les gazeuses : repaire de pirates et de contrebandiers (Onkel, Ella).",
  aMin: 1.05, aMax: 1.55, // conception : entre Naksun (0,75) et l'instabilité de Zirkan (~1,57)
};
