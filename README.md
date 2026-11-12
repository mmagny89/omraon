# Système d'Omraon — simulation & visualisation

[![Qualité et déploiement](https://github.com/mmagny89/omraon/actions/workflows/qualite.yml/badge.svg?branch=main)](https://github.com/mmagny89/omraon/actions/workflows/qualite.yml)
[![Release](https://github.com/mmagny89/omraon/actions/workflows/release.yml/badge.svg)](https://github.com/mmagny89/omraon/actions/workflows/release.yml)
[![Version](https://img.shields.io/github/v/tag/mmagny89/omraon?label=version&sort=semver)](CHANGELOG.md)
[![Licence propriétaire](https://img.shields.io/badge/licence-propri%C3%A9taire-lightgrey)](LICENSE)
[![Conventional Commits](https://img.shields.io/badge/Conventional_Commits-1.0.0-fe5196?logo=conventionalcommits&logoColor=white)](https://www.conventionalcommits.org/fr/v1.0.0/)
[![Three.js 0.187](https://img.shields.io/badge/Three.js-0.187-000000?logo=threedotjs&logoColor=white)](app/vendor/)
[![Caddy 2.11](https://img.shields.io/badge/Caddy-2.11-1F88C0?logo=caddy&logoColor=white)](docker/web/Dockerfile)
[![Docker](https://img.shields.io/badge/Docker-compose-2496ED?logo=docker&logoColor=white)](README.docker.md)

Simulation physique (N-corps) et vue 3D du système décrit dans la *Bible géographique v3* : l'étoile Omraon, trois telluriques (Kalpra, Sethis, Naksun),
la ceinture Nunzir, deux géantes (Zirkan, Roushan), huit lunes dont Kebet et la planète-colonie des confins (Shukal), et dix-huit sites habités. Application
statique : aucun serveur applicatif, aucune ressource externe.

```sh
docker compose up -d --wait   # https://localhost (certificat auto-signé de Caddy)
npm test                      # 40 tests de physique, de calcul et de cohérence avec le canon
```

Stack statique d'agence (Caddy seul, ni PHP ni Node) : le site vit dans `app/`, sans étape de build ; Three.js est copié dans `app/vendor/` (importmap).
Détails Docker : [`README.docker.md`](README.docker.md). Journal des versions : [`CHANGELOG.md`](CHANGELOG.md). Contribution : [`CONTRIBUTING.md`](CONTRIBUTING.md).
Sécurité : [`SECURITY.md`](SECURITY.md). Licence : propriétaire, voir [`LICENSE`](LICENSE).

## Ce que fait l'application

| Domaine | Contenu |
|---|---|
| **Vue du système** | Vue 3D à la vraie échelle (de l'étoile à une lune), orbites osculatrices, ceinture d'astéroïdes et troyens de Zirkan, textures procédurales, caméra libre ou suivant un corps. Vues rapides Système / Intérieur / Kebet. |
| **Physique** | N-corps gravitationnel, relativité générale 1PN, lunes en N-corps ou sur rails, rotation synchrone, résonance spin-orbite 3:2 de Kalpra, aplatissement, éclipses. Diagnostics ΔE/E et ΔL/L. |
| **Fiches** | Masse, rayon, gravité, éléments orbitaux en direct, rayon de Hill, limite de Roche, jour sidéral et solaire, année locale, éclairement, température. |
| **Habitabilité** | Diagnostic par corps (température, eau, atmosphère, gravité, rayonnement, marées, stabilité) avec verdict par mode, et « habitable en permanence ? » sur 5 ans simulés. |
| **Sites habités** | 18 sites (mines, octroi, garnison, tribunaux, port et cités de Kebet, cités flottantes, postes des confins…) : thermique, blindage, énergie, vie, trajets. |
| **Trajets et voyage animé** | Hohmann, hyperpropulsion 0,95 c (6 jours de poussée continue au plus), subluminique 0,1 c, fenêtres, délai lumière ; voyage animé du Mai avec repos moteur. |
| **Ciel et vue à hauteur d'yeux** | Ciel vu d'un site, interactif ; vue à la première personne avec horizon réel, hublot pour les stations, points cardinaux et noms des astres à la demande. |
| **Fiche de scène** | Lumière, heure du jour, prochain lever ou éclipse, conditions, communications, puis la banque d'images des documents « Quotidien sensoriel ». |
| **Éphémérides** | Éclipses, levers et couchers, alignements, périhélies sur 30 jours, 1 an ou 5 ans (précision ~1 minute) ; un clic saute à la date. |
| **Chronologie** | An 0 = présent du roman ; frise de −960 à +60 ans, saut de date avec recalcul N-corps réversible, âge du système. |
| **Réseau de communication** | Diffusion d'une information (piratage de Jax) selon trois topologies, ordre de coupure du Consortium à la vitesse de la lumière, bouche-à-oreille par vaisseaux. |
| **Population et dégel** | De l'arche de 10 000 personnes au présent : humains, Tyts, contrôle, désespoir, éveil, révoltes, point de bascule ; populations des sites à la date de la frise. |

### Interface
- **Panneaux** : ☰ Corps, ⓘ Fiche et ⚙ Options (en-tête) ouvrent et ferment les panneaux (croix dans chacun) ; sur téléphone, un seul à la fois.
- **Masquer toute l'interface** : bouton 🙈 ou touche **H** ; « 👁 Interface » ou H la ramène.
- **Frise chronologique** en haut : ères colorées, événements cliquables, curseur de la date simulée ; cliquer ou glisser saute à la date (flèches ±1 an, Maj ±10 ans).
- **Options masquées par défaut** (⚙, aussi dans la barre du bas) : paramètres et diagnostics, population et dégel, réseau, éphémérides.
- **Comparateur de lieux** (Options ⚙) : deux sites côte à côte (population, environnement, gravité, thermique, énergie…) avec les écarts en clair, plus la distance, le délai de message et le trajet en hyperpropulsion entre eux (`app/src/ui/comparaison.js`).
- **Lore** (Options › Lore, et dans les fiches) : le glossaire tyt (≈ 65 mots du lexique, les noms des mondes et les 13 mois du calendrier confédéral, avec recherche), les personnages placés dans leur lieu d'origine (section « Personnages d'ici », badge 👤 dans la liste), et les vestiges des Anciens (les Iktu) en niveaux canon / iceberg / fil ouvert. Données tirées des documents du roman (`app/src/data/lore.js`, `glossaire.js`) ; aucune racine égyptienne n'est affichée (un test le garantit).
- **Temples solaires et calendrier** : la fiche des Grands temples d'Osaon ajoute la liturgie solaire (texte du lore, prochaines éclipses de Zirkan, bouton « Vivre la prochaine éclipse depuis les temples » qui ouvre la vue à hauteur d'yeux au milieu de l'éclipse) et le calendrier confédéral à 13 mois ; l'infobulle de la date indique le mois et le jour du mois.
- **Ceinture Nunzir** : la sélectionner (liste des corps ou étape 4 de la visite) cadre la caméra sur son anneau et ouvre sa fiche : étendue, traceurs simulés, résonances avec Zirkan (lesquelles tombent dans la ceinture), sites. L'adresse partageable retient `b=Nunzir`.
- **Statut de chaque information** : une pastille sur chaque section de fiche dit si elle est du **canon**, de **conception**, **calculée** ou **provisoire** (infobulle explicative ; le détail est dans `docs/hypotheses.md`, le code dans `app/src/ui/statut.js`).
- **Photo et carnet de scènes** (Options ⚙, bouton 📷 ou touche **P**) : la photo PNG montre la vue sans interface, avec un bandeau lieu et date ; le carnet garde des vues (adresse, vignette, texte de la fiche de scène) dans le navigateur et s'exporte en Markdown (`app/src/ui/carnet.js`).
- **Accessibilité** : liens d'évitement (Tab au chargement), vue 3D focalisable (flèches pour tourner, + / − ou Page haut/bas pour le zoom), annonces aux lecteurs d'écran (sélection, date, étapes de la visite, lien copié), retour du focus à la fermeture de la visite, infobulles aussi au clavier (Échap pour les fermer), transitions de caméra supprimées si le système demande un mouvement réduit. Aucune conformité RGAA n'est revendiquée : seuls des contrôles automatiques et une revue partielle ont été faits.
- **Chargement et en-tête** : une page de chargement avec barre de progression réelle, astuce et message d'échec si WebGL manque ; un en-tête en trois zones (navigation et marque, vues, outils). La mention « © 2026 Magny · Tous droits réservés » figure au chargement, en pied de page (écrans larges), dans Options › À propos, sur les photos et dans l'export du carnet, en cohérence avec `LICENSE`.
- **Téléphone** : testé à 390 px de large (barre du haut sans débordement, cibles de 44 px). Sous 860 px, la visite guidée et la copie du lien passent dans le panneau Options (⚙ de la barre du bas) pour libérer la barre du haut.
- **Visite guidée** (bouton 🧭, ou dans Options sur téléphone) : neuf étapes, de l'étoile à la chronologie, avec caméra et date réglées pour chacune ; flèches ← → pour naviguer, Échap pour quitter et retrouver sa vue d'avant. Les textes reprennent les descriptions du canon ; ce qui est de conception est dit entre parenthèses (`app/src/ui/visite.js`).
- **Prochains événements** dans la fiche d'un corps : les quatre prochaines éclipses d'une lune (une par jour de Kebet pour Kebet), les alignements et apsides d'une planète ; un clic saute à la date.
- **Lien partageable** : le bouton 🔗 copie une adresse qui garde la date, le corps ou le site choisi, la caméra, la vitesse et la pause ; l'ouvrir restitue la même vue (l'adresse se met aussi à jour toute seule).
- **Vitesses** : de « temps réel » (1 s/s, par défaut) et « 1 min/s » jusqu'à 1000 ans/s.
- **Vue à hauteur d'yeux** : souris ou tactile pour tourner, molette ou pincement pour le champ, Échap pour quitter.

## Physique et précision

- Unités UA / jour / M☉ (constante de Gauss). Intégrateur : composition d'ordre 4 (Yoshida) de pas leapfrog symétriques, donc **réversible** : aller à −500 ans puis revenir ramène les planètes à 10⁻⁹ UA près.
- Planètes en N-corps, lunes en N-corps tant que la vitesse le permet, puis « sur rails » (Kepler) ; astéroïdes en particules test (retirées à l'impact).
- Précession parasite de Kalpra : 0,014 °/an (leapfrog simple : 3,7 °/an) ; la relativité générale ajoute 0,0003 °/an. Ellipses calculées sur l'état du dernier pas, en coordonnées de Jacobi (stables : a/a de 3·10⁻² à 5·10⁻⁷ pour Zirkan).
- Éphémérides par exécution d'une copie de la simulation N-corps (pas de formule képlérienne qui dérive).
- Dérivés : zone habitable (Kopparapu 2013), Hill, Roche, stabilité des satellites (Domingos 2006), chauffage de marée (Peale), dose de rayonnement par analogie avec Jupiter (Galileo), critère de Jeans.

## Données, canon et hypothèses

Le document ne fixe aucune valeur physique hormis l'ordre des corps, leurs rôles, leurs noms, « ~35 UA au bord », les propulsions, les ordres de grandeur de population
et la chronologie. Tout le reste est une **proposition de conception**, marquée `invented` / `provisional` / « supposé » et listée dans
[`docs/hypotheses.md`](docs/hypotheses.md) avec le fichier où la changer (`app/src/data/`). Les racines égyptiennes (« jamais affichées » dans la bible) sont absentes de l'interface.
Hors simulation : monde natal tyt, hangar-musée, Terre.

## Intégration continue et outillage

- **Workflow `Qualité et déploiement`** (`.github/workflows/qualite.yml`, même forme que les autres dépôts de l'agence) : une porte = un job — *Cohérence du dépôt*, *Audit des dépendances*
  (`npm audit`), *Three.js local conforme au lockfile*, *Validation HTML*, *Liens internes*, *Tests de la physique*, *L'image se construit et le site répond* — puis l'agrégateur
  **`Portes qualité`** (seul contrôle à exiger) et les déploiements de pré-production et de production, gardés par `vars.DEPLOIEMENT_STAGING` / `vars.DEPLOIEMENT_PROD` (éteints par défaut).
- **Workflow `Release`** : un tag `vX.Y.Z` crée la release à partir de la section du `CHANGELOG.md` (`outils/extraire-changelog.sh`).
- **`outils/`** (versionné) : `ci-local.sh` (rejoue les portes en local, hook pre-push), `deployer.sh` (exécuté sur le serveur par la *forced command*), `installer-deploiement.sh`,
  `renseigner-secrets.sh`, `diagnostic-traefik.sh`, `verifier-site.sh`, `extraire-changelog.sh`, `sauvegarder.sh`, `tester-restauration.sh`, `verifier-destination.sh`, `audit-scope.conf`.
- **Audits** : les scripts de la bibliothèque sont dans `.claude/scripts/` (`audit-securite.sh`, `audit-seo.sh`, `audit-rgaa.sh`, `audit-intrusion.sh`, `test-charge.sh`, `check-stack.sh`,
  `check-gouvernance.sh`) ; les audits actifs ne visent que les hôtes déclarés dans `outils/audit-scope.conf`.
- Configuration à faire dans l'interface GitHub : [`GITHUB.md`](GITHUB.md).

## Arborescence

```
app/
├── index.html, vendor/three.*       page, Three.js local (importmap) — package.json épingle la version, `npm run vendor` recopie
└── src/
    ├── data/       omraon.js (étoile, planètes, lunes), sites.js, chronologie.js, ambiances.js
    ├── physics/    simulation, kepler, system, sites, habitability, habitat, habscan, transfers, flight,
    │               sky, scene, ephem, ephemeris, network, population, horizon, derived, constants
    ├── render/     world, ground (vue au sol), skyView, cameraRig, textures, noise
    └── ui/ui.js    interface (panneaux, frise, fiches, options)
tests/physics.test.js               node --test
outils/, .github/, docker/          exploitation, CI, Caddy (stack statique d'agence)
CLAUDE.md                           mémoire du projet (règles, décisions actées)
docs/hypotheses.md                  canon / propositions de conception
```

## Limites connues

- Lunes et astéroïdes ne se perturbent pas entre eux (astéroïdes = particules test) ; pas de modèle climatique 3D (température = équilibre + effet de serre fixé).
- Éveil et diffusion d'informations : modèles à paramètres de conception, très sensibles aux coefficients.
- Aucun export (fiches PDF/JSON) pour l'instant.
