# Ressources du système : estimations et questions ouvertes

Tout ce document est de la **conception** (ordres de grandeur, jamais de canon) : le roman nomme des fonctions (mines, glace de Nunka, raffineries, jardins de Kebet), aucun tonnage. Les masses et rayons viennent de `data/omraon.js` ; les extractions actuelles, de `data/economie.js` (`PROFILS`).

## Ce que le système extrait aujourd'hui

| Marchandise | Extraction (t/jour) | Où |
|---|---|---|
| Vivres | 476 | Kebet (jardins) |
| Carburant | 420 | Roushan (raffineries de gaz) |
| Eau et glace | 329 | Nunka, un peu de Kebet |
| Minerai | 282 | Sethis, Kalpra, confins |
| Équipements | 56 | Roushan, Iasha |
| Métaux traités | 52 | Sethis, Kalpra |
| Luxe | 35 | Kebet |
| **Total** | **≈ 1 650 t/jour, soit ≈ 600 000 t/an** | |

Pour ≈ 830 000 habitants (497 000 humains, 331 000 Tyts) : **≈ 2,0 kg par habitant et par jour**. La Terre actuelle extrait de l'ordre de 12 t par habitant et par an (≈ 34 kg par jour), soit **17 fois plus**.

## Ce que les corps contiennent (ordres de grandeur)

| Corps | Masse | Vitesse de libération | Ressource | Stock exploitable (ordre) | Extraction actuelle | Horizon d'épuisement |
|---|---|---|---|---|---|---|
| Sethis (monde-mine) | 5,7·10²⁴ kg | 11,0 km/s | minerai, métaux | ≈ 2·10¹⁵ kg | 7·10⁷ kg/an | ≈ 30 millions d'années |
| Kalpra | 2,4·10²⁴ kg | 7,9 km/s | minerai, métaux | ≈ 5·10¹⁴ kg | 10⁷ kg/an | ≈ 50 millions d'années |
| Naksun | 1,1·10²⁵ kg | 13,9 km/s | (octroi, pas de mine) | — | 0 | — |
| Nunka (lune glacée, ρ ≈ 1 000) | ≈ 6·10²⁰ kg | 0,4 km/s | glace, eau | ≈ 6·10²⁰ kg | 7·10⁷ kg/an | plus que l'âge de l'étoile |
| Ceinture Nunzir (1,05–1,55 UA) | ≈ 2·10²¹ kg (comme la ceinture solaire) | < 0,1 km/s | métaux (≈ 10 %), eau (≈ 10 %) | ≈ 2·10²⁰ kg de chaque | ≈ 0 (hors contrôle) | — |
| Roushan (géante) | 6,6·10²⁶ kg | — | hydrogène, hélium | ≈ 10²⁶ kg | 1,2·10⁸ kg/an | sans objet |
| Kebet (biosphère) | 5,0·10²⁴ kg | 10,5 km/s | vivres | ≈ 10¹⁴ kg/an de production végétale | 1,7·10⁸ kg/an | 2 millionièmes de la production |

Méthode : le stock exploitable d'un monde rocheux est ≈ 10⁻⁸ de sa croûte (celle-ci ≈ 0,4 % de sa masse), multiplié par 5 à 10 pour un monde « riche en métaux » ; une lune de glace est exploitable presque en entier ; la ceinture reprend la masse de la nôtre (≈ 2·10²¹ kg), dont 8 % de corps métalliques et 10 % d'eau dans les carbonés.

## Ce que ces chiffres disent

1. **Aucune ressource ne s'épuise.** L'extraction est 7 à 12 ordres de grandeur sous les stocks. Modéliser des réserves qui baissent n'a aucun intérêt ; ce qui limite, ce sont la main-d'œuvre, les machines, l'énergie et le transport.
2. **La rareté est politique et logistique, pas géologique.** Les jardins de Kebet n'ont besoin que d'environ 170 km² de cultures pour nourrir tout le système, sur un monde de 460 millions de km². Si les cités de Roushan manquent de vivres, c'est que Kebet est réservé, pas qu'il en manque.
3. **La ceinture est la meilleure mine, et elle est hors la loi.** Un astéroïde se quitte avec quelques dizaines de m/s, contre 8 à 14 km/s pour Kalpra, Sethis ou Naksun. L'extraction y coûte une fraction de l'énergie. Que les mines soient sur les planètes, à la merci de l'octroi de Naksun, tient à la propriété et au contrôle (le Consortium tient les mines, les pirates tiennent la ceinture), pas à l'économie physique. C'est une tension narrative utile : les contrebandiers d'Onkel vivent de ce que le Consortium ne contrôle pas.
4. **Le niveau industriel est bas par rapport à la Terre actuelle** (1,9 kg contre 34 kg par habitant et par jour). Les métaux et pièces par habitant sont environ 10 fois sous une économie industrielle moderne. C'est cohérent avec un monde qui sort des Siècles Sombres et où le travail est servile, mais c'est un choix à assumer.

## Questions ouvertes

- **Niveau industriel** : garder 2 kg par habitant et par jour, ou monter la consommation de métaux et d'équipements (× 5 à × 10) pour une société plus technique ?
- **La ceinture** : **décidé et fait (2026-11-13)** : deux mines libres (minerai, métaux, eau), des passeurs, un événement « expédition du Consortium » ; voir `modifications-lore.md` n° 27 et 28.
- **Capacité d'extraction** : la modéliser par site (machines, énergie, main-d'œuvre tyt) plutôt que par une production fixe, pour que le dégel du contrôle ou une grève réduise vraiment l'extraction ?
