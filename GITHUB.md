# Configuration GitHub — simulation

Tout ce qui se règle **dans l'interface GitHub** pour que ce dépôt construise et déploie. À faire une fois, dans cet ordre. Le reste de la mise
en service — clones, secrets du serveur, Traefik — est dans `README.docker.md`. Les cases à cocher de la fin résument les étapes : les reporter dans
une issue au moment de la mise en service évite d'en oublier une.

## 1. Le dépôt et ses branches

Le dispositif suppose deux branches longues, et le workflow ne reconnaît que ces noms :

| Branche | Environnement |
|---|---|
| `main` | production |
| `develop` | pré-production (PPD) — **n'existe pas encore** : ce dépôt n'a pour l'instant que `main` (`git branch -a` avant de trancher) |

```sh
git remote add origin git@github.com:<compte>/simulation.git
git push -u origin main
git switch -c develop && git push -u origin develop    # seulement si une PPD est voulue
```

Puis **Settings → General → Default branch** : garder `main`. Le travail se fait sur des branches `feat/*` ou `fix/*` ; pousser directement sur `main`
déploie en production sans relecture si `DEPLOIEMENT_PROD` vaut `oui` (section 3). Sans `develop`, `deploiement-staging` et la cible `develop` de
Dependabot n'ont pas lieu d'être : le job est ignoré de lui-même.

## 2. Accès du serveur au dépôt

Si le dépôt est privé, un `git clone` depuis le serveur échoue tant qu'aucune clé n'y est autorisée.

| Montage | Où | Quand |
|---|---|---|
| **Compte machine** invité en lecture | dépôt → Settings → Collaborators | plusieurs projets sur le même serveur — une clé pour toutes |
| **Deploy key** en lecture seule | Settings → Deploy keys → Add deploy key | un seul projet, ou aucun compte machine |

```sh
sh outils/installer-deploiement.sh serveur    # crée la clé et l'affiche
```

**« Allow write access » reste décoché** : un déploiement ne pousse jamais. Le volet `serveur` se lance sous l'utilisateur de déploiement, pas sous root,
et le dépôt se clone en `git@github.com:<compte>/simulation.git` (un alias d'hôte ne se résout que pour le compte dont il habite le `~/.ssh/config`).

## 3. Secrets et variables du déploiement

```sh
sh outils/installer-deploiement.sh projet prod       # depuis le clone de prod
sh outils/installer-deploiement.sh projet staging    # depuis le clone de PPD, si elle existe
```

Le script affiche ce qu'il faut coller. **Settings → Secrets and variables → Actions**, onglet **Secrets** :

| Production | Pré-production | Contenu |
|---|---|---|
| `DEPLOIEMENT_HOTE` | `STAGING_DEPLOIEMENT_HOTE` | adresse SSH du serveur |
| `DEPLOIEMENT_UTILISATEUR` | `STAGING_DEPLOIEMENT_UTILISATEUR` | utilisateur de déploiement |
| `DEPLOIEMENT_CLE_PRIVEE` | `STAGING_DEPLOIEMENT_CLE_PRIVEE` | clé privée dont la publique est dans `authorized_keys` |
| `DEPLOIEMENT_KNOWN_HOSTS` | `STAGING_DEPLOIEMENT_KNOWN_HOSTS` | empreinte du serveur, épinglée |

Puis l'onglet **Variables** — c'est l'**interrupteur** :

| Variable | Valeur | Effet |
|---|---|---|
| `DEPLOIEMENT_PROD` | `oui` | un push sur `main` déploie la production |
| `DEPLOIEMENT_STAGING` | `oui` | un push sur `develop` déploie la PPD |

Tant qu'une variable est absente ou différente de `oui`, son job de déploiement est **ignoré** : le dépôt construit et vérifie, il ne livre rien. C'est le
défaut voulu. Les deux jeux de secrets ne sont pas interchangeables : chaque clé est figée sur son environnement par la *forced command* de l'hôte
(`outils/deployer.sh prod|staging`).

## 4. Réglages Actions

**Settings → Actions → General** :

| Réglage | Valeur | Pourquoi |
|---|---|---|
| Fork pull request workflows from outside collaborators | **Require approval for all external contributors** | sans quoi une PR d'un inconnu exécute du code dans votre CI |
| Workflow permissions | **Read repository contents and packages permissions** | le workflow `Qualité et déploiement` ne demande que `contents: read` ; `Release` élève lui-même à `contents: write` |
| Allow GitHub Actions to create and approve pull requests | **décoché** | une approbation automatique viderait de son sens la relecture |

## 5. Protection des branches

Le workflow `Qualité et déploiement` expose un job agrégateur, **`Portes qualité`**, qui échoue si l'une des portes cède (cohérence, audit des dépendances,
Three.js conforme au lockfile, validation HTML, liens internes, tests de la physique, image et démarrage). **C'est le seul contrôle à exiger** : ajouter ou
renommer une porte ne casse alors aucune règle.

**Settings → Rules → Rulesets → New branch ruleset**, cible `main` (et `develop` s'il existe) : pull request obligatoire (1 approbation, ou 0 si l'on travaille
seul), contrôle requis `Portes qualité`, force-push bloqué.

**Sur un compte gratuit, ces règles ne s'appliquent qu'aux dépôts publics.** Un dépôt privé sur l'offre gratuite ne peut ni les rulesets ni les branch
protection rules : la CI affiche son verdict, rien n'empêche techniquement de fusionner au rouge. La discipline remplace la règle (on ouvre quand même une PR, on attend
quand même le vert), et la variable `DEPLOIEMENT_PROD` devient la seule barrière réelle devant la production : la garder éteinte tant que le projet n'est pas en service.

## 6. Sécurité du dépôt

**Settings → Advanced Security** : *Dependabot alerts* et *Dependabot security updates* sont disponibles sur un dépôt privé gratuit — à activer. La porte
`Audit des dépendances` (`npm audit`) ne regarde que `package-lock.json` au moment du push ; Dependabot signale une vulnérabilité publiée **après** le dernier commit.
Three.js est la seule dépendance : une montée de version est proposée en PR, et la porte `Three.js local conforme au lockfile` échoue tant que `npm run vendor` n'a pas
été rejoué et committé (`app/vendor/` est la copie réellement servie). *Secret scanning* et *private vulnerability reporting* sont réservés aux dépôts publics ou payants.

Ce que GitHub ne doit **jamais** voir : les fichiers `.env.<env>.local`. Ils vivent **sur le serveur**, hors du dépôt. Les quatre secrets de la section 3 sont des clés d'accès
au serveur, qui n'ouvrent qu'un script.

## 7. À vérifier, dans cet ordre

```sh
git switch -c chore/eprouver-la-ci && git commit --allow-empty -m "chore: eprouver la CI" && git push -u origin HEAD
```

Ouvrir la PR : sept portes et l'agrégateur `Portes qualité` doivent apparaître ; le résumé de run nomme toute porte ignorée. Une release se publie en posant un tag
(`git tag -a v1.0.0 -m "v1.0.0" && git push origin v1.0.0`) : le workflow `Release` en crée la page à partir de la section du `CHANGELOG.md` (`sh outils/extraire-changelog.sh v1.0.0`
se joue en local avant d'étiqueter ; la section `[1.0.0]` doit exister).

## Récapitulatif

- [ ] `main` poussée (et `develop` si une PPD est voulue)
- [ ] accès du serveur au dépôt (compte machine ou deploy key, lecture seule)
- [ ] quatre secrets par environnement posés (`installer-deploiement.sh projet <env>`)
- [ ] variable `DEPLOIEMENT_PROD` (et `DEPLOIEMENT_STAGING`) à `oui` quand le serveur est prêt
- [ ] réglages Actions (approbation des forks, jeton en lecture seule, pas d'approbation automatique)
- [ ] contrôle `Portes qualité` exigé (dépôt public ou offre payante)
- [ ] Dependabot alerts et security updates activés
- [ ] premier run vérifié : sept portes vertes
