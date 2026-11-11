# Configuration GitHub — simulation

Ce qui se règle **dans l'interface GitHub**, une fois, par quelqu'un qui a les
droits sur le dépôt.

## 1. Branches

| Branche | Environnement |
|---|---|
| `main` | production |
| `develop` | pré-production |

Vérifier d'abord `git branch -a` : un dépôt peut n'avoir que `main`.

## 2. Protection de branche

**Settings → Branches** : sur `main` (et `develop` s'il existe), exiger la
réussite du contrôle **« L'image se construit et le site répond »** avant tout
merge, et interdire le force-push.

## 3. Déploiement

Ce socle ne génère pas de workflow de déploiement : le site se déploie par
`docker compose -f compose.yml -f compose.prod.yml --env-file .env.prod.local up -d --build --wait`
sur le serveur (voir `README.docker.md`). Un déploiement automatisé se conçoit
avec la skill `ci-pipeline-standards` et §ci/deploiement.

- [ ] `main` et, si besoin, `develop` poussées
- [ ] contrôle « L'image se construit et le site répond » exigé
