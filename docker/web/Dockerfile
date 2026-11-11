# Site statique (HTML, CSS, JS) servi par Caddy — aucun PHP, aucun Node.
# Trois stages, comme les stacks PHP : dev (le site est monte en volume),
# staging et prod (le site est copie dans l'image).
#
# CADDY_VERSION n'a pas de valeur par defaut : elle vient du .env
# (section manifeste/versions). Un ARG avec defaut figerait une version a
# l'insu du .env.
ARG CADDY_VERSION

FROM caddy:${CADDY_VERSION}-alpine AS base
ARG USER_ID
ARG GROUP_ID

# Utilisateur sans privilege. Caddy doit pourtant ecouter sur 80 et 443 :
# la capability est posee sur le binaire (setcap), ce qui l'y autorise sans
# etre root. cap_drop: ALL + cap_add: NET_BIND_SERVICE dans les overrides
# staging et prod ; retirer cette derniere rend la capability-fichier
# inoperante et le conteneur sort sur « Operation not permitted ».
# Le GID de l'hote (20 sur macOS) existe deja dans alpine (dialout) : on rattache
# alors l'utilisateur au groupe existant au lieu d'en creer un, ce qui echouerait.
RUN set -eux; \
	apk add --no-cache libcap; \
	setcap cap_net_bind_service=+ep /usr/bin/caddy; \
	apk del libcap; \
	groupe="$(getent group "${GROUP_ID}" | cut -d: -f1 || true)"; \
	[ -n "$groupe" ] || { addgroup -g "${GROUP_ID}" web; groupe=web; }; \
	adduser -D -u "${USER_ID}" -G "$groupe" web; \
	mkdir -p /srv /data /config; \
	chown -R "${USER_ID}:${GROUP_ID}" /srv /data /config

COPY docker/web/Caddyfile /etc/caddy/Caddyfile
COPY docker/web/docker-healthcheck.sh /usr/local/bin/docker-healthcheck
RUN chmod +x /usr/local/bin/docker-healthcheck

USER web
EXPOSE 80 443
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
	CMD ["docker-healthcheck"]

FROM base AS dev

FROM base AS staging
COPY --chown=${USER_ID}:${GROUP_ID} app/ /srv/

FROM base AS prod
COPY --chown=${USER_ID}:${GROUP_ID} app/ /srv/
