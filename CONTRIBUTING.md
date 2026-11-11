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
outils/ci-local.sh                  # rejoue les portes de la CI en local, environnement vierge
git config core.hooksPath .githooks # une fois par clone : le même contrôle avant chaque push
```

La demande de fusion vise `develop`. Elle ne passe que si les portes de la CI sont vertes.
