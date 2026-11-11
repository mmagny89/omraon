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

export function ambianceFor(site) {
  const id = site.id;
  const key = id.startsWith('kebet') && site.type !== 'orbit' ? 'kebet' : id.startsWith('sethis') ? 'sethis' : id.startsWith('roushan') ? 'roushan'
    : site.type === 'heliocentric' ? 'ceinture' : site.type === 'orbit' ? 'station' : 'base';
  return { key, ...AMBIANCES[key], extra: SITE_EXTRA[id] || [] };
}
