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
| Chronologie | An 0 = présent ; −960 départ, −560 arrivée, −500 double basculement, −300 fin des Siècles Sombres, −2 réveils | Chronologie |
| Âge du système | **plus vieux que celui du Soleil (≈ 4,6 Gyr)** : l'étoile a abrité une ancienne civilisation | Lore (précisé par l'autrice) |
| Délais de communication | minutes à heures entre mondes | Vie quotidienne |
| Ambiances | Kebet, Sethis, Roushan (banque d'images) | Quotidien sensoriel |

## Propositions de conception
| Sujet | Choix | Fichier |
|---|---|---|
| Étoile | G0V, 1,10 M☉, 1,10 R☉, 5900 K (L = 1,32 L☉), **âge 5,8 Gyr** (valeur de conception pour respecter le canon « plus vieille que le Soleil » ; durée de vie ≈ 7,9 Gyr, il reste ≈ 2,1 Gyr), rotation ≈ 15 j, +13 % de luminosité par Gyr | `data/omraon.js`, `data/chronologie.js` |
| Orbites | Kalpra 0,32 UA, Sethis 0,52, Naksun 0,75, ceinture 1,05–1,55, Zirkan 1,9 (zone habitable), Roushan 30 | `data/omraon.js` |
| Kebet | 345 000 km de Zirkan (jour 1,28 j), 1,1 bar, **+90 K d'effet de serre** (relevé de +56 K quand l'étoile est passée de F6V à G0V : Zirkan, à 1,9 UA, est au bord extérieur de la zone habitable), e ≈ 10⁻⁴ | `data/omraon.js` |
| Zirkan, Roushan | champ magnétique 0,0005 et 0,03 × Jupiter ; Roushan T(1 bar) = 1,63 × T équilibre | `data/omraon.js` |
| Sethis | atmosphère ténue 0,05 bar (vent, poussière) | `data/omraon.js` |
| Shukal | planète-colonie des confins : nom provisoire, 0,06 M⊕, orbite de 9,5 M km autour de Roushan | `data/omraon.js` |
| Sites | 18 emplacements, populations et Tyts (`invented: true`) | `data/sites.js` |
| Accélération des vaisseaux | 8 g (≈ 35 UA en 6 jours), repos moteur d'un jour | `physics/transfers.js`, `physics/flight.js` |
| Réseau | taux de diffusion locale, répression, graines, filtre du Consortium (~65 %) | `physics/network.js` |
| Population et dégel | demi-vie du savoir 220 ans dès −300, désespoir 95 % → demi-vie 460 ans, ratio Tyts 1,2, coefficients d'éveil | `physics/population.js` |
| Habitabilité | seuils vert/orange/rouge, gravité 0,6–1,5 g, dose visée 0,2 mSv/j, etc. | `physics/habitability.js`, `physics/habitat.js` |
| Troyens de Zirkan | 400 astéroïdes, activés par défaut (non canon) | `physics/simulation.js` |

## Questions ouvertes du document, tranchées provisoirement
- **Planète en cours de colonisation (Mouvement II)** : Shukal, aux confins autour de Roukir ; à confirmer.
- **Calendrier affiché** : jour = jour de Kebet (période orbitale calculée, ≈ 1,28 j terrestre), 24 h par jour, minute et seconde proportionnelles ; l'année reste de 365,25 j terrestres (≈ 285 jours de Kebet, le dernier est partiel). La limite de 6 jours de l'hyperpropulsion reste en jours terrestres (≈ 4,7 jours de Kebet). Conception : le roman ne chiffre pas ce calendrier. `physics/calendrier.js`.
- **Journée de Kebet** : 1,28 j (rotation synchrone) ; le document parle d'un « vrai cycle jour/nuit ».
- **Nombre de Tyts** : géré (ratio visé 1,2) ou subi (croissance sous contrainte), au choix dans le panneau.

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
