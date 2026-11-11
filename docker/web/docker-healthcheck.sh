#!/bin/sh
# docker-healthcheck — aucune option. Sonde l'ecoute interne :2020 (jamais
# publiee), qui repond /health independamment du TLS et du nom de domaine :
# aucune deduction d'adresse a faire, contrairement au site lui-meme.
# N'utilise que le wget de busybox, present dans l'image alpine de Caddy.
set -e
wget -q -T 3 -O /dev/null http://127.0.0.1:2020/health
