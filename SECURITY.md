# Politique de sécurité

## Signaler une vulnérabilité

Ne pas ouvrir d'issue publique. Écrire à **mylene.magny@gmail.com** en indiquant la version ou la
branche concernée, les étapes pour reproduire et l'impact constaté. Un accusé de réception
est envoyé sous une semaine.

## Versions prises en charge

Seule la dernière version publiée (branche `main`) reçoit des correctifs de sécurité.

## Ce que le dépôt fait déjà

- Les dépendances sont surveillées par Dependabot (`.github/dependabot.yml`).
- L'audit des dépendances (`composer audit`) est une porte de la CI, sans dépendance envers les autres portes.
- L'accès exige un compte (rôles Lecteur et Admin, comptes créés par l'admin) ; connexion limitée à 5 essais par 15 minutes, jetons CSRF sur tous les formulaires et sur la déconnexion, échecs de connexion journalisés. Le code de la vue et les données ne sont servis qu'aux comptes connectés.
- Les valeurs modifiées par un admin sont validées côté serveur (type, identifiants, aucune balise HTML) ; les illustrations téléversées sont limitées à PNG, JPEG et WebP (2 Mo), jamais de SVG.
- Aucun secret n'est versionné : les fichiers `.env.*.local` restent hors du dépôt.
