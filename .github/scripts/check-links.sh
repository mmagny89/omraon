#!/usr/bin/env bash
# Vérifie que chaque lien local (href/src) des pages HTML pointe sur un fichier
# réellement présent. Aucun appel réseau, aucune dépendance : les liens externes
# sont volontairement ignorés — leur disponibilité ne dit rien de la qualité du
# dépôt et rendrait la porte instable.
set -euo pipefail

racine="${1:-app}"
[ -d "$racine" ] || { echo "Répertoire introuvable : $racine" >&2; exit 2; }

echec=0

while IFS= read -r page; do
  # Extrait les valeurs de href= et src= entre guillemets simples ou doubles.
  grep -oE '(href|src)=("[^"]*"|'"'"'[^'"'"']*'"'"')' "$page" \
    | sed -E 's/^(href|src)=//; s/^["'"'"']//; s/["'"'"']$//' \
    | while IFS= read -r lien; do
        # Ignorés : protocoles, ancres, protocol-relative, valeurs vides.
        case "$lien" in
          ''|'#'*|http://*|https://*|//*|mailto:*|tel:*|data:*|javascript:*) continue ;;
        esac

        # On ne valide que le chemin : ancre et query enlevées.
        chemin="${lien%%#*}"
        chemin="${chemin%%\?*}"
        [ -n "$chemin" ] || continue

        case "$chemin" in
          /*) cible="$racine$chemin" ;;                 # absolu = racine du site
          *)  cible="$(dirname "$page")/$chemin" ;;     # relatif à la page
        esac

        # Un répertoire est valide s'il porte un index.html ; une URL sans
        # extension est valide si le fichier .html correspondant existe, comme
        # le fait nginx (docker/nginx/default.conf).
        if [ -e "$cible" ] || [ -e "$cible.html" ] || [ -e "$cible/index.html" ]; then
          continue
        fi

        echo "Lien mort : $chemin  (dans $page)"
        echo "cassé" >> /tmp/check-links-echecs
      done
done < <(find "$racine" -name '*.html' -not -path '*/tarteaucitron/*')

if [ -s /tmp/check-links-echecs ]; then
  nombre=$(wc -l < /tmp/check-links-echecs | tr -d ' ')
  rm -f /tmp/check-links-echecs
  echo
  echo "$nombre lien(s) local(aux) sans cible."
  exit 1
fi

echo "Tous les liens locaux pointent sur un fichier existant."
