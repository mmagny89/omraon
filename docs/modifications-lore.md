# Modifications du lore — ce que la simulation ajoute ou change

Ce document liste tout ce que la simulation **invente, précise ou modifie** par rapport aux documents du roman (00–13). Il sert à deux choses : reporter dans le roman ce que vous retenez, et corriger la simulation quand le lore change.

- **Canon** : fixé par les documents. **Décidé** : tranché par l'autrice pendant le développement. **Conception** : valeur choisie faute de canon, modifiable. **Provisoire** : placeholder à remplacer.
- La colonne **Décision** est la vôtre : mettez `validé`, `rejeté` ou `à revoir`. Une entrée `rejeté` se retire du code (colonne « Où »).
- Les choix purement physiques ou graphiques (orbites, rendu, anneaux de glace…) sont dans [`hypotheses.md`](hypotheses.md) ; ici, seulement ce qui touche au récit.
- **Règle du projet** : toute décision qui ajoute ou change du lore s'inscrit ici, avec sa date.

## Comment mettre à jour quand le lore change

1. Trouver l'entrée ci-dessous et lire la colonne **Où** : chaque valeur est une constante nommée, une ligne à changer.
2. Modifier la valeur, lancer `npm test` (les tests de population, de chronologie et de lore tombent si un ordre de grandeur sort du canon).
3. Changer le statut de l'entrée (et sa date) ici, puis mettre à jour `hypotheses.md` si la valeur y figure aussi.

## Chronologie et calendrier

| # | Date | Sujet | Canon | Ce que fait la simulation | Statut | Où | Décision |
|---|---|---|---|---|---|---|---|
| 1 | 2026-11-12 | Origine des années | « An 0 = présent » (hypothèse initiale du projet, jamais dans le lore) | **An 0 = début de l'Ère confédérale** (fin des Siècles Sombres) ; départ de la Terre An −660, arrivée An −260, double basculement An −200 | Décidé | `data/chronologie.js` | |
| 2 | 2026-11-12 | Année du présent | Le roman ne donne pas d'année absolue | **An 300**, déduit de la durée de l'ère (300 ans entre la fin des Siècles Sombres et le présent) ; réveils à l'An 298 | Conception, à valider | `AN_PRESENT` dans `data/chronologie.js` | |
| 3 | 2026-11-12 | Âge du système | « Plus vieux que celui du Soleil » | Étoile G0V de **5,8 Gyr** (durée de vie ≈ 7,9 Gyr) | Canon précisé, valeur de conception | `data/omraon.js` | |
| 4 | 2026-11-12 | Calendrier confédéral | Treize mois nommés (docs 02 et 03), ni durée ni fêtes | **13 mois égaux** (≈ 22 jours de Kebet) ; le présent (An 300) commence au premier jour d'Aset | Conception | `data/lore.js`, `moisConfederal` dans `ui/lore.js` | |
| 5 | 2026-11-12 | Jour affiché | « Vrai cycle jour/nuit » sur Kebet | Le **jour de Kebet** (≈ 1,28 j terrestre, 24 h) fait référence pour tout affichage ; l'année reste de 365,25 j terrestres | Décidé | `physics/calendrier.js` | |

## Peuples, démographie, contrôle

| # | Date | Sujet | Canon | Ce que fait la simulation | Statut | Où | Décision |
|---|---|---|---|---|---|---|---|
| 6 | 2026-11-12 | Génocide du monde natal tyt | Génocide en l'An −200, hors système ; aucun chiffre | **30 millions** de Tyts avant ; monde natal **vidé en une demi-année** ; ne restent que trois petits groupes | Décidé (franc, trois groupes) ; chiffres de conception | `nativeN0`, `genocideYears` dans `physics/population.js` | |
| 7 | 2026-11-12 | Survivants du génocide | Quelques milliers de Tyts en pèlerinage sur Kebet à l'arrivée | Tyts de Kebet (4 000 à l'arrivée, ≈ 5 400 au crime) ; **2 000 prisonniers de guerre** (livrés au système, asservis avec eux) ; **1 500 Tyts partis sur Terre** (hors système). Peu nombreux mais assez pour éviter la consanguinité | Décidé ; effectifs de conception ; sort des prisonniers supposé | `T0`, `warPrisoners`, `earthTyts` | |
| 8 | 2026-11-12 | Rapport Tyts / humains | « Tyts plus nombreux dans le travail servile » (doc 02, à relire : total ou seulement parmi les asservis ?) | **0,7 Tyt par humain** au présent (≈ 330 000 Tyts pour 500 000 humains), au lieu de 1,2 | Décidé, en tension possible avec le canon | `tytRatio` | |
| 9 | 2026-11-12 | Contrôle des humains sur les Tyts | Le contrôle tient par la surveillance et se délite quand le savoir se perd | Contrôle requis recalé à **1,04** pour que le présent reste « à un point de bascule » (≈ 56 % de contrôle, bascule An 311) avec le ratio 0,7 | Conception | `controlNeeded` | |
| 10 | 2026-11-12 | Contrôle des naissances tyt | « Produire ou réduire » (doc Économie), sans équations | Trois flux : **naissances décidées**, **naissances empêchées** (le potentiel naturel retenu par les humains, dès le crime), **Tyts éliminés** (la « réduction ») | Décidé (principe) ; équations de conception | `flows` dans `physics/population.js` | |
| 11 | 2026-11-12 | Hybrides humain/Tyt | Aucun dans les documents (le lien de sang, `tarn`, relie « en secret » Tyts et humains) | **Très rares** : ≈ 66 vivants au présent sur ≈ 830 000 habitants, ≈ 700 nés depuis l'arrivée. 40 % des grossesses aboutissent, **15 % des mères meurent en couche**, un enfant sur deux atteint l'âge adulte, mortalité adulte 3 %/an (problèmes génétiques) ; **stériles** | Décidé (existence, rareté, mortalité) ; tous les chiffres de conception | `hybridContact`, `hybridTerm`, `maternalDeath`, `hybridChild`, `hybridMortality` | |
| 12 | 2026-11-11 | Dégel : savoir, désespoir, éveil | Le système est « à un point de bascule » au présent | Demi-vie du savoir 220 ans dès −300, désespoir 95 % puis demi-vie 460 ans, coefficients d'éveil et de révolte | Conception | `physics/population.js` | |

## Lieux, personnages, langue

| # | Date | Sujet | Canon | Ce que fait la simulation | Statut | Où | Décision |
|---|---|---|---|---|---|---|---|
| 13 | 2026-11-12 | Placement des personnages | Doc 08 : origines, lieu exact parfois non tranché | Placement **provisoire** de Théa, Mira, du père Tarnel (cité-mine de Sethis), d'Onkel (repaire de la ceinture), de Heru (port orbital de Kebet), des agents (siège du Consortium) | Provisoire | `data/lore.js` | |
| 14 | 2026-11-12 | Ambiances de onze lieux | Sensoriel détaillé seulement pour Kebet, Sethis, Roushan | Textes déduits de la fonction du lieu et de la physique, **non canon** | Conception | `data/ambiances.js` | |
| 15 | 2026-11-12 | Traducteur tyt | Glossaire du doc 02 (≈ 65 mots) | Mot à mot sur ce glossaire seul ; suffixes `-an` et `-ku`, composés à trait d'union ; **aucun mot, aucune règle inventés** | Canon | `ui/traducteur.js` | |
| 16 | 2026-11-11 | Sites habités | Populations par ordre de grandeur (doc Échelles) | 18 sites et leurs populations (`invented: true`) | Conception | `data/sites.js` | |
| 17 | 2026-11-11 | Shukal | Planète des confins, nom non fixé | **Nom provisoire** ; 0,06 M⊕, orbite de 9,5 M km autour de Roushan | Provisoire | `data/omraon.js` | |

## Économie et commerce

| # | Date | Sujet | Canon | Ce que fait la simulation | Statut | Où | Décision |
|---|---|---|---|---|---|---|---|
| 18 | 2026-11-13 | Monnaie | Aucune monnaie nommée | Le **crédit** (`cr`), nom **provisoire** : l'autrice cherche un nom ; un seul changement dans `MONNAIE` | Provisoire | `data/economie.js` | |
| 19 | 2026-11-13 | Tyts, marchandise et main-d'œuvre | « Recensement du flux servile » à l'octroi de Naksun ; Tyts asservis | Les Tyts sont **achetés, vendus et transportés** (prix de base 2 500 cr, 0,25 de soute par tête) **et** font tourner les mines : sous la main-d'œuvre requise d'un site, sa production baisse au prorata ; on n'en exporte que le surplus | Décidé (principe, autrice) ; chiffres de conception | `MARCHANDISES`, `PROFILS.tytsRequis` | |
| 20 | 2026-11-13 | Marchandises et flux | Mines (Kalpra, Sethis), glace de Nunka → cités de Roushan, raffineries de Roushan, luxe de Kebet | 8 marchandises ; productions et consommations **calées pour s'équilibrer** (eau, vivres, minerai, carburant…) ; Kebet nourrit le système, Roushan le ravitaille en carburant | Conception | `PROFILS`, `CONSO_HABITANT` | |
| 21 | 2026-11-13 | Octroi, douane, contrebande | Octroi de Naksun (péage, fouille), douane du port de Kebet, réseau d'Onkel | **Péage de 6 %** sur tout voyage qui franchit la limite de la zone intérieure (mines) ; **douane de 10 %** à l'arrivée à Kebet ; la contrebande évite les deux mais **perd 12 % de sa cargaison** à la fouille (valeur moyenne, sans hasard) | Conception | `PROFILS.peage/taxe`, `TRANSPORTEURS.risque` | |
| 22 | 2026-11-13 | Transporteurs | Ella Corren, capitaine du *Mai* ; Onkel | Flottes du Consortium, flottilles de Roushan, chalands de glace, convois des mines, cabotiers, plus *Mai* (soute 60) et le réseau d'Onkel (soute 80) ; **soutes, caisses et effectifs inventés** | Conception | `TRANSPORTEURS` | |
| 23 | 2026-11-13 | Misère et dégel du contrôle | Le système est « à un point de bascule » au présent ; le contrôle tient par la surveillance | Une pénurie durable (vivres, eau, carburant) devient une **crise de misère** dans le modèle de population : elle **accélère l'éveil des Tyts** (× 1 + 2·m) et **fait perdre du contrôle** (− 25 %·m, gardes détournées vers le ravitaillement), puis s'estompe (demi-vie 3 ans). Couper la glace de Nunka pendant 90 j de Kebet avance la bascule de l'An 311 à l'An 307 | Conception (coefficients inventés) | `misere*` dans `physics/population.js`, `misereSysteme` dans `physics/economie.js` | |
| 24 | 2026-11-13 | Cargaisons mixtes | Aucun détail | Un convoi peut charger plusieurs marchandises vers une même destination (la plus rentable au volume d'abord) ; les petits sites (confins, Shukal) sont mieux servis | Conception | `meilleur` dans `physics/economie.js` | |
| 25 | 2026-11-13 | Port de Kebet tenu au-dessus de la capitale | Port d'entrée du monde habité (doc 01) ; aucun emplacement ni orbite précisés | Le port est **tenu en place** au-dessus du siège du Consortium (lat 33°, lon 28°, 600 km) et suit la rotation de Kebet. **Aucune orbite ne le permet** : l'orbite qui suivrait la rotation (≈ 47 000 km) est hors de la sphère de Hill de Kebet (≈ 32 500 km, limite stable ≈ 16 000 km) ; et une orbite synchrone reste équatoriale, la capitale est à 33°. Il faut donc une **poussée continue** (≈ 0,8 g à 600 km), celle des moteurs de vaisseaux : **décidé par l'autrice (2026-11-13)**. Conséquences : pas de rotation, la poussée fait le poids des occupants ; la station brûle du carburant en permanence (**60 t/jour**, ordre de grandeur de conception, livrés par les convois ; la production de Roushan passe à 330 t/jour) | Décidé (principe) ; valeurs de conception | `fixe` dans `data/sites.js`, `physics/sites.js` ; test `tests/station.test.js` | |
| 26 | 2026-11-13 | Événements datés de l'économie | Aucun | Blocus d'un site, piraterie (part de cargaison perdue), grève d'une flotte, péage multiplié, sur une fenêtre choisie ; en valeur moyenne, sans hasard | Conception | `evenements` dans `physics/economie.js`, `EVENEMENTS` dans `ui/economie.js` | |
| 27 | 2026-11-13 | Ceinture productive | Ceinture Nunzir : repaire de pirates et de contrebandiers (Onkel, Ella) | Deux mines libres s'ajoutent à la ceinture, hors du contrôle du Consortium : **Fonderies libres** (45 t/jour de minerai, 14 de métaux) et **Chalands de glace** (45 t/jour d'eau), 7 000 habitants. Elles livrent surtout Roushan (minerai), les mines de Sethis (eau) et Kebet (métaux) ; sans elles, la misère du système est quatre fois plus forte. Les passeurs d'Onkel sont renforcés. Les mineurs libres paient la douane de Kebet, la contrebande y échappe | Décidé (principe, autrice) ; sites, tonnages et convois inventés | `ceinture-*` dans `data/sites.js`, `PROFILS` et `TRANSPORTEURS` dans `data/economie.js` | |
| 28 | 2026-11-13 | Puits de gravité et coût de lancement | Aucun | Quitter un lieu coûte du carburant selon sa vitesse de libération (Sethis 11 km/s, Kalpra 7,9, Kebet 10,5, Roushan 12 par navettes d'altitude, astéroïdes ≈ 0) : c'est ce qui rend la ceinture moins chère que les planètes-mines | Conception | `puits` dans `PROFILS`, `lancement` dans `REGLAGES` | |
| 29 | 2026-11-13 | Distance de Roushan | « Géante externe pâle et froide » ; bord du système ≈ 35 UA (provisoire) ; délais de communication de minutes à heures | **Roushan passe de 30 UA à 12 UA** (essai, après 20 UA). Dans la fourchette crédible (10–15 UA) pour la formation d'une géante de 0,35 masse de Jupiter (Saturne : 9,5 UA, 0,30). Effets mesurés : vol Roushan–intérieur 3,5 jours (5,5 à 30 UA), lumière 1,7 h, **124 K** au niveau 1 bar (78 K à 30 UA), sphère de Hill 81 M km (limite stable 40 M km, Shukal à 9,5 M km reste dedans), 21 % de voyages en plus, misère du système 0,6 % (1,7 % à 30 UA). L'accélération de 8 g reste calée sur le bord de 35 UA | Conception, essai | `orbit.a` de Roushan dans `data/omraon.js` | |
| 30 | 2026-11-13 | Troyens de Roushan | Aucun | Un essaim de 300 traceurs aux points L4 et L5 de Roushan (±60°, même orbite), et un site : **Chantiers des troyens de Roushan** (1 800 habitants, 30 t/jour d'eau, 12 t/jour de minerai), ravitaillement le plus proche des cités flottantes | Conception | `ROUSHAN_TROJANS` dans `data/omraon.js`, `troyens-roushan` dans `data/sites.js` | |
| 31 | 2026-11-13 | Ceinture froide | Bord du système ≈ 35 UA ; Roukir « vraie frontière extérieure » (lune de Roushan) | Une ceinture de glace de **17 à 34 UA** (équivalent de la ceinture de Kuiper, dans le bord de 35 UA, au-delà de la résonance 3:2 de Roushan à 15,7 UA), et un site : **Avant-poste de la ceinture froide** (500 habitants, 15 t/jour d'eau) | Conception | `COLD_BELT` dans `data/omraon.js`, `froide-relais` | |
| 32 | 2026-11-13 | Comètes et centaures | Aucun | 40 corps sur des orbites très excentriques (périhélie 3–15 UA, aphélie 24–40 UA) qui retombent depuis la ceinture froide ; un corps perdu (éjecté ou capturé) est remplacé par un autre. Rendu seulement | Conception | `COMETS` dans `data/omraon.js` | |
| 33 | 2026-11-13 | Lacunes de Kirkwood et amas de Hilda | Aucun | La ceinture a des **lacunes** aux résonances 7:3 (1,081 UA) et 2:1 (1,197 UA) avec Zirkan, et un **amas stable** à la 3:2 (1,45 UA, 6 % des traceurs). Les Fonderies libres passent de 1,17 à **1,13 UA**, hors lacune | Conception (calcul) | `BELT.gaps`, `BELT.hilda` dans `data/omraon.js` ; `ceinture-fonderies` | |

## À trancher dans le roman

Questions que la simulation a dû poser sans réponse du lore :

- Quelle année absolue pour le présent (entrée 2) ?
- « Tyts plus nombreux » : au total, ou parmi les travailleurs asservis seulement (entrée 8) ?
- Où sont les prisonniers de guerre après le génocide (entrée 7) ? Les hybrides sont-ils vraiment stériles (entrée 11) ?
- Les hybrides sont-ils connus des humains, des Tyts, ou cachés (le lien de sang est « secret ») ?
- Quel nom pour la monnaie (entrée 18) ? Existe-t-il une monnaie parallèle (contrebande, troc, crédit des Tyts) ?
- Le prix d'un Tyt est-il un fait du roman (entrée 19) ? Qui l'encaisse : le Consortium, les armateurs ?
- Le port de Kebet brûle du carburant en continu pour rester en place (entrée 25) : qui paie ? La consommation est comptée (60 t/jour) mais n'est pas payée : la station n'a pas de budget.
- Roushan à 12 UA (entrée 29) convient-elle ? Le bord du système reste-t-il à 35 UA avec une ceinture froide de 17 à 34 UA (entrée 31) ?
