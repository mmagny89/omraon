# Canon et hypothèses de conception

**Canon** = ce que les documents (00–13) fixent. **Conception** = ce que cette simulation a dû choisir ; tout est modifiable dans les fichiers indiqués.

## Repris du canon
| Sujet | Valeur | Source |
|---|---|---|
| Ordre du système | 3 telluriques → ceinture → 2 gazeuses ; seule vie : Kebet | Bible géographique |
| Bord du système | ~35 UA (provisoire) | Bible géographique |
| Propulsion | subluminique ~0,1 c ; hyperpropulsion ~0,95 c, ~6 jours continus au plus | Technologie |
| Voyage des arches | 0,35 c, ~400 ans (≈ 140 années-lumière) | Technologie, Chronologie |
| Population | une arche de ~10 000 ; 300 000–800 000 humains au présent ; Haut (Kebet) : dizaines de milliers ; Tyts plus nombreux dans le travail servile | Économie et échelles |
| Chronologie | An 0 = début de l'Ère confédérale ; présent = An 300 (conception) ; −660 départ, −260 arrivée, −200 double basculement, 0 fin des Siècles Sombres, 298 réveils (le doc 10 donne ces écarts depuis le présent) | Chronologie |
| Âge du système | **plus vieux que celui du Soleil (≈ 4,6 Gyr)** : l'étoile a abrité une ancienne civilisation | Lore (précisé par l'autrice) |
| Délais de communication | minutes à heures entre mondes | Vie quotidienne |
| Ambiances | Kebet, Sethis, Roushan (banque d'images) | Quotidien sensoriel |

## Propositions de conception
| Sujet | Choix | Fichier |
|---|---|---|
| Étoile | G0V, 1,10 M☉, 1,10 R☉, 5900 K (L = 1,32 L☉), **âge 5,8 Gyr** (valeur de conception pour respecter le canon « plus vieille que le Soleil » ; durée de vie ≈ 7,9 Gyr, il reste ≈ 2,1 Gyr), rotation ≈ 15 j, +13 % de luminosité par Gyr | `data/omraon.js`, `data/chronologie.js` |
| Orbites | Kalpra 0,32 UA, Sethis 0,52, Naksun 0,75, ceinture 1,05–1,55, Zirkan 1,9 (zone habitable), Roushan **12** (essai du 2026-11-13, était 30 puis 20 ; fourchette crédible 10–15 UA, voir `modifications-lore.md` n° 29) ; ceinture froide 17–34 UA ; troyens de Roushan ; comètes (n° 30–33) | `data/omraon.js` |
| Kebet | 345 000 km de Zirkan (jour 1,28 j), 1,1 bar, **+90 K d'effet de serre** (relevé de +56 K quand l'étoile est passée de F6V à G0V : Zirkan, à 1,9 UA, est au bord extérieur de la zone habitable), e ≈ 10⁻⁴ | `data/omraon.js` |
| Zirkan, Roushan | champ magnétique 0,0005 et 0,03 × Jupiter ; Roushan T(1 bar) = 1,63 × T équilibre | `data/omraon.js` |
| Sethis | atmosphère ténue 0,05 bar (vent, poussière) | `data/omraon.js` |
| Shukal | planète-colonie des confins : nom provisoire, 0,06 M⊕, orbite de 9,5 M km autour de Roushan | `data/omraon.js` |
| Sites | 18 emplacements, populations et Tyts (`invented: true`) | `data/sites.js` |
| Accélération des vaisseaux | 8 g (≈ 35 UA en 6 jours), repos moteur d'un jour | `physics/transfers.js`, `physics/flight.js` |
| Réseau | taux de diffusion locale, répression, graines, filtre du Consortium (~65 %) | `physics/network.js` |
| Population et dégel | demi-vie du savoir 220 ans dès −300, désespoir 95 % → demi-vie 460 ans, ratio Tyts 0,7 (voir `modifications-lore.md`), contrôle requis 1,04, coefficients d'éveil, hybrides humain/Tyt | `physics/population.js` |
| Habitabilité | seuils vert/orange/rouge, gravité 0,6–1,5 g, dose visée 0,2 mSv/j, etc. | `physics/habitability.js`, `physics/habitat.js` |
| Économie | marchandises, prix par rareté (`(cible/stock)^0,7`, ×0,2 à ×5), transporteurs qui maximisent le profit par jour (cargaisons mixtes), grand livre fermé, misère du système couplée à la population (#23), carburant pris aux raffineries de Roushan, distances figées à la date des positions (voir `modifications-lore.md` #18–22) | `data/economie.js`, `physics/economie.js` |
| Ressources | stocks et extractions estimés par corps ; aucun ne s'épuise (voir `ressources.md`) | `docs/ressources.md` |
| Hasard économique | mode à graine : un convoi saisi ou pillé perd toute sa cargaison, sinon rien (même probabilité que la part perdue en moyenne) | `graine` dans `physics/economie.js` |
| Port de Kebet | tenu en place au-dessus de la capitale (aucune orbite ne le permet : voir `modifications-lore.md` #25) | `data/sites.js`, `physics/sites.js` |
| Troyens de Zirkan | 400 astéroïdes, activés par défaut (non canon) | `physics/simulation.js` |

## Questions ouvertes du document, tranchées provisoirement
- **Planète en cours de colonisation (Mouvement II)** : Shukal, aux confins autour de Roukir ; à confirmer.
- **Calendrier affiché** : jour = jour de Kebet (période orbitale calculée, ≈ 1,28 j terrestre), 24 h par jour, minute et seconde proportionnelles ; l'année reste de 365,25 j terrestres (≈ 285 jours de Kebet, le dernier est partiel). La limite de 6 jours de l'hyperpropulsion reste en jours terrestres (≈ 4,7 jours de Kebet). Conception : le roman ne chiffre pas ce calendrier. `physics/calendrier.js`.
- **Journée de Kebet** : 1,28 j (rotation synchrone) ; le document parle d'un « vrai cycle jour/nuit ».
- **Nombre de Tyts** : géré (ratio visé 0,7) ou subi (croissance sous contrainte), au choix dans le panneau.

## Rendu (conception, sans effet sur la physique)

- Halos atmosphériques : Zirkan et Roushan (épaisseur 7 % du rayon), Sethis (voile de poussière ténu, cohérent avec 0,05 bar), Kebet. Couleurs et intensités : `data/omraon.js`, champ `atmosphere`.
- Relief : carte de relief générée par le même bruit que la texture, sans lien avec une topographie canonique ; terminateur adouci par un éclairage enveloppant (`render/world.js`).
- Lumière de la planète sur ses lunes (face nuit) : albédo × phase × (R/d)², **exagérée ×6** pour être visible (`PLANETSHINE_BOOST`, `render/world.js`). L'ombre d'éclipse (la planète masque l'étoile) n'a aucun facteur d'exagération : elle reprend le calcul des éphémérides.
- Infobulles : repères de comparaison (Mars, Terre, Jupiter, Soleil) et bande « eau liquide » à 1 bar, purement indicatifs (`ui/tooltips.js`).
- **Anneaux** (conception, rendu seulement ; le roman n'en mentionne aucun) : Roushan, anneaux de glace de 1,3 à 2,3 rayons avec deux divisions (1,85–1,92 R et 2,12–2,14 R), Nunka à 11 R largement au-delà ; Zirkan, anneau poussiéreux et ténu de 1,2 à 2,0 R, bien à l'intérieur de Kebet (4,7 R) et de la limite de Roche. Les anneaux n'ont pas de masse ni d'effet sur la physique. Paramètres : champ `rings` dans `data/omraon.js`. Ombres croisées planète/anneau calculées dans les shaders (`render/world.js`). Dessinés aussi dans le ciel vu d'un site (`render/skyView.js`, même profil que le rendu 3D) : de profil depuis Kebet, qui orbite à 0,3° de l'équateur de Zirkan, l'anneau n'est qu'une ligne fine.
- **Lumières de Kebet** (rendu seulement) : un foyer par site au sol (rayon ∝ √population) et des hameaux semés autour, sur les terres de la texture ; les hameaux, leur nombre et leur étalement sont inventés, et les tailles exagérées pour être lisibles à l'échelle de la planète (`makeLightsTexture`, `render/textures.js`). Visibles côté nuit et pendant une éclipse de Zirkan.
- **Vue à hauteur d'yeux** : partage avec la vue 3D le terminateur adouci, les lumières nocturnes (gatées par la face nuit, donc plus de lueur de jour vue d'une station), l'ombre d'éclipse et l'anneau des astres visibles ; vu de profil depuis Kebet, l'anneau de Zirkan n'y est qu'un trait très ténu (`render/eclairage.js`, `render/ground.js`).

## Lore (documents du roman, zip « Lore », docs 00–13)

- **Source** : glossaire (doc 02 Tyts), personnages et origines (doc 08), vestiges des Anciens (docs 01, 05, 13), calendrier (docs 02 et 03). Rien n'est inventé dans ces listes ; seuls les **placements de site** sont proposés quand le document ne tranche pas (`statut: 'provisoire'`) : Théa, Mira et le père Tarnel à la cité-mine de Sethis (« quartier du père Tarnel à préciser » dans les docs), Onkel au repaire de la ceinture, Heru au port orbital de Kebet, les agents au siège du Consortium.
- **Hors affichage par choix** : les arcs et révélations (sort des parents, faute de Jax, cristaux…), les racines égyptiennes (jamais affichées), les échos que le lore demande de ne jamais souligner.
- **Icebergs** : la terraformation de Kebet, la faune native, la balise d'Astir sont des indices (« à ne jamais tout expliquer ») ; un interrupteur les masque.
- **Calendrier confédéral** : le lore (docs 02 et 03) donne 13 mois nommés mais ni leur durée ni les fêtes ; ici 13 mois égaux (≈ 22 jours de Kebet), l'An 0 commençant au premier jour d'Aset (`ui/lore.js`, `moisConfederal`). À remplacer dès que le lore tranche.
- **Vue à hauteur d'yeux : correction** : `lookAt` (étoile, planète parente) visait l'azimut symétrique (`yaw = −az`) ; le cap affiché suit maintenant l'azimut réel.
- **Traducteur tyt ⇄ français** (`ui/traducteur.js`) : outil de conception, pas une langue. Mot à mot sur le seul glossaire (canon) ; seules morphologies admises : composés à trait d'union, suffixes `-an` (pluriel) et `-ku` (agent), alias « courant ». Aucun mot, aucune conjugaison ni ordre des mots n'est inventé : tout mot absent ressort entre crochets. Le français → tyt ne trouve que les mots dont le sens du glossaire contient le terme (premier sens de chaque entrée) ; plusieurs candidats sont listés.
- **Origine de la frise** : l'An 0 est le début de l'Ère confédérale ; le présent est l'An 300 parce que l'ère dure ~300 ans dans la chronologie (fin des Siècles Sombres à −300 du présent). Le roman ne donne pas d'année absolue du présent : à remplacer si besoin en changeant `AN_PRESENT` (`data/chronologie.js`). Le temps interne, les liens partagés (`t=` en jours depuis le présent) et la physique ne changent pas ; seul l'affichage convertit.
- **Génocide du monde natal et contrôle des naissances tyt** (`physics/population.js`, panneau Population) : le canon donne le génocide (An −200, hors système) mais aucun chiffre. Choix : génocide très franc (monde natal à 30 millions de Tyts, vidé en une demi-année) ; ne subsistent que trois petits groupes, assez nombreux pour refaire des générations sans consanguinité : les Tyts déjà sur Kebet (`T0`, ≈ 5 400 au crime), des prisonniers de guerre (2 000, supposés livrés au système et asservis avec eux, donc ajoutés aux Tyts du système au crime) et les Tyts partis sur Terre (1 500, hors système, simple croissance naturelle). Effectifs réglables dans le panneau. Flux du système, de conception : naissances décidées (production vers le ratio visé, ou croissance subie), naissances empêchées (le potentiel naturel `tytGrowth × T` retenu par les humains, jamais avant le crime ni en mode subi), Tyts éliminés (la « réduction » : proportionnelle à l'éveil, plus l'excédent sur le ratio visé). Le document dit « produire ou réduire » sans équations.
- **Hybrides humain/Tyt** (`physics/population.js`, panneau Population) : n'existent pas dans les documents ; invention : conceptions = `hybridContact × √(H·T) / 1e6` par an (30 pour 1 M × 1 M), 40 % menées à terme, 15 % des mères mortes en couche, un enfant sur deux atteint l'âge adulte, mortalité adulte 3 %/an, stérilité. Résultat au présent : ≈ 66 vivants. Voir `modifications-lore.md`.
- **Ratio Tyts / humains 0,7** : décision de l'autrice (2026-11-12) ; `controlNeeded` passe de 0,6 à 1,04 pour garder un présent « à un point de bascule » (contrôle ≈ 56 %). Le test n'exige plus « Tyts plus nombreux que les humains ».
- **Ambiances de onze lieux** : le lore ne détaille le sensoriel que pour Kebet, Sethis et Roushan ; les autres lieux sont déduits de leur fonction (docs 01, 03, 04, 05) et de la physique (pesanteur, lumière, froid). À valider ou remplacer par de vrais textes (`AMBIANCES_SITES`).
- **Flux commerciaux sur la carte** (rendu seulement, `render/flux.js`) : un point par convoi en vol (couleur = marchandise, rouge = contrebande), des rubans entre sites dont la largeur croît avec le volume livré (60 routes au plus). Profil de vitesse simplifié (accélération puis freinage constants, sans repos moteur) ; les extrémités suivent les sites réels, donc l'arrivée peut s'écarter un peu du jour calculé. Les repositionnements à vide ne sont pas dessinés. À l'échelle du système, les trajets internes à Zirkan ou à Kebet font moins d'un pixel : zoomer.
