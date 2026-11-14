# omraon — système d'Omraon

**À l'ombre d'Omraon** (nom du projet) : simulation N-corps et vue 3D du système d'Omraon (roman). **Symfony 8 + FrankenPHP + PostgreSQL** pour les comptes, les rôles et (phases suivantes) les données et les fiches ;
la vue du système reste du JavaScript en modules ES (Three.js dans `app/front/vendor/`), sans bundler. **Accès uniquement avec un compte** : pas d'inscription, c'est l'admin qui crée les comptes.

## Règle qui prime sur tout

`.claude/rules/stack-conventions.md` fait autorité sur l'infrastructure (manifeste, nommage, ports, `.env`, CI). En cas de contradiction avec ce fichier, elle gagne et la
contradiction se signale. `.claude/` est une **copie** de la bibliothèque `~/Desktop/www/claude/subagent/` : ne pas la modifier ici, corriger à la source.

## Écarts assumés, déjà arbitrés — ne pas les « corriger »

- Le manifeste veut une racine sans `package.json`. Ici la racine porte `package.json`, `package-lock.json`, `.nvmrc`, `tests/`, `docs/`, `.htmlvalidate.json` : outillage du **front**
  (tests Node de la physique, Three.js épinglé pour Dependabot et `npm audit`), pas de l'application PHP. `.dockerignore` les exclut de l'image.
- Le front vit dans `app/front/` et **jamais dans `app/public/`** : il n'est servi que par `FrontController`, derrière le pare-feu. Y mettre un fichier dans `public/` le
  rendrait lisible sans compte (un test le vérifie).
- **Données** : le canon d'origine est `app/donnees/canon/{systeme,sites,economie,lore,glossaire,ambiances,chronologie}.json` (versionné, lu par les tests Node). Une section modifiée par un admin (`/admin/donnees`) est stockée en base (`Donnee`) et remplace le canon pour tous ; « réinitialiser » supprime la surcharge. Le front les lit par `GET /api/donnees/<jeu>` via `src/data/charger.js` (`await` de niveau module). Pour changer une valeur de canon : éditer le JSON, pas les modules `src/data/*.js`. Les fonctions (`ambianceFor`, `fmtAn`…) restent dans `src/data/*.js`. Un site peut porter `marche: <id>` : son économie (population, production, besoins) s'ajoute au nœud du site d'origine (`creerEconomie`) ; toute station orbitale est `fixe` (tenue en place).

## Où vit quoi

- `app/src/`, `app/templates/`, `app/config/`, `app/migrations/`, `app/tests/` — Symfony : `User` (`ROLE_LECTEUR`, `ROLE_ADMIN` ⊃ lecteur), connexion, gestion des comptes (`/admin/utilisateurs`), valeurs par défaut (`/admin/donnees`), pages de détail (`FichesController`, `FichesService` : `/astres`, `/sites`, `/personnages`, `/scenes`, `/lexique`, `/chronologie`). Toute la logique des pages est dans `FichesService`, les gabarits Twig n'affichent que ; `AN_PRESENT` y double `data/chronologie.js`. Les températures des astres sont calculées par `physics/thermique.js` et son miroir `Service/Thermique.php` : tout changement du modèle passe par les deux, puis `node outils/generer-thermique.mjs` (fixture comparée par les deux suites).
- `app/donnees/canon/` — valeurs par défaut du canon (JSON), modifiables par un admin via un formulaire généré (`app/assets/editeur.js`) qui produit le JSON. Illustrations : SVG générés par `Service/IllustrationService.php`, remplaçables par un téléversement admin stocké en base (`Illustration`). `app/front/` — la vue : `src/data/` (chargeurs), `src/physics/` (sans DOM, testé par `tests/*.test.js`), `src/render/` (Three.js), `src/ui/`.
- `docs/hypotheses.md` — canon et propositions de conception. Racine, `docker/`, `.github/`, `outils/` — infrastructure et exploitation.

## Commandes

```sh
docker compose up -d --wait                                   # https://localhost, certificat auto-signé
docker compose exec php php bin/console app:utilisateur:creer <email> <nom> --admin   # premier admin
docker compose exec -e APP_ENV=test php php bin/phpunit tests/Functional             # tests Symfony ciblés (APP_ENV=test obligatoire)
npm test                                                      # tests de la physique (Node)
outils/ci-local.sh                                            # rejoue les portes de la CI (hook pre-push)
npm run vendor                                                # recopie Three.js vers app/front/vendor/
```

Toute commande Docker passe par la **clé de service** (`php`, `database`), jamais par le `container_name`.

## Tailwind CSS v4

- Pages Twig : `app/assets/styles/app.css` (avec preflight, jetons `@theme`) ; panneaux de la vue : `app/assets/styles/vue.css` (sans preflight : `front/src/style.css` reste maîtresse du reste). Bundle `symfonycasts/tailwind-bundle`, binaire épinglé (`binary_version`).
- `docker compose exec php php bin/console app:tailwind:build` compile **les deux** (le `tailwind:build` du bundle n'en compile qu'une) ; à relancer après avoir ajouté des classes, en dev. L'image, le démarrage de dev et la CI utilisent cette commande.
- Les classes s'écrivent en toutes lettres (Tailwind lit les fichiers comme du texte) : jamais `'bg-' + couleur`. Panneaux de la vue : composants dans `front/src/ui/composants.js` ; la vue reçoit sa feuille par `<!--VUE_CSS-->` remplacé dans `FrontController`.
- Migration des panneaux **partielle**, composant par composant : tuiles, en-tête de fiche, sections repliables, séparateur, rubriques d'outils de site, listes de valeurs (`dl`), titres de bloc, notes, verdict et critères d'habitabilité, tableau de synthèse, suggestions. Reste dans `style.css`, par choix : tout ce qui dépend d'un état piloté en JavaScript ou de pseudo-éléments (liste des corps et son repli, frise, marqueurs de sites et de vaisseaux, HUD du sol), et les listes d'éléments dynamiques de certains panneaux. Les formulaires des panneaux d'options (réglages, population, réseau, économie, éphémérides, ciel, trajet, comparaison) sont migrés. On migre un composant à la fois en retirant sa règle.

## Voyage dans le temps et vol libre

- **Chronique** (Options › Chronique) : on choisit une année, de l'arrivée (−560 interne, An −260) au présent, et `physics/chronique.js` donne l'état du monde : population du modèle, sites fondés (`FONDATIONS`), pénuries en cours, événements proches ; un bouton simule 60 jours de commerce à cette date, avec et sans la pénurie organisée. Toutes les dates de ce voyage (fondations, pénuries) sont des données de `chronologie.json`, suggérées et modifiables.
- **Pénuries organisées** (`PENURIES`) : le Consortium les dose pour tenir la population, sous le seuil de la misère. Elles agissent sur trois modèles : population (`penuries` : contrôle +, éveil −), économie (événement `rationnement`), chronologie (un événement par épisode, vue et page `/chronologie`). Sans pénuries, rien ne change.
- **Vol libre** (touche F, bouton ✈) : `CameraRig.entrerLibre()`, vitesse proportionnelle à l'altitude ; choisir un corps dans la liste ramène en orbite.

## Pastilles de provenance

Six statuts, mêmes noms dans la vue (`front/src/ui/statut.js`, clé `conception` affichée « suggéré ») et dans les pages (`templates/_c.html.twig`, macro `statut`) : **canon** (documents du roman), **suggéré** (proposition de la simulation, `docs/hypotheses.md`), **calculé** (déduit des deux précédents), **simulé** (population, économie, réseau), **modifié** (section changée par un admin, détectée par `DonneesService::modifications()` ; la vue la lit sur `/api/donnees/modifications`), **provisoire**. Toute nouvelle information affichée porte sa pastille ; la légende est en pied de page.

## Règles du projet

- **Canon contre conception.** Les documents du roman (00–13) fixent les ordres de grandeur, les noms, les propulsions, la chronologie. Toute autre valeur est une proposition de
  conception : la marquer (`invented`, `provisional`, « supposé ») et la lister dans `docs/hypotheses.md`.
- Les racines égyptiennes des noms sont « jamais affichées » (bible) : ne jamais les mettre dans l'interface.
- An 0 = début de l'Ère confédérale (fin des Siècles Sombres) ; le présent du roman est l'An 300 (conception). En interne, temps et années restent comptés depuis le présent (0 = présent) ; seul l'affichage convertit, par `fmtAn` (`data/chronologie.js`). Années de 365,25 jours terrestres ; arrivée de l'arche en −560.
- **Kebet fait référence pour les jours et les heures affichés** (`physics/calendrier.js`) : 1 jour = période de Kebet (≈ 1,28 j terrestre), 24 h par jour, minute et seconde proportionnelles. Le temps interne reste en jours terrestres ; seul l'affichage convertit. Ne jamais écrire `* 24` ou `* 86400` pour afficher une durée : passer par `fmtDuree` / `fmtSecondes`, qui donnent le jour de Kebet puis l'équivalent entre parenthèses (« 1,00 j (1,28 j Terre) »).
- Physique : `physics/` n'importe ni Three.js ni le DOM (les tests tournent sous Node seul). L'intégrateur est symétrique donc réversible : ne pas le casser (test « saut dans le temps »).
- Une modification de donnée se vérifie par `npm test` (stabilité des lunes, énergie, canon), une modification d'interface dans un vrai navigateur (390 px et desktop).
- **Toute décision qui ajoute ou change du lore** (valeur inventée, canon précisé, nom provisoire) s'inscrit dans `docs/modifications-lore.md` : date, canon d'origine, choix, statut, fichier. C'est le document que l'autrice relit pour mettre le roman et la simulation à jour.
- Branches : `main` et `develop` (chantier Symfony, mergé dans `main` à la fin). Commits Conventional Commits, sans mention d'outil ; jamais de push sans demande.

## Décisions actées

Kebet à 4,7 rayons de Zirkan (jour ≈ 1,28 j) ; Sethis très chaude ; troyens de Zirkan activés par défaut ; vitesse par défaut = temps réel ; pas d'atelier de réglages ; Shukal (planète
des confins) est un nom provisoire ; déploiement conditionné par `vars.DEPLOIEMENT_*` (éteint par défaut) ; PostgreSQL ; jetons CSRF à session (pas de JS dans les gabarits Symfony).
