# Contribuer à omraon

## Branches

- `main` : la production, ne reçoit que du code déjà validé en pré-production.
- `develop` : la pré-production, base de toute branche de travail.
- Une branche par sujet, depuis `develop` : `feat/<sujet>`, `fix/<sujet>`, `chore/<sujet>`.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/fr/v1.0.0/) :
`type(portée): description`, au présent, sans point final. Un commit = un changement.

## Avant de pousser

```sh
outils/ci-local.sh                  # rejoue les portes de la CI en local (composer, lints, PHPStan, PHPUnit, front : syntaxe, Three.js, HTML, tests Node)
git config core.hooksPath .githooks # une fois par clone : le même contrôle avant chaque push
```

La demande de fusion vise `develop`. Elle ne passe que si les portes de la CI sont vertes.

## Données et tests

- Les valeurs du système (étoile, orbites, masses, atmosphères) vivent dans `app/donnees/canon/systeme.json`, les sites dans `app/donnees/canon/sites.json`, la chronologie dans `app/front/src/data/chronologie.js`. Toute valeur que les documents du roman ne fixent pas porte `invented` / `provisional` : voir [`docs/hypotheses.md`](docs/hypotheses.md).
- `npm test` rejoue les tests de physique (Node seul, sans dépendance). Après un changement de donnée, ils vérifient la stabilité des lunes, la conservation d'énergie et la cohérence avec le canon (populations, habitabilité de Kebet).
- Tests PHP ciblés : `docker compose exec -e APP_ENV=test php php bin/phpunit tests/Functional/<Fichier>.php` (`APP_ENV=test` obligatoire). Après avoir ajouté des classes Tailwind : `docker compose exec php php bin/console app:tailwind:build`.
- Toute nouvelle information affichée porte sa pastille de provenance (canon, suggéré, calculé, simulé, modifié, provisoire) ; toute décision qui ajoute ou change du lore s'inscrit dans `docs/modifications-lore.md`.
