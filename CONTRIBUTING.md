# Contribuer à simulation

## Branches

- `main` : la production, ne reçoit que du code déjà validé en pré-production.
- `develop` : la pré-production, base de toute branche de travail.
- Une branche par sujet, depuis `develop` : `feat/<sujet>`, `fix/<sujet>`, `chore/<sujet>`.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/fr/v1.0.0/) :
`type(portée): description`, au présent, sans point final. Un commit = un changement.

## Avant de pousser

```sh
outils/ci-local.sh                  # rejoue les portes de la CI en local (syntaxe, compose, Three.js, HTML, liens, tests)
git config core.hooksPath .githooks # une fois par clone : le même contrôle avant chaque push
```

La demande de fusion vise `develop`. Elle ne passe que si les portes de la CI sont vertes.

## Données et tests

- Les valeurs du système (étoile, orbites, masses, atmosphères) vivent dans `app/src/data/omraon.js`, les sites dans `app/src/data/sites.js`, la chronologie dans `app/src/data/chronologie.js`. Toute valeur que les documents du roman ne fixent pas porte `invented` / `provisional` : voir [`docs/hypotheses.md`](docs/hypotheses.md).
- `npm test` rejoue les tests de physique (Node seul, sans dépendance). Après un changement de donnée, ils vérifient la stabilité des lunes, la conservation d'énergie et la cohérence avec le canon (populations, habitabilité de Kebet).
- Ce dépôt n'a pour l'instant que la branche `main`.
