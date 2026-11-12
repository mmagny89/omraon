// Banque d'images pour écrire une scène. Les trois mondes Kebet, Sethis, Roushan reprennent les documents
// « Quotidien sensoriel » (canon) ; les autres (stations, bases souterraines) sont des propositions génériques
// (canon: false) qui déduisent l'ambiance de la physique du lieu. Banque d'images, pas un canon.
export const AMBIANCES = {
  kebet: {
    canon: true, titre: 'Kebet — le paradis lumineux et faux',
    voir: ['Cités blanches aux courbes douces, verre et pierre pâle ; jardins suspendus, eau vive, doré de la lumière aux heures dorées.', 'La technologie est invisible : pas de tuyauterie, rien qui gronde.', 'Palette : blanc, vert, doré — chacune à double sens (effacement, jardin volé, or du culte).'],
    entendre: ['Eau qui coule, vent dans les feuilles, oiseaux terriens acclimatés, voix feutrées.', 'Le calme est un privilège fabriqué : une technique assez avancée pour ne pas s\'entendre.'],
    sentir: ['L\'air vrai, premier air respirable à ciel ouvert : verdure, fleur, terre humide.', 'Un peu trop parfumé, légèrement artificiel : l\'air d\'un paradis entretenu.'],
    toucher: ['Température idéale, climat invisible ; pierre lisse, vrai bois (luxe inouï), textiles fins ; eau gaspillée pour la beauté.'],
    corps: ['Le corps ne souffre pas, ne manque de rien : le confort comme anesthésie.'],
    faussenote: 'Où sont les Tyts ? On ne les voit pas : le travail qui rend le paradis possible est invisibilisé. Trop propre, trop serein.',
  },
  sethis: {
    canon: true, titre: 'Sethis — laide et dure, l\'usure nue',
    voir: ['Ocre partout : la poussière minérale infiltre bâtiments, vêtements, peau.', 'Chevalements, convoyeurs, terrils ; préfabriqués et tôle ; cages à lapin des Tyts ; à l\'écart, l\'enclave corporate propre et climatisée.', 'Jour : lumière blanche qui cogne. Nuit : le froid tombe d\'un coup, et le ciel est dément d\'étoiles — la seule chose gratuite.'],
    entendre: ['Foreuses, convoyeurs, sirènes de changement d\'équipe, tirs de mine qui font trembler le sol ; le vent du désert.', 'À voix basse, des bribes de tyt courant, vite ravalées.'],
    sentir: ['Poussière sèche, goût métallique, sueur, explosifs âcres, odeur de l\'épuisement ; l\'eau est rare.'],
    toucher: ['Poussière collée à la peau moite, sol qui tremble, froid brutal après la fournaise, lèvres gercées.'],
    corps: ['Poumons chargés de poussière ; corps épuisés ; canines imposées des Tyts, visibles au quotidien.'],
    faussenote: 'La couleur du pouvoir, c\'est l\'absence de poussière.',
  },
  roushan: {
    canon: true, titre: 'Roushan — belle et dure, la beauté captée',
    voir: ['Dehors : mer de nuages sans fond, ambre et or au « jour », violine et cendre quand l\'étoile passe derrière la géante ; chapelets de lumières suspendues ; éclairs dans les couches basses.', 'Dedans : coursives métalliques, antidérapant usé, tuyauterie apparente, torchères des raffineries, lumière jaunâtre économe.'],
    entendre: ['Le grondement des raffineries ne s\'arrête jamais (on le sent dans le sternum) ; sifflement des échangeurs, claquement des sas, vent de la haute atmosphère.', 'Quand une machine s\'arrête, c\'est ça qu\'on remarque.'],
    sentir: ['Huile et gaz, un peu sucré, un peu écœurant ; humidité permanente, le métal transpire ; cuisine des coursives et désinfectant bon marché.'],
    toucher: ['Froid humide du métal, vibration permanente sous les pieds, vêtements qui ne sèchent jamais.'],
    corps: ['Mains calleuses, brûlures de raffinerie ; les vieux « toussent le Roushan ».'],
    faussenote: 'La splendeur passe au-dessus des têtes de ceux qui triment : personne n\'a le temps de la regarder.',
  },
  station: {
    canon: false, titre: 'Station orbitale (ambiance proposée)',
    voir: ['Coursives étroites sous lumière artificielle, hublots sur la courbure du monde en dessous ; panneaux, docks, sas de service.'],
    entendre: ['Ventilation, pompes, claquement des sas, vibrations des amarrages ; voix qui portent dans le métal.'],
    sentir: ['Air recyclé, huile chaude, désinfectant, cuisine réchauffée ; l\'odeur de la vie confinée.'],
    toucher: ['Quasi-apesanteur ou gravité de rotation, froid du métal près des parois, rampes usées.'],
    corps: ['Fatigue des cycles artificiels : le jour de la station n\'est pas celui du monde dessous.'],
    faussenote: 'Le monde en bas est visible et inaccessible.',
  },
  base: {
    canon: false, titre: 'Base souterraine (ambiance proposée)',
    voir: ['Galeries, sas blindés, éclairage artificiel ; la surface n\'existe que par un hublot ou un écran.'],
    entendre: ['Pompes, climatisation, grondement lointain des machines ; le silence de la roche quand tout s\'arrête.'],
    sentir: ['Air filtré, métal, poussière de roche, sueur.'],
    toucher: ['Parois tièdes ou froides selon le monde, vibration, gravité faible ou forte selon le lieu.'],
    corps: ['Le corps suit un cycle imposé, sans soleil.'],
    faussenote: 'Dehors est mortel, et tout le monde le sait.',
  },
  ceinture: {
    canon: false, titre: 'Repaire de la ceinture (ambiance proposée)',
    voir: ['Un astéroïde creusé, coursives de fortune, soudures apparentes, marchandises non déclarées.'],
    entendre: ['Réseaux chiffrés qui crépitent, pompes rafistolées, voix basses.'],
    sentir: ['Roche chauffée, huile, tabac de synthèse.'],
    toucher: ['Microgravité, parois froides.'],
    corps: ['Des gens qui n\'aiment pas qu\'on les regarde.'],
    faussenote: 'L\'angle mort du système : surveillé par personne.',
  },
};

// Précisions par site (reprises des documents « Quotidien sensoriel » et « Vie quotidienne »)
export const SITE_EXTRA = {
  'kebet-temples': ['Temples solaires immenses, ouverts sur le ciel pour capter Omraon ; disques d\'or, lumière en nappes.', 'Archives et formules tyt récitées sans être comprises : la déesse-mère est adorée sous un faux nom masculin.'],
  'kebet-consortium': ['Luxe sobre, celui qui n\'a rien à prouver : verre, hauteur, vues sur les jardins, silence feutré, sécurité invisible.', 'Pas de trône : une table.'],
  'kebet-quartiers': ['Villas blanches nichées dans le vert, jardins privés, espace (luxe ultime).', 'Familles-exemples zélées et anxieuses ; serviteurs tyts qu\'on ne regarde plus.'],
  'kebet-orbite': ['Stations de service : les entrées dérobées par où passent les transporteurs et les navettes d\'ouvriers.', 'Heru, le chat d\'Ella, a été recueilli sur une station de Kebet.'],
  'sethis-cite-a': ['Lieux-frontières : le marché, les abords des puits au changement d\'équipe, le dispensaire, la chapelle du père Tarnel.', 'Trois langues : l\'Humain officiel, le jargon des mines, le tyt chuchoté.'],
  'sethis-cite-b': ['Cité isolée par le désert vide et les pistes : une prison à ciel ouvert dont les murs sont la distance et la poussière.'],
  'roushan-cites': ['Deux populations : les installés (coursives-quartiers, cuisine de la débrouille) et les gens de passage (docks, comptoirs, argot mobile).'],
  'iasha-relais': ['Les ouvriers-navetteurs du Milieu logent ici et montent entretenir Kebet : le paradis ne veut pas voir ceux qui le réparent.'],
  'astir-balise': ['Observatoire et phare des vaisseaux vers Kebet ; logements d\'ouvriers-navetteurs.'],
};

// Ambiances propres à un lieu (non canon : le lore n'a de « Quotidien sensoriel » que pour Kebet, Sethis et Roushan). Chaque entrée
// déduit les sens de la fonction du lieu décrite dans les documents (01 Bible géographique, 03 Corporations, 04 Politique, 05 Vie quotidienne)
// et de sa physique (pesanteur, lumière, froid) : une banque d'images à valider, pas un canon. Les scènes la marquent « non canon ».
export const AMBIANCES_SITES = {
  'naksun-octroi': {
    canon: false, source: '01 Système (Naksun), 04 Politique, 05 Vie quotidienne', titre: 'Octroi de Naksun — le seuil taxé',
    voir: ['Files de vaisseaux à l\'arrêt devant les portiques ; cargaisons ouvertes, scellées, tamponnées ; colonnes de Tyts-esclaves comptés au passage.', 'Écrans de recensement, balises, uniformes de douaniers des corporations de commerce.'],
    entendre: ['Appels de numéros de passage, scanners qui claquent, sas, pas cadencés ; le murmure de l\'attente.'],
    sentir: ['Métal froid, huile de portique, odeur de soute ouverte, air recyclé.'],
    toucher: ['Rampes, barrières, poignées tièdes de mains innombrables.'],
    corps: ['L\'attente comme discipline : on apprend à ne pas se faire remarquer à la fouille.'],
    faussenote: 'On y compte tout ce qui monte des mines : les minerais, et les êtres.',
  },
  'mahat-tribunaux': {
    canon: false, source: '01 Système (Mahat), 04 Politique', titre: 'Tribunaux de Mahat — la justice des corporations',
    voir: ['Couloirs gris, salles d\'audience sobres, archives douanières en rayonnages ; fuyards et fraudeurs en attente, sous l\'œil des greffiers.'],
    entendre: ['Voix basses, appels de dossiers, battants de portes lourds ; le silence qui suit un verdict.'],
    sentir: ['Papier, poussière de rayonnage, désinfectant de cellule.'],
    toucher: ['Bancs durs, ferrures, sol lisse usé par des milliers de pas ; pesanteur très faible sur cette petite lune.'],
    corps: ['Une peur contenue : parler fort ne sert à rien, la peine est souvent écrite d\'avance.'],
    faussenote: 'Le nom promet l\'ordre et la justice ; la justice qu\'on y rend est celle des corporations.',
  },
  'sedbou-garnison': {
    canon: false, source: '01 Système (Sedbou)', titre: 'Garnison de Sedbou — la lune-caserne',
    voir: ['Baraquements alignés, postes de guet tournés vers Sethis, cellules sans fenêtre ; écrans de surveillance des mines.'],
    entendre: ['Ordres brefs, bottes sur le métal, verrous ; un bourdonnement de surveillance qui ne s\'arrête jamais.'],
    sentir: ['Graisse d\'arme, sueur, cantine, métal froid.'],
    toucher: ['Grilles, banquettes de métal ; pesanteur quasi nulle sur une si petite lune.'],
    corps: ['La tension de ceux qui gardent, et de ceux qui sont gardés.'],
    faussenote: 'Sinistre : d\'ici on surveille les esclaves de Sethis, et personne ne regarde ailleurs.',
  },
  'kalpra-mines': {
    canon: false, source: '01 Système (Kalpra), 03 Corporations', titre: 'Mines de Kalpra — la pierre-brûlée',
    voir: ['Coupole blindée sur une roche cuite, étoile écrasante derrière des vitres sombres ; puits, rails, foreuses ; très peu de monde.'],
    entendre: ['Foreuses sourdes, pompes de refroidissement, craquements de la roche qui se dilate.'],
    sentir: ['Roche chaude, ozone, métal surchauffé, air filtré un peu rance.'],
    toucher: ['Parois tièdes ou brûlantes, gants épais ; une pesanteur plus faible que sur Terre.'],
    corps: ['La chaleur épuise ; on dort en sous-sol pour fuir le rayonnement.'],
    faussenote: 'Le plus près du feu : un monde qu\'on exploite sans jamais l\'habiter vraiment.',
  },
  'iasha-relais': {
    canon: false, source: '01 Système (Iasha), 13 Quotidien Kebet', titre: 'Relais d\'Iasha — premier arrêt avant le Jardin',
    voir: ['Docks de transit au-dessus de Kebet, hublots sur le monde vert et sur Zirkan ; navettes de descente, files d\'ouvriers-navetteurs.'],
    entendre: ['Annonces de navettes, sas, voix de pilotes, rumeurs de dortoirs.'],
    sentir: ['Air de station, sueur, cuisine chaude.'],
    toucher: ['Pesanteur très faible, rampes, couchettes superposées.'],
    corps: ['La fatigue des allers-retours : le jour de la station n\'est pas celui de Kebet.'],
    faussenote: 'Le paradis ne veut pas voir ceux qui le réparent : ils logent ici, à distance.',
  },
  'astir-balise': {
    canon: false, source: '01 Système (Astir)', titre: 'Balise d\'Astir — le phare',
    voir: ['Antennes et instruments sur une petite lune grise ; des vaisseaux guidés vers Kebet ; logements d\'ouvriers-navetteurs creusés dans la roche.'],
    entendre: ['Bourdonnement d\'émetteurs, pulsations de balise, pompes.'],
    sentir: ['Air filtré, métal, ozone d\'électronique.'],
    toucher: ['Pesanteur très faible, câbles et rampes.'],
    corps: ['Des veilles longues, les yeux sur les écrans.'],
    faussenote: 'Une balise qui guide vers Kebet depuis longtemps : vestige possible des Anciens (iceberg, à ne pas expliquer).',
  },
  'kebet-orbite': {
    canon: false, source: '01 Système (Kebet, Iasha), 13 Quotidien Kebet', titre: 'Port orbital de Kebet — la douane avant le Jardin',
    voir: ['Docks clairs côté passagers, coursives de service côté ouvriers ; hublots sur le monde vert ; navettes de descente.'],
    entendre: ['Annonces feutrées côté Haut, vacarme des soutes côté service.'],
    sentir: ['Air filtré et parfumé côté passagers, huile et sueur côté service.'],
    toucher: ['Rotation douce, rampes polies d\'un côté, métal usé de l\'autre.'],
    corps: ['Deux corps dans la même station : ceux qui descendent, et ceux qui font tourner.'],
    faussenote: 'Le Jardin est là, sous le hublot : tout proche, et réservé.',
  },
  'nunka-glace': {
    canon: false, source: '01 Système (Nunka)', titre: 'Exploitation de glace de Nunka — l\'eau-pierre',
    voir: ['Plaines de glace claire, galeries creusées dans le blanc bleuté, convoyeurs de blocs, cuves et tuyauteries givrées ; une étoile lointaine et faible.'],
    entendre: ['Craquements de glace, scies thermiques, compresseurs ; l\'écho des galeries creuses.'],
    sentir: ['Froid sec, ozone, eau de fonte, métal givré.'],
    toucher: ['Parois glacées, gants épais, pesanteur faible.'],
    corps: ['Le froid mord : mains gercées, haleine blanche.'],
    faussenote: 'Sans cette eau, les cités de Roushan s\'arrêtent : un ravitaillement vital qu\'on tient pour acquis.',
  },
  'roukir-poste': {
    canon: false, source: '01 Système (Roukir)', titre: 'Poste des confins — la dernière lumière',
    voir: ['Postes de guet, antennes tournées vers le noir, douane du dehors ; le soleil réduit à une étoile parmi les autres.'],
    entendre: ['Silence radio entrecoupé de grésillements ; sas, pompes, veilleurs.'],
    sentir: ['Air recyclé froid, café de synthèse, huile.'],
    toucher: ['Pesanteur faible, froid contre les parois.'],
    corps: ['Ennui et vigilance : des gens loin de tout, qui regardent le vide.'],
    faussenote: 'Au-delà, il n\'y a plus de système : le vide où entrent et sortent contrebandiers et pirates.',
  },
  'shukal-colonie': {
    canon: false, source: '01 Système (Roukir, confins), 06 Structure (Mouvement II)', titre: 'Colonie de Shukal — le monde en chantier (nom provisoire)',
    voir: ['Dômes provisoires et modules posés sur une roche grise sans atmosphère, chantiers, engins ; un monde en cours de colonisation, peu surveillé.'],
    entendre: ['Engins de chantier étouffés par les parois, pompes, voix en combinaison.'],
    sentir: ['Air neuf des modules, plastique chaud, poussière de roche.'],
    toucher: ['Pesanteur faible, gants de combinaison.'],
    corps: ['Trop peu de monde pour un si grand dehors.'],
    faussenote: 'Nom et nature provisoires : le roman n\'a pas encore tranché ce monde.',
  },
  'shukal-arret': {
    canon: false, source: '06 Structure (Mouvement II)', titre: 'Piste d\'arrêt forcé — loin des regards',
    voir: ['Une piste de fortune au bord d\'un chantier désert, sur un monde peu surveillé ; le dehors immobile.'],
    entendre: ['Le vent n\'existe pas : seulement la structure qui craque et ses propres pas.'],
    sentir: ['Air d\'abri, métal froid, poussière.'],
    toucher: ['Pesanteur faible, combinaison raide.'],
    corps: ['L\'adrénaline retombée, la fatigue d\'après.'],
    faussenote: 'Un endroit où personne ne vient : c\'est pour cela qu\'on s\'y arrête.',
  },
};

export function ambianceFor(site) {
  const id = site.id;
  const key = id.startsWith('kebet') && site.type !== 'orbit' ? 'kebet' : id.startsWith('sethis') ? 'sethis' : id.startsWith('roushan') ? 'roushan'
    : site.type === 'heliocentric' ? 'ceinture' : site.type === 'orbit' ? 'station' : 'base';
  return { key: AMBIANCES_SITES[id] ? id : key, ...(AMBIANCES_SITES[id] || AMBIANCES[key]), extra: SITE_EXTRA[id] || [] };
}
