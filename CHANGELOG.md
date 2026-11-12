# Journal des versions

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le projet suit
le [versionnement sémantique](https://semver.org/lang/fr/).

## [Non publié]

## [1.1.0] - 2026-11-12

### Ajouté

- Lore du roman : glossaire tyt (lexique du doc 02, noms des mondes, mois), personnages placés dans leur lieu d'origine, vestiges des Anciens (avec interrupteur des « icebergs »), calendrier confédéral de 13 mois, liturgie solaire des temples, ambiances de onze lieux (non canon). Chaque section de fiche porte son statut canon / conception / calculé / provisoire.
- Traducteur tyt ⇄ français (onglet Lore) : mot à mot sur le seul glossaire, suffixes `-an` et `-ku`, composés à trait d'union ; aucun mot ni règle inventés, les mots inconnus restent entre crochets.
- Population : trois graphiques légendés (effectifs et contrôle, contrôle des naissances tyt, hybrides humain/Tyt) en plus du dégel, avec lecture des chiffres d'une année au survol à la souris.
- Génocide du monde natal tyt (An −200) modélisé de façon franche : monde vidé, trois petits groupes de survivants (Tyts de Kebet, prisonniers de guerre, Tyts partis sur Terre) ; contrôle des naissances par les humains en trois flux (décidées, empêchées, éliminées) ; hybrides humain/Tyt très rares (naissances menées à terme, mères mortes en couche).
- Frise : l'année sous le pointeur s'affiche au survol, avec un repère fantôme.
- Options : rail de sections à gauche et grand panneau, une section à la fois (bandeau sur téléphone), dernière section mémorisée.
- Sections des fiches en cartes avec bouton de pliage et mention « déplier ».
- `docs/modifications-lore.md` : tout ce que la simulation invente ou change par rapport aux documents du roman, avec statut, fichier et colonne de décision ; règle ajoutée au `CLAUDE.md`.
- Rendu et ergonomie (détaillés dans le README) : jour de Kebet comme unité de temps affichée, anneaux de Roushan et de Zirkan, lumières nocturnes de Kebet, infobulles graphiques, visite guidée, lien partageable, photo et carnet de scènes, comparateur de lieux, fiche de la ceinture Nunzir, page de chargement, accessibilité.

### Modifié

- **Origine des années** : l'An 0 est le début de l'Ère confédérale et le présent du roman est l'An 300 (conception). Seul l'affichage convertit ; le temps interne et les liens partagés restent comptés depuis le présent, les anciens liens fonctionnent.
- Rapport Tyts / humains visé à 0,7 (il était de 1,2), contrôle requis recalé à 1,04 pour garder un présent « à un point de bascule » ; le test n'exige plus « Tyts plus nombreux que les humains ».
- L'étoile Omraon passe de F6V (1,25 M☉, 3 Gyr) à G0V (1,10 M☉, 5900 K, 5,8 Gyr) : le lore veut un système plus vieux que celui du Soleil, qui a abrité une ancienne civilisation. Zirkan reste dans la zone habitable (bord extérieur) ; l'effet de serre de Kebet passe de +56 K à +90 K pour garder un sol à ≈ 288 K.

### Corrigé

- Vue à hauteur d'yeux : le cap affiché suit l'azimut réel (il était symétrique).
- Repères de l'axe des années des courbes de population, restés en années internes après le changement d'origine.
- Identifiant dupliqué dans le panneau Options (`tr-out`), signalé par la porte HTML.

## [1.0.0] - 2026-11-11

### Ajouté

- Socle Docker statique généré par `.claude/scripts/setup-statique.sh` (Caddy seul, contexte serveur partagé).
- Simulation N-corps du système d'Omraon : leapfrog symplectique réversible d'ordre 4, relativité générale 1PN, lunes en N-corps ou sur rails, astéroïdes et troyens de Zirkan, résonance spin-orbite de Kalpra, rotation synchrone des lunes.
- Vue 3D à la vraie échelle sans build ni CDN (Three.js local, textures procédurales), orbites osculatrices, caméra libre ou suivant un corps, liste hiérarchique planètes / lunes / sites.
- Habitabilité par corps (température, eau, atmosphère, gravité, rayonnement, marées, stabilité), verdict par mode, « habitable en permanence ? » sur 5 ans simulés.
- Dix-huit sites habités avec fiche (thermique, blindage, énergie, vie), trajets Hohmann et hyperpropulsion (0,95 c, 6 jours continus), fenêtres de lancement, délai lumière.
- Voyage animé du Mai : profil accélération / repos moteur / freinage, interception d'une destination mobile, suivi caméra, panneau de bord.
- Chronologie : An 0 = présent du roman, saut de −960 à +60 ans (recalcul N-corps réversible), âge du système, frise en haut de l'écran.
- Ciel vu d'un site (interactif, points cardinaux), fiche de scène avec la banque d'images des documents « Quotidien sensoriel », éphémérides (éclipses, levers et couchers, alignements, apsides).
- Vue à hauteur d'yeux : horizon à sa vraie distance, sol à la vraie courbure, astres à leur taille angulaire réelle, lumière de la planète parente, hublot pour les stations, points cardinaux et noms des astres à la demande.
- Réseau de communication : diffusion d'une information selon trois topologies, ordre de coupure du Consortium à la vitesse de la lumière, bouche-à-oreille par vaisseaux.
- Modèle de population et de dégel relié à la frise (humains, Tyts, contrôle, désespoir, éveil, révoltes, point de bascule), populations des sites à la date choisie.
- Planète-colonie des confins du Mouvement II (Shukal, nom provisoire), sa colonie et la piste d'arrêt forcé.
- Interface : panneaux repliables, masquage complet (touche H), options masquées par défaut, vitesses « temps réel » et « 1 min/s » (temps réel par défaut).
- Documentation : `docs/hypotheses.md` (canon et propositions de conception) et README complet.
- 40 tests (`npm test`) : conservation d'énergie, stabilité des lunes, réversibilité, éphémérides, réseau, population, vol.

- Intégration continue alignée sur les autres dépôts : workflow `Qualité et déploiement` (une porte = un job, agrégateur `Portes qualité`, déploiements gardés par `vars.DEPLOIEMENT_*`) et workflow `Release` (tag → release depuis le CHANGELOG).
- `outils/` : outillage d'exploitation de l'agence (déploiement, secrets, diagnostic Traefik, sauvegardes, vérification de site, extraction du CHANGELOG), `ci-local.sh` et `deployer.sh` adaptés au stack statique, `audit-scope.conf`.
- Three.js épinglé en dépendance de développement (`package.json`, `package-lock.json`, `npm run vendor`) : audit des dépendances et Dependabot deviennent effectifs, la copie servie est vérifiée identique au lockfile.
- Portes HTML (`html-validate`) et liens internes (`.github/scripts/check-links.sh`), action composite `.github/actions/node`, `CLAUDE.md` du projet.

- `LICENSE` propriétaire, badges du README (socle commun et stack), champ `license` de `package.json`.

### Modifié

- `GITHUB.md` réécrit (branches, secrets et variables, protection, sécurité) ; Dependabot sans `target-branch` tant que `develop` n'existe pas.

- Données calées sur les documents 00–13 : propulsions, populations, atmosphère ténue de Sethis, orbites des planètes internes et de Kebet (jour de 1,28 j, rayonnement et chauffage de marée), Iasha et Astir au-delà de Kebet.

### Corrigé

- `app/index.html` valide : `type="button"` sur tous les boutons, rôle `img` sur les canvas, étiquette de curseur correctement associée.
- Ellipses orbitales stables : état exact du dernier pas, coordonnées de Jacobi, barycentre planète + lunes (oscillation de a/a de 3·10⁻² à 5·10⁻⁷ pour Zirkan).
- Précession parasite de Kalpra ramenée de 3,7 à 0,014 °/an par le schéma d'ordre 4.
- Hublot des stations : barre de temps visible, champ calé sur la fenêtre circulaire.
