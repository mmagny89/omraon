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
| Délais de communication | minutes à heures entre mondes | Vie quotidienne |
| Ambiances | Kebet, Sethis, Roushan (banque d'images) | Quotidien sensoriel |

## Propositions de conception
| Sujet | Choix | Fichier |
|---|---|---|
| Étoile | F6V, 1,25 M☉, 1,25 R☉, 6490 K, âge 3 Gyr, rotation 5 j | `data/omraon.js` |
| Orbites | Kalpra 0,32 UA, Sethis 0,52, Naksun 0,75, ceinture 1,05–1,55, Zirkan 1,9 (zone habitable), Roushan 30 | `data/omraon.js` |
| Kebet | 345 000 km de Zirkan (jour 1,28 j), 1,1 bar, +56 K d'effet de serre, e ≈ 10⁻⁴ | `data/omraon.js` |
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
