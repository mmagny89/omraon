#!/bin/sh
# docker-entrypoint — aucune option, jamais. Contrat fixe (conventions,
# section manifeste/contrats) :
#   1. attend la base de donnees ;
#   2. bascule sur Caddyfile.bootstrap tant que /app/public/index.php est
#      absent, sinon charge la configuration nominale ;
#   3. joue la mise a jour de schema Doctrine selon RUN_MIGRATIONS, si la
#      console et l'application sont effectivement presentes ;
#   4. execute la commande recue (CMD ou commande explicite).
set -e

wait_for_database() {
	php -r '
		$url = getenv("DATABASE_URL");
		if ($url === false || $url === "") {
			exit(0);
		}

		$parts = parse_url($url);
		$host = $parts["host"] ?? null;
		$port = $parts["port"] ?? 5432;
		if ($host === null) {
			exit(0);
		}

		$deadline = time() + 30;
		while (time() < $deadline) {
			$conn = @fsockopen($host, $port, $errno, $errstr, 2);
			if ($conn) {
				fclose($conn);
				exit(0);
			}
			sleep(1);
		}

		fwrite(STDERR, "docker-entrypoint: database not reachable at {$host}:{$port} after 30s\n");
		exit(1);
	'
}

# Developpement seulement : app/ est un bind mount, donc vendor/ et la CSS
# compilee (ignores par git) manquent sur un clone frais. Composer vit dans
# l'image : aucun PHP ni Composer n'est requis sur la machine hote.
# Le service php installe ; les autres (worker) attendent le resultat.
bootstrap_dev_dependencies() {
	[ "$APP_ENV" = "dev" ] && [ -f /app/composer.json ] || return 0

	if [ "$1" = "frankenphp" ]; then
		# APP_SECRET n'est jamais committe (app/.env le laisse vide) : sans
		# app/.env.local, le noyau refuse de demarrer sur un clone frais.
		if ! grep -qs '^APP_SECRET=.' /app/.env.local; then
			echo "docker-entrypoint: APP_SECRET absent, ecrit dans app/.env.local"
			echo "APP_SECRET=$(php -r 'echo bin2hex(random_bytes(32));')" >> /app/.env.local
		fi
		if [ ! -f /app/vendor/autoload_runtime.php ]; then
			echo "docker-entrypoint: vendor/ absent, composer install"
			(cd /app && composer install --no-interaction --no-progress)
		fi
		if [ ! -d /app/var/tailwind ] && [ -f /app/bin/console ] && grep -qs 'symfonycasts/tailwind-bundle' /app/composer.json; then
			echo "docker-entrypoint: CSS non compilee, tailwind:build"
			# Le projet a deux feuilles d'entree (pages, vue) : app:tailwind:build les compile toutes (voir src/Command/TailwindToutCommand.php).
			php /app/bin/console app:tailwind:build || php /app/bin/console tailwind:build
		fi
	else
		waited=0
		while [ ! -f /app/vendor/autoload_runtime.php ] || { grep -qs 'symfonycasts/tailwind-bundle' /app/composer.json && [ ! -d /app/var/tailwind ]; }; do
			[ "$waited" -lt 600 ] || { echo "docker-entrypoint: dependances absentes apres 600s" >&2; exit 1; }
			sleep 2
			waited=$((waited + 2))
		done
	fi
}

wait_for_database

bootstrap_dev_dependencies "$@"

if [ -f /app/public/index.php ]; then
	cp /etc/caddy/Caddyfile.nominal /etc/caddy/Caddyfile
else
	cp /etc/caddy/Caddyfile.bootstrap /etc/caddy/Caddyfile
fi

if [ -f /app/public/index.php ] && [ -f /app/bin/console ] && [ "$RUN_MIGRATIONS" = "1" ]; then
	php /app/bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration
fi

exec "$@"
