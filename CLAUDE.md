# omraon — système d'Omraon

Simulation N-corps et vue 3D du système d'Omraon (roman). **Site statique** : HTML, CSS, JavaScript en modules ES, Three.js copié dans `app/vendor/`.
Aucun PHP, aucun bundler, aucune étape de build. Le serveur est Caddy seul (`docker/web`).

## Règle qui prime sur tout

`.claude/rules/stack-conventions.md` fait autorité sur l'infrastructure (manifeste, nommage, ports, `.env`, CI). En cas de contradiction avec ce fichier, elle gagne et la
contradiction se signale. `.claude/` est une **copie** de la bibliothèque `~/Desktop/www/claude/subagent/` : ne pas la modifier ici, corriger à la source.

## Écart assumé, déjà arbitré — ne pas le « corriger »

Le manifeste veut une racine sans `package.json`. Ici la racine porte `package.json`, `package-lock.json`, `.nvmrc`, `tests/`, `docs/` et `.htmlvalidate.json` : c'est de l'outillage de
développement (tests Node, Three.js épinglé pour Dependabot et `npm audit`), pas du site. Les mettre dans `app/` les ferait **servir** par Caddy (dev : `app/` est monté tel quel) et copier
dans l'image ; `.dockerignore` les exclut de l'image. `check-stack.sh` les signale en notes, pas en échecs.

## Où vit quoi

- `app/` — le site : `src/data/` (étoile, planètes, lunes, sites, chronologie), `src/physics/` (moteur et calculs, sans DOM), `src/render/` (Three.js, canvas), `src/ui/ui.js`.
- `tests/physics.test.js` — `node --test`, sans dépendance. `docs/hypotheses.md` — canon et propositions de conception.
- Racine, `docker/`, `.github/`, `outils/` — infrastructure et exploitation uniquement.

## Commandes

```sh
docker compose up -d --wait        # https://localhost, certificat auto-signé
npm test                           # 41 tests
outils/ci-local.sh                 # rejoue les portes de la CI (hook pre-push)
npm run vendor                     # recopie Three.js depuis node_modules vers app/vendor/ (après une montée de version)
```

Toute commande Docker passe par la **clé de service** `web`, jamais par le `container_name`.

## Règles du projet

- **Canon contre conception.** Les documents du roman (00–13) fixent les ordres de grandeur, les noms, les propulsions, la chronologie. Toute autre valeur est une proposition de
  conception : la marquer (`invented`, `provisional`, « supposé ») et la lister dans `docs/hypotheses.md`.
- Les racines égyptiennes des noms sont « jamais affichées » (bible) : ne jamais les mettre dans l'interface.
- An 0 = début de l'Ère confédérale (fin des Siècles Sombres) ; le présent du roman est l'An 300 (conception). En interne, temps et années restent comptés depuis le présent (0 = présent) ; seul l'affichage convertit, par `fmtAn` (`data/chronologie.js`). Années de 365,25 jours terrestres ; arrivée de l'arche en −560.
- **Kebet fait référence pour les jours et les heures affichés** (`physics/calendrier.js`) : 1 jour = période de Kebet (≈ 1,28 j terrestre), 24 h par jour, minute et seconde proportionnelles. Le temps interne reste en jours terrestres ; seul l'affichage convertit. Ne jamais écrire `* 24` ou `* 86400` pour afficher une durée : passer par `fmtDuree` / `fmtSecondes`, qui donnent le jour de Kebet puis l'équivalent entre parenthèses (« 1,00 j (1,28 j Terre) »).
- Physique : `physics/` n'importe ni Three.js ni le DOM (les tests tournent sous Node seul). L'intégrateur est symétrique donc réversible : ne pas le casser (test « saut dans le temps »).
- Une modification de donnée se vérifie par `npm test` (stabilité des lunes, énergie, canon), une modification d'interface dans un vrai navigateur (390 px et desktop).
- Ce dépôt n'a que la branche `main`. Commits Conventional Commits, sans mention d'outil ; jamais de push sans demande.

## Décisions actées

Kebet à 4,7 rayons de Zirkan (jour ≈ 1,28 j) ; Sethis très chaude ; troyens de Zirkan activés par défaut ; vitesse par défaut = temps réel ; pas d'atelier de réglages ; Shukal (planète
des confins) est un nom provisoire ; déploiement conditionné par `vars.DEPLOIEMENT_*` (éteint par défaut).
