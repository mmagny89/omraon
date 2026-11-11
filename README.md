# Système d'Omraon — simulation & visualisation

Simulation physique (N-corps) et vue 3D du système décrit dans la *Bible géographique v3* : l'étoile Omraon, trois telluriques (Kalpra, Sethis, Naksun),
la ceinture Nunzir, deux géantes (Zirkan, Roushan), huit lunes dont Kebet et la planète-colonie des confins (Shukal), et dix-huit sites habités. Application
statique : aucun serveur applicatif, aucune ressource externe.

```sh
docker compose up -d --wait   # https://localhost (certificat auto-signé de Caddy)
npm test                      # 40 tests de physique, de calcul et de cohérence avec le canon
```

Stack statique d'agence (Caddy seul, ni PHP ni Node) : le site vit dans `app/`, sans étape de build ; Three.js est copié dans `app/vendor/` (importmap).
Détails Docker : [`README.docker.md`](README.docker.md). Journal des versions : [`CHANGELOG.md`](CHANGELOG.md). Contribution : [`CONTRIBUTING.md`](CONTRIBUTING.md).
Sécurité : [`SECURITY.md`](SECURITY.md). Licence : à choisir (aucun `LICENSE` pour l'instant).

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

## Arborescence

```
app/
├── index.html, vendor/three.*       page, Three.js local (importmap)
└── src/
    ├── data/       omraon.js (étoile, planètes, lunes), sites.js, chronologie.js, ambiances.js
    ├── physics/    simulation, kepler, system, sites, habitability, habitat, habscan, transfers, flight,
    │               sky, scene, ephem, ephemeris, network, population, horizon, derived, constants
    ├── render/     world, ground (vue au sol), skyView, cameraRig, textures, noise
    └── ui/ui.js    interface (panneaux, frise, fiches, options)
tests/physics.test.js               node --test
docs/hypotheses.md                  canon / propositions de conception
```

## Limites connues

- Lunes et astéroïdes ne se perturbent pas entre eux (astéroïdes = particules test) ; pas de modèle climatique 3D (température = équilibre + effet de serre fixé).
- Éveil et diffusion d'informations : modèles à paramètres de conception, très sensibles aux coefficients.
- Aucun export (fiches PDF/JSON) pour l'instant.
