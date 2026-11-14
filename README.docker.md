# omraon — socle Docker

Genere par `.claude/scripts/setup-symfony.sh` le 2026-11-14. Symfony sur
FrankenPHP (Caddy integre, mode worker), PostgreSQL.
Projet **non headless** : pas de front separe, pas de service Node.

Serveur staging/prod : partage. Traefik en frontal (reseau externe `proxy`), TLS gere par Traefik, TRUSTED_PROXIES a declarer cote Symfony pour le reseau du proxy..

## Inventaire

| Fichier | Role |
|---|---|
| `.env` | Variables Docker Compose : versions, ports, UID/GID, `POSTGRES_*` |
| `.env.staging.local.dist` / `.env.prod.local.dist` | Modeles de secrets, committes |
| `.env.staging.local` / `.env.prod.local` | Secrets reels — jamais committes |
| `compose.yml` | Socle : services `php`, `database` |
| `compose.dev.yml` | Ajoute `mailpit`, qui retient les emails de developpement |
| `compose.dev.yml` / `compose.staging.yml` / `compose.prod.yml` | Overrides par environnement |
| `docker/php/**` | Dockerfile, Caddyfile(s), scripts d'entrypoint/healthcheck/installation |
| `outils/**` | Outillage d'exploitation, versionne car `.claude/` n'arrive pas sur le serveur |
| `GITHUB.md` | Ce qui se configure dans l'interface GitHub : secrets, variables d'activation, reglages Actions, protection des branches |

| `app/` | Code applicatif Symfony (installe apres coup) |


## Demarrage

```sh
docker compose up -d --wait
docker compose exec php install-symfony
```

## Ports

| Variable | Valeur par defaut | Publie par |
|---|---|---|
| `HTTP_PORT` | 80 | dev |
| `HTTPS_PORT` | 443 | dev |
| `HTTP3_PORT` | 443/udp | aucun environnement : HTTP/3 est désactivé en dev (conventions §mission/pieges-symfony), et Traefik termine le TLS ailleurs |
| `POSTGRES_PORT` | 5432 | dev uniquement, sur `127.0.0.1` |
| `MAILPIT_PORT` | 8025 | dev uniquement, sur `127.0.0.1` — interface web de l'attrapeur d'emails ; son port SMTP (1025) reste interne |


Pour faire tourner ce projet en parallele d'un autre, decaler
`HTTP_PORT`/`HTTPS_PORT`/`HTTP3_PORT` dans le `.env` — jamais en
inspectant l'hote (conventions, section reseau/ports).

## Controler avant de pousser

`outils/ci-local.sh` rejoue les portes de `.github/workflows/qualite.yml` dans le conteneur
`php`, avec l'environnement minimal de la CI et une base jetable : il revele la variable que
le workflow a oubliee et que le conteneur de developpement porte deja. Une porte dont l'outil
est absent est annoncee comme ignoree, jamais comptee comme reussie.

```sh
outils/ci-local.sh                  # ou : make check, si le Makefile standard est installe
git config core.hooksPath .githooks # hook pre-push : le meme controle avant chaque push
outils/sauvegarde-locale.sh         # sauvegarde la base de dev et la restaure pour preuve
```

## Environnements

Deux environnements deployes, chacun sur sa branche et dans son propre clone.
Le suffixe d'environnement des noms de conteneurs, du reseau et des volumes
(conventions, section manifeste/nommage) leur permet de cohabiter sur un meme hote.

| Branche | Environnement | Clone conseille |
|---|---|---|
| `develop` | pre-production (PPD) | `<racine>/omraon-ppd` |
| `main` | production | `<racine>/omraon` |

`<racine>` est l'endroit ou vous rangez vos projets — `/srv`, `/docker`,
`/home/<utilisateur>`, peu importe. Les scripts d'outillage deduisent le
chemin reel de leur propre emplacement : rien n'est code en dur.

On travaille sur des branches `feat/*` ou `fix/*`, fusionnees dans
`develop` pour valider en PPD, puis dans `main` pour livrer. Un
deploiement est donc toujours un `git pull`, jamais une copie de fichiers.

### Prealable : acces du serveur au depot

Si le depot est prive, un `git clone` depuis le serveur echoue tant qu'aucune
cle n'y est autorisee. Utiliser une **cle de deploiement en lecture seule**,
propre a ce depot — pas la cle personnelle d'un poste de travail, qui donnerait
au serveur l'acces a tous vos depots.

```sh
ssh-keygen -t ed25519 -C "omraon-vps" -f ~/.ssh/omraon_deploy -N ""
cat ~/.ssh/omraon_deploy.pub
```

Coller la cle dans GitHub → depot → **Settings** → **Deploy keys**, en laissant
« Allow write access » **decoche**. Puis, sur le serveur :

```sh
cat >> ~/.ssh/config <<'FIN'

Host github-omraon
    HostName github.com
    User git
    IdentityFile ~/.ssh/omraon_deploy
    IdentitiesOnly yes
FIN
chmod 600 ~/.ssh/config
ssh -T git@github-omraon
```

L'alias evite d'imposer cette cle a tout `github.com`, et l'URL distante le
retient : les `git pull` de redeploiement fonctionnent sans reconfiguration.

### Prealable : Traefik

Relever la configuration du Traefik en place plutot que la supposer — nom du
reseau, entrypoint HTTPS, certresolver. Ces trois valeurs sont a reporter dans
`compose.staging.yml` et `compose.prod.yml` si elles different des valeurs
par defaut. Le DNS du domaine doit pointer sur le serveur **avant** le premier
demarrage, sans quoi Let's Encrypt ne peut pas emettre le certificat.

### Pre-production (PPD)

```sh
git clone -b develop git@github.com:<compte>/omraon.git <racine>/omraon-ppd
cd <racine>/omraon-ppd
cp .env.staging.local.dist .env.staging.local   # une fois, puis renseigner
docker compose -f compose.yml -f compose.staging.yml --env-file .env.staging.local up -d --build --pull always --wait
```

### Production

```sh
git clone -b main git@github.com:<compte>/omraon.git <racine>/omraon
cd <racine>/omraon
cp .env.prod.local.dist .env.prod.local         # une fois, puis renseigner
docker compose -f compose.yml -f compose.prod.yml --env-file .env.prod.local up -d --build --pull always --wait
```

`RUN_MIGRATIONS=0` en production : mise a jour de schema jouee
explicitement au deploiement, jamais au demarrage du conteneur.

### Mise en service de `omraon.mmagny.fr` (VPS partagé, Traefik, réseau `traefik`)

Le DNS (enregistrement A de `omraon.mmagny.fr` vers le VPS) doit exister avant le premier démarrage.

```sh
docker network ls | grep traefik                        # le réseau externe doit exister (sinon : docker network create traefik)
git clone -b main git@github.com:mmagny89/omraon.git <racine>/omraon && cd <racine>/omraon
cp .env.prod.local.dist .env.prod.local && chmod 600 .env.prod.local
# Secrets : deux valeurs aléatoires, à coller dans .env.prod.local (POSTGRES_PASSWORD et APP_SECRET)
openssl rand -hex 24      # POSTGRES_PASSWORD
openssl rand -hex 32      # APP_SECRET
COMPOSE="docker compose -f compose.yml -f compose.prod.yml --env-file .env.prod.local"
$COMPOSE up -d --build --pull always --wait
$COMPOSE exec php php bin/console doctrine:migrations:migrate --no-interaction      # RUN_MIGRATIONS=0 : jamais au démarrage
$COMPOSE exec php php bin/console app:utilisateur:creer <email> <nom> --admin       # premier admin (mot de passe de 12 caractères au moins)
curl -I https://omraon.mmagny.fr/connexion                                           # 200, certificat Let's Encrypt
curl -I https://omraon.mmagny.fr/                                                    # 302 vers /connexion : rien n'est lisible sans compte
```

Pas de port public direct : Traefik route par le nom de domaine. Aucun compte de développement ne doit exister en production. Sauvegarde de la base :
`BACKUP_REMOTE=<hôte:/chemin/> sh outils/sauvegarder.sh prod` (la production refuse de continuer sans destination hors du serveur), restauration prouvée par `sh outils/tester-restauration.sh`.

### Deploiement continu depuis GitHub

Une fois le clone en place, poser les acces du deploiement automatique
(cle Actions, forced command, empreinte du serveur) :

```sh
sh outils/installer-deploiement.sh serveur              # une fois par serveur
sh outils/installer-deploiement.sh projet prod          # depuis la racine du clone de prod
sh outils/installer-deploiement.sh projet staging       # depuis la racine du clone de PPD
```

A lancer sous un utilisateur de deploiement dedie, pas sous root
(`sudo sh outils/installer-deploiement.sh utilisateur` le cree). L'URL du
depot clone est en `git@github.com:`, de preference, pas en alias d'hote.

Le script affiche ce qu'il faut coller dans GitHub, **Settings → Secrets and
variables → Actions** :

| | Production | Pre-production |
|---|---|---|
| Secrets | `DEPLOIEMENT_HOTE`, `DEPLOIEMENT_UTILISATEUR`, `DEPLOIEMENT_CLE_PRIVEE`, `DEPLOIEMENT_KNOWN_HOSTS` | les memes, prefixes de `STAGING_` |
| Variable | `DEPLOIEMENT_PROD = oui` | `DEPLOIEMENT_STAGING = oui` |

**La variable est l'interrupteur.** Absente ou differente de `oui`, le job de
deploiement est ignore : un depot sans serveur garde le meme workflow sans
rien deployer, et suspendre un deploiement ne demande pas de toucher aux
secrets. Les deux jeux de secrets ne sont pas interchangeables — chaque cle
est figee sur son environnement par sa forced command.

**La liste complete de ce qui se configure dans GitHub — et dans quel ordre —
est dans `GITHUB.md`**, a la racine du projet : branches, acces du serveur
au depot, secrets, reglages Actions, protection des branches, Dependabot, et
un recapitulatif en cases a cocher.

### Renseigner les secrets — a faire AVANT le premier build

Les variables obligatoires sont declarees `${VAR:?}` : `docker compose
build` lui-meme refuse de demarrer tant que l'une d'elles est vide. Elles se
produisent donc avec des outils qui ne doivent rien a ce projet — une commande
passant par l'image du projet serait circulaire, l'image ne pouvant pas se
construire sans ces valeurs.

```sh
sh outils/renseigner-secrets.sh prod            # ou staging
```

Le script lit les valeurs que le modele laisse vides et deduit de leur nom
comment les produire : un `*_SECRET` est tire au hasard, un
`*_PASSWORD_HASH` demande un mot de passe en saisie masquee et le hache, le
reste est demande. Il restreint ensuite les droits du fichier et verifie que
`docker compose` accepte la configuration.

A la main, si vous preferez :

```sh
openssl rand -hex 32                            # secret applicatif

read -rs -p "Mot de passe : " MDP && echo       # jamais en argument : historique du shell
docker run --rm -e MDP php:8.5.12-cli 	    php -r 'echo password_hash(getenv("MDP"), PASSWORD_BCRYPT, ["cost" => 13]), PHP_EOL;'
unset MDP
```

Coller tout hachage **entre guillemets simples** : il contient des `$`.

### Verifier — depuis l'exterieur

Derriere un proxy, un conteneur peut etre `healthy` et le site inaccessible :
la sonde interne ne traverse pas Traefik. Le controle qui compte :

```sh
curl -sI https://<domaine>/ | head -3
```

Une **boucle de redirection** signifie que le conteneur fait son propre HTTPS :
verifier que l'override injecte `SERVER_NAME: ":80"`. Un **502** signifie que
Traefik joint le mauvais reseau : verifier l'etiquette
`traefik.docker.network`.

Le controle de recette complet — HTTPS, redirection, en-tetes de securite, indexation, pages
privees, certificat — se rejoue depuis n'importe ou :

```sh
sh outils/verifier-site.sh <domaine>                 # domaine provisoire : site non indexable
sh outils/verifier-site.sh <domaine> --indexable     # domaine definitif
```

Les pages et hotes propres au projet se declarent dans `outils/verifier-site.conf`
(facultatif ; la liste des variables est dans l'en-tete du script).

### Redeployer

```sh
git pull
docker compose -f compose.yml -f compose.<env>.yml --env-file .env.<env>.local up -d --build --pull always --wait
```

### Sauvegardes

La base est sauvegardee par `outils/sauvegarder.sh` (PostgreSQL ou MariaDB, selon le
`.env`) : un export verifie, puis copie **hors du serveur** par rsync sur SSH.
Staging et prod refusent de s'executer sans `BACKUP_REMOTE` : une sauvegarde qui reste
sur la machine ne protege pas de sa perte.

```sh
BACKUP_REMOTE=sauvegarde@hote:/srv/sauvegardes/<projet>/ sh outils/sauvegarder.sh prod
```

Une execution par jour depuis la crontab de l'utilisateur de deploiement, avec une cle SSH
propre restreinte a la destination. `BACKUP_KEEP_DAYS` (14 par defaut) regle la retention
locale ; celle de la destination releve de la destination, qui doit etre chiffree au repos :
l'export contient des donnees personnelles.

**Prouver qu'on sait restaurer** — apres tout changement de version du moteur, et
regulierement sur une sauvegarde de production recuperee depuis la destination :

```sh
sh outils/tester-restauration.sh sauvegardes/<fichier>
```

Il restaure dans une base jetable (supprimee a la sortie) et controle les tables et, pour
une application a migrations Doctrine, l'alignement avec le code. Une sauvegarde jamais
restauree n'est qu'une hypothese.

**Hors perimetre** : les volumes de fichiers (pieces deposees par les utilisateurs, medias)
ne sont pas dans l'export de la base. Les sauvegarder a part des qu'ils portent des donnees
qu'on ne sait pas regenerer.

### Si vous deplacez ou renommez le clone

La forced command de `authorized_keys` porte le chemin **absolu** du script
de deploiement. Un clone deplace la laisse pointer dans le vide, et le
workflow echoue sur `No such file or directory`, code 127 — l'authentification
SSH ayant parfaitement fonctionne, seule la cible est fausse.

Relancer depuis le nouvel emplacement suffit, la cle est inchangee et les
secrets GitHub restent valables :

```sh
sh outils/installer-deploiement.sh projet prod
```

Les volumes survivent au rebuild. **Ne jamais passer `--volumes`** a
`docker compose down` sur un environnement portant des donnees.

### Observabilite

Metriques Caddy — la source pour tout ce qui est HTTP : trafic, codes, histogrammes de
latence. Port interne 2020, jamais publie — joignable depuis le reseau du projet uniquement, et
seulement une fois l'application installee :

```sh
docker run --rm --network omraon curlimages/curl:latest \
  -s http://omraon-php:2020/metrics
```
