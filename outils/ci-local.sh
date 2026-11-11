#!/usr/bin/env bash
# ci-local.sh — rejoue en local les portes de .github/workflows/qualite.yml (hook pre-push).
#
# Variante STATIQUE : aucun PHP, aucune base. Mêmes portes que la CI, dans le même ordre, sans Docker pour
# les contrôles statiques ; l'image de production est vérifiée par la CI (docker compose up --wait).
# Contournement exceptionnel, à justifier : SKIP_CHECKS=1 git push
set -euo pipefail
cd "$(dirname "$0")/.."
porte() { printf '\n== %s\n' "$1"; }

porte "Cohérence du dépôt"
for f in outils/*.sh .github/scripts/*.sh; do bash -n "$f"; done
npm run --silent check
if command -v docker > /dev/null 2>&1; then
  docker compose --env-file .env config -q
  for e in staging prod; do DOMAINE=exemple.test docker compose -f compose.yml -f "compose.$e.yml" --env-file ".env.$e.local.dist" config -q; done
else
  echo "⊘ docker absent : validation des fichiers compose ignorée."
fi

porte "Three.js local conforme au lockfile"
if [ -d node_modules/three ]; then npm run --silent vendor && git diff --exit-code -- app/vendor; else echo "⊘ node_modules absent : npm ci --ignore-scripts pour activer cette porte."; fi

porte "Validation HTML"
npx --yes html-validate@9 "app/index.html"

porte "Liens internes"
./.github/scripts/check-links.sh app

porte "Tests de la physique"
npm test --silent

echo; echo "Toutes les portes locales passent."
