// Données de lore reprises des documents du roman (zip « Lore », docs 00–13) : personnages, vestiges des Anciens, calendrier.
// Règles respectées : pas de racines égyptiennes affichées, pas d'arcs ni de révélations (fiche d'orientation, pas un résumé du roman),
// les « icebergs » restent des indices (« à ne jamais tout expliquer »). `statut` d'un lieu : 'canon' (écrit dans les documents)
// ou 'provisoire' (placement proposé ici, le document le laisse ouvert : voir docs/hypotheses.md).

/** Calendrier confédéral (doc 03 Religion, doc 02 Tyts §6) : 13 mois aux noms tyts fossilisés. Durée des mois : non fixée par le lore. */
export const MOIS = ['Aset', 'Pharmouti', 'Pakhons', 'Payni', 'Epiphi', 'Mesore', 'Thot', 'Paophi', 'Athyr', 'Choiak', 'Tybi', 'Mechir', 'Pamenoth'];

/**
 * Personnages au présent du roman (doc 08 Personnages). origine : { corps, site (id de data/sites.js ou null), statut }.
 * `vivant: false` : personnage évoqué mais disparu au présent.
 */
export const PERSONNAGES = [
  { id: 'ella', nom: 'Ella Corren', role: 'Capitaine du Mai, transporteuse', espece: 'Humaine', age: 35,
    resume: 'Citoyenne de la Confédération, du Milieu. Née et grandie dans les cités flottantes de Roushan ; fille d\'un ingénieur de la station.',
    origine: { corps: 'Roushan', site: 'roushan-cites', statut: 'canon' } },
  { id: 'jax', nom: 'Jax', role: 'Petit frère d\'Ella, prodige de l\'informatique', espece: 'Humain',
    resume: 'Suit la voie de son père : l\'intégration, l\'ingénierie, la station-usine de Roushan.',
    origine: { corps: 'Roushan', site: 'roushan-cites', statut: 'canon' } },
  { id: 'parents-ella', nom: 'Les parents d\'Ella', role: 'Un ingénieur de la station-usine, une soignante', espece: 'Humains',
    resume: 'Le père (Corren) fait tourner la grande station-usine de Roushan ; la mère travaille dans le soin.',
    origine: { corps: 'Roushan', site: 'roushan-cites', statut: 'canon' } },
  { id: 'mai', nom: 'Mai', role: 'Grand-mère maternelle d\'Ella', espece: 'Humaine', vivant: false,
    resume: 'Morte il y a deux ou trois ans. Arrivée dans le système de Roushan, elle y a élevé Ella au quotidien ; le vaisseau porte son nom.',
    origine: { corps: 'Roushan', site: 'roushan-cites', statut: 'canon' } },
  { id: 'eirik', nom: 'Eirik Kelsen', role: 'Le visage et la voix du Mai', espece: 'Humain',
    resume: 'Du Haut, famille d\'ascendance « nordique » (sens perdu). Croyant sincère en Osaon, neveu d\'Onkel.',
    origine: { corps: 'Kebet', site: null, statut: 'canon' } },
  { id: 'thea', nom: 'Théa Mbayo', role: 'Mécanicienne et infirmière du Mai', espece: 'Humaine',
    resume: 'Du Bas, monde minier. Sceptique, débrouillarde ; veut faire monter ses deux sœurs, restées dans le Bas.',
    origine: { corps: 'Sethis', site: 'sethis-cite-a', statut: 'provisoire' } },
  { id: 'onkel', nom: 'Onkel', role: 'Patron officieux d\'un réseau de contrebande', espece: 'Humain',
    resume: 'Façade : gros marchand respecté, entrepôts légaux. Opère dans et autour de la ceinture de Nunzir, l\'angle mort du système.',
    origine: { corps: 'Nunzir', site: 'nunzir-repaire', statut: 'provisoire' } },
  { id: 'heru', nom: 'Heru', role: 'Chat du Mai', espece: 'Chat', age: 2,
    resume: 'Mâle tricolore à poil long, recueilli chaton sur une station de Kebet : un peu de vivant de Kebet à bord.',
    origine: { corps: 'Kebet', site: 'kebet-orbite', statut: 'provisoire' } },
  { id: 'mira', nom: 'Mira-Sum Kaha', role: 'Tyt, une des deux focales', espece: 'Tyt', age: 28,
    resume: 'Née sur Sethis, esclave d\'une corporation d\'extraction, rachetée par le père Tarnel « pour le Clergé ». Dernière porteuse de la lignée Kaha.',
    origine: { corps: 'Sethis', site: 'sethis-cite-a', statut: 'provisoire' } },
  { id: 'tarnel', nom: 'Le père Tarnel', role: 'Missionnaire du Bas, historien du clergé', espece: 'Humain',
    resume: 'Vieux prêtre, toute sa vie au contact de la religion et des Tyts. Fondamentalement bon, au service d\'un système qui broie.',
    origine: { corps: 'Sethis', site: 'sethis-cite-a', statut: 'provisoire' } },
  { id: 'agents', nom: 'Les agents du Consortium', role: 'Deux antagonistes visibles, sans nom', espece: 'Humains',
    resume: 'Émanations du système plus que des individus : l\'un croyant sincère, l\'autre cynique.',
    origine: { corps: 'Kebet', site: 'kebet-consortium', statut: 'provisoire' } },
];

/**
 * Vestiges de la Première Race (les Iktu, « les Anciens »). niveau : 'canon' (écrit), 'iceberg' (indice : à ne jamais tout expliquer),
 * 'ouvert' (fil que le lore n'a pas tranché). horsSysteme : sans lieu dans la simulation.
 */
export const VESTIGES = [
  { id: 'kebet-jardin', titre: 'Le jardin des Anciens', corps: 'Kebet', site: null, niveau: 'iceberg', source: '01 Système',
    texte: 'Kebet aurait été autrefois occupée ou façonnée par la Première Race : sa fertilité serait peut-être terraformée, un « jardin » laissé par des mains disparues.' },
  { id: 'kebet-faune', titre: 'Une faune native étrange', corps: 'Kebet', site: null, niveau: 'iceberg', source: '05 Vie quotidienne',
    texte: 'Certains organismes natifs pourraient être des vestiges ou des outils des Anciens. Faune et flore natives restent à esquisser.' },
  { id: 'kebet-sanctuaire', titre: 'Le sanctuaire tyt volé', corps: 'Kebet', site: 'kebet-temples', niveau: 'canon', source: '01 Système, 13 Quotidien Kebet',
    texte: 'Kebet n\'est pas le monde natal des Tyts : c\'est un site sacré dédié aux Anciens, où ils venaient en pèlerinage. Les humains l\'ont profané (Crime 1) et célèbrent Aa-set-Kaan sous un faux nom dans les grands temples.' },
  { id: 'astir-balise', titre: 'La balise d\'Astir', corps: 'Astir', site: 'astir-balise', niveau: 'iceberg', source: '01 Système',
    texte: 'Lune-observatoire et balise de navigation qui guide les vaisseaux vers Kebet : vestige possible d\'une balise des Anciens.' },
  { id: 'monde-natal', titre: 'Le monde natal tyt, détruit', niveau: 'canon', horsSysteme: true, source: '01 Système (hors-système)',
    texte: 'Le vrai berceau des Tyts, ailleurs, détruit il y a environ 500 ans (Crime 2). Escale-archive du voyage : coordonnées de la Terre, une part de la vérité sur Kebet, des cristaux. Emplacement à trancher.' },
  { id: 'hangar-musee', titre: 'Le hangar-musée des vaisseaux tyts', niveau: 'ouvert', horsSysteme: true, source: '01 Système (hors-système)',
    texte: 'Dépôt de plans, de pièces, de cristaux et d\'un moteur des Créateurs. Localisation à caler : peut-être près du monde natal détruit, peut-être distinct.' },
  { id: 'cristaux', titre: 'Les cristaux tyts', niveau: 'ouvert', horsSysteme: true, source: '08 Personnages, 02 Tyts',
    texte: 'Clés de données d\'avant les Siècles Sombres : combien, où, que contiennent-ils ? Fil ouvert du lore.' },
];
