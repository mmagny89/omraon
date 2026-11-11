#!/bin/sh
# deployer.sh — deploiement d'un environnement, execute SUR LE SERVEUR.
#
# Appele par GitHub Actions a travers une forced command SSH. L'argument vient
# de authorized_keys, donc du serveur, jamais du client : rien de ce que GitHub
# envoie n'influence ce qui est execute ici.
#
#   command="/docker/<projet>-prod/outils/deployer.sh prod",no-agent-forwarding,no-port-forwarding,no-pty,no-user-rc,no-X11-forwarding ssh-ed25519 AAAA... deploiement-github-<projet>
#
# La logique reste ici et non dans le workflow (conventions, §ci/qualite) : les
# chemins et les secrets ne quittent pas le serveur, et la cle confiee a GitHub
# ne peut rien lancer d'autre.
#
# Variante STATIQUE du deployer.sh de reference (Symfony) : aucune mise a jour de
# schema, aucune base de donnees. Meme contrat, memes gardes.
set -eu

ENVIRONNEMENT=${1:-}

case "$ENVIRONNEMENT" in
	prod) BRANCHE=main ;;
	staging) BRANCHE=develop ;;
	*)
		echo "Usage : $0 prod|staging" >&2
		exit 1
		;;
esac

# Le projet se deduit de l'emplacement du script, jamais d'un chemin en dur :
# renommer ou deplacer le clone ne casse alors que la forced command.
PROJET=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
SECRETS="$PROJET/.env.${ENVIRONNEMENT}.local"
COMPOSE="docker compose -f compose.yml -f compose.${ENVIRONNEMENT}.yml --env-file $SECRETS"

cd "$PROJET"

journal() {
	echo "[$(date '+%F %T')] $*"
}

journal "Deploiement $ENVIRONNEMENT depuis $BRANCHE, dans $PROJET"

if [ ! -f "$SECRETS" ]; then
	journal "ECHEC : $SECRETS absent. Le renseigner avant tout deploiement."
	exit 1
fi

# Se deployer depuis la mauvaise branche passerait inapercu.
ACTUELLE=$(git rev-parse --abbrev-ref HEAD)
if [ "$ACTUELLE" != "$BRANCHE" ]; then
	journal "ECHEC : ce clone est sur '$ACTUELLE', or $ENVIRONNEMENT se deploie depuis '$BRANCHE'."
	exit 1
fi

# --ff-only : un deploiement ne fusionne rien et ne resout aucun conflit.
journal "Recuperation du code"
git fetch --quiet origin "$BRANCHE"
git merge --ff-only "origin/$BRANCHE"
journal "Version deployee : $(git rev-parse --short HEAD) — $(git log -1 --pretty=%s)"

# --pull always : sans lui, --build repart de l'image de base en cache.
journal "Construction et demarrage"
$COMPOSE up -d --build --pull always --wait

# Sans lui, chaque deploiement laisse l'image precedente sans etiquette et le
# disque du serveur se remplit en silence.
journal "Menage des images orphelines"
docker image prune -f >/dev/null

journal "Etat des conteneurs"
$COMPOSE ps --format '  {{.Name}}  {{.Status}}'

# Le conteneur peut se declarer healthy alors que le site est inaccessible
# derriere le proxy : le controle qui compte se fait depuis l'exterieur.
lire_secret() {
	grep -E "^$1=" "$SECRETS" 2>/dev/null | tail -n 1 | cut -d= -f2- | tr -d '"'"'"''
}

DOMAINE=$(lire_secret DOMAINE)

case "$DOMAINE" in
	'') journal "Aucun DOMAINE dans $SECRETS — verification externe ignoree" ;;
	*)
		CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "https://$DOMAINE/" || echo 000)
		journal "https://$DOMAINE/ repond $CODE"
		case "$CODE" in
			2*|3*) ;;
			*)
				journal "ECHEC : le site ne repond pas correctement depuis l'exterieur."
				exit 1
				;;
		esac
		;;
esac

journal "Deploiement $ENVIRONNEMENT termine"
