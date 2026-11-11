# Système d'Omraon — simulation & visualisation

Simulation physique (N-corps) et vue 3D du système décrit dans la *Bible géographique v3* : une étoile, trois
telluriques (Kalpra, Sethis, Naksun), la ceinture Nunzir, deux géantes (Zirkan, Roushan) et six lunes dont Kebet.

```sh
docker compose up -d --wait   # https://localhost (certificat auto-signé de Caddy)
npm test                       # physique : conservation, stabilité des lunes, bascule d'intégrateur
```

Stack statique d'agence (Caddy seul, ni PHP ni Node) : le site vit dans `app/`, sans étape de build ; Three.js est
copié dans `app/vendor/` (importmap), aucune ressource externe. Voir `README.docker.md`.

## Physique
- Gravitation newtonienne N-corps, unités UA / jour / M☉ (constante de Gauss), leapfrog symplectique.
- Conditions initiales par éléments képlériens ; lunes dans le plan équatorial de leur planète (obliquité réelle).
- Lunes incluses dans le N-corps tant que la vitesse le permet ; au-delà elles passent « sur rails » (Kepler), planètes toujours en N-corps.
- Astéroïdes : particules test (perturbées par l'étoile et les planètes, retirées à l'impact), troyens de Zirkan (activés par défaut, décochables).
- Relativité générale 1PN (précession du périhélie de Kalpra, lisible sur ϖ), résonance spin-orbite 3:2 de Kalpra, rotation synchrone des lunes, aplatissement dû à la rotation.
- Dérivés : zone habitable (Kopparapu 2013), température d'équilibre, rayon de Hill, limite de stabilité des satellites (Domingos 2006), limite de Roche.
- Diagnostics en direct : ΔE/E et ΔL/L.

## Données
Le document ne fixe aucune valeur physique (hors ordre, rôles, noms, « ~35 UA au bord »). Les masses, rayons, orbites et
l'étoile (F6V, 1,25 M☉) sont des choix de conception dans `src/data/omraon.js`, calés pour que Zirkan soit en zone habitable.
Les racines égyptiennes (« jamais affichées » dans la bible) sont volontairement absentes de l'interface.
Hors simulation : monde natal tyt, hangar-musée, Terre.

## Habitabilité
Chaque fiche contient un diagnostic d'habitabilité humaine (`app/src/physics/habitability.js`) : température
(équilibre + effet de serre), eau liquide, pression, rétention d'atmosphère (critère de Jeans), gravité, rayonnement
des ceintures des géantes (analogie Jupiter/Galileo), chauffage de marée (Peale), saisons, stabilité de Hill/Roche,
durée de vie de l'étoile. Verdict par mode : biosphère de surface, habitat protégé, base/station, cité flottante.
La fiche d'Omraon donne la synthèse de tous les corps. Les valeurs (orbites, masses, atmosphères, populations) se règlent dans `app/src/data/` ; les suggestions chiffrent ce qui ramène un corps dans la plage. Ce sont des estimations de conception, pas un modèle climatique 3D.

## Sites habités
`app/src/data/sites.js` : 14 sites (mines, octroi, garnison, tribunaux, relais, balise, port et cités de Kebet, cités flottantes,
postes des confins, repaire de la ceinture). Emplacements et populations sont des propositions (`invented: true`), modifiables
dans `app/src/data/sites.js`. Les bases au sol suivent la rotation du corps, les stations sont de vraies orbites, les cités flottantes sont au niveau 1 bar.
Chaque fiche calcule : jour/nuit local, température, chauffage ou climatisation par habitant, blindage (rayons cosmiques + ceintures),
énergie (solaire ou fission), besoins en air/eau/nourriture, gravité artificielle ou enveloppe d'hydrogène chaud, et les **trajets**
vers les autres sites (Hohmann par cônes raccordés, fenêtres de lancement, délai lumière, croisière à accélération constante).
La propulsion (chimique, fusion 0,01 g, torche 0,1 g) est une hypothèse : le document ne la fixe pas.
Les fiches des corps donnent aussi le jour sidéral, le jour solaire et l'année locale ; la liste regroupe lunes et sites sous leur planète.

## Canon intégré (documents 00–13)
Propulsion : subliminique 0,1 c, hyperpropulsion 0,95 c limitée à 6 jours continus (accélération supposée, 8 g par défaut ≈ 35 UA en 6 j) ;
populations : ~300 000 à 800 000 humains, Haut (Kebet) en dizaines de milliers, Tyts plus nombreux dans les zones de travail ;
Sethis : atmosphère ténue (vent, poussière) ; voyage des arches : 0,35 c × ~400 ans ≈ 140 années-lumière.

## Chronologie et âge du système
L'An 0 est le présent du roman (`app/src/data/chronologie.js`) ; les éléments orbitaux de `omraon.js` sont ceux de l'An 0.
Le panneau « Chronologie » saute à n'importe quelle date de −960 à +60 ans (arrivée −560, double basculement −500, Siècles Sombres −300,
réveils −2, présent) : les planètes sont recalculées en N-corps (leapfrog réversible, retour exact à 1e-9 UA près), la ceinture est regénérée.
L'âge de l'étoile (3 Gyr, durée de vie ~5,7 Gyr) est affiché et sert à estimer quand Zirkan sortira de la zone habitable.
Kebet (jour ≈ 1,3 j) est à 4,7 rayons de Zirkan (345 000 km) : rotation synchrone, Zirkan de 24° dans le ciel, éclipses ≈ 7 % de l'orbite,
champ magnétique de Zirkan supposé très faible (sinon dose mortelle), excentricité ≈ 0 (chauffage de marée).

## Ciel, fiche de scène, éphémérides
- **Ciel vu d'un site** (`physics/sky.js`, `render/skyView.js`) : azimut/hauteur, diamètres angulaires réels, phases, éclipse en cours (ex. Zirkan à 24° sur Kebet) ; couleur du ciel selon l'atmosphère du lieu.
- **Fiche de scène** : lumière et heure du jour (aube, crépuscule…), prochain lever/coucher/éclipse, conditions physiques, délais de communication, puis la banque d'images des documents « Quotidien sensoriel » (`data/ambiances.js`, génériques marqués non canon) ; bouton « Copier le texte ».
- **Éphémérides** (`physics/ephemeris.js`) : une copie de la simulation N-corps tourne sur 30 j / 1 an / 5 ans et détecte éclipses de l'étoile par la planète parente, lever/coucher, alignements, périhélies/aphélies (précision ~1 minute). Un clic saute à la date.
- **Habitable en permanence ?** (`physics/habscan.js`) : extrêmes de température, flux, excentricité et chauffage de marée de Kebet sur 5 ans simulés.
- **Vitesses** : de « temps réel » (1 s/s) et « 1 min/s » jusqu'à 1000 ans/s.

## Précision numérique
Intégrateur : composition d'ordre 4 (Yoshida) de pas leapfrog symétriques, donc réversible. Précession parasite de Kalpra : 0,014°/an
(leapfrog P/64 : 3,7°/an) ; la relativité générale ajoute ~0,0003°/an. Ellipses calculées sur l'état du dernier pas, en coordonnées de Jacobi.

## Voyage animé du Mai
Bouton « ▶ Lancer le voyage du Mai » dans le panneau de trajet (propulsions hyper/subluminique) : le vaisseau part du site, vise la position
PRÉVUE de la destination à l'arrivée (point fixe), accélère puis freine ; si l'accélération + le freinage dépassent 6 jours de poussée continue,
le moteur est coupé au milieu (repos supposé d'un jour). Panneau : phase, vitesse, distance, poussée continue, délai de message vers l'origine
et la destination. La caméra peut suivre le vaisseau ; la vitesse de lecture est choisie pour que le trajet dure ~30 s. Profil newtonien
(vitesses < 0,06 c en système), l'arrivée est recalée sur la position réelle de la destination (`physics/flight.js`).
