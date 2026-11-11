# simulation — socle Docker

Généré par `.claude/scripts/setup-statique.sh` le 2026-11-11. Site statique
(HTML, CSS, JavaScript) servi par Caddy 2.11.9. Aucun PHP, aucun Node,
aucune base de données. Seul **Docker** est requis sur le poste.

## Démarrage (développement)

```sh
docker compose up -d --wait
```

Le site est servi sur https://localhost (certificat auto-signé de Caddy).
`app/` est monté en lecture seule : un fichier modifié est servi au rechargement
de la page, sans reconstruction.

## Environnements

Un Traefik existant termine le TLS : le conteneur écoute en clair sur le port 80 sur le réseau `traefik`, `DOMAINE` est requis. Les noms exacts de l'entrypoint et du certresolver (`websecure`, `letsencrypt`) sont à constater sur l'hôte, jamais à supposer.

```sh
cp .env.prod.local.dist .env.prod.local   # puis renseigner
docker compose -f compose.yml -f compose.prod.yml --env-file .env.prod.local up -d --build --wait
```

Staging et production copient `app/` dans l'image : un changement de contenu
demande `--build`.

## Ports

| Variable | Valeur | Publié |
|---|---|---|
| `HTTP_PORT` | 80 | dev, et staging/prod en serveur dédié |
| `HTTPS_PORT` | 443 | idem |
| 2020 | métriques Prometheus et `/health` | jamais — réseau du projet seulement |

## Fichiers

| Fichier | Rôle |
|---|---|
| `app/` | le site (HTML, CSS, JS) |
| `docker/web/Dockerfile` | image Caddy, trois stages : dev, staging, prod |
| `docker/web/Caddyfile` | en-têtes de sécurité, fichiers sensibles en 404, `/health`, métriques |
| `docker/web/docker-healthcheck.sh` | sonde `:2020/health` |
| `compose.yml`, `compose.{dev,staging,prod}.yml` | socle et environnements |
| `.env`, `.env.{staging,prod}.local.dist` | variables et modèles de secrets |
| `.github/workflows/qualite.yml` | build du stage prod et contrôle de réponse |
| `GITHUB.md` | réglages à faire dans GitHub |

## Content-Security-Policy

Le `Caddyfile` ne pose aucune CSP : elle dépend des ressources du site. À ajouter
dans le bloc `header` dès que les sources de scripts, de styles et d'images sont connues.
