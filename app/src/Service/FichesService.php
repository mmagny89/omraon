<?php

declare(strict_types=1);

namespace App\Service;

/**
 * Pages de détail : astres, sites, personnages, scènes, lexique, chronologie. Toute la logique (liaisons entre
 * jeux, calculs orbitaux, choix d'ambiance) est ici ; les gabarits Twig ne font qu'afficher.
 */
final readonly class FichesService
{
    /** Année de l'Ère confédérale au présent du roman (décision actée, miroir de data/chronologie.js). */
    public const AN_PRESENT = 300;
    private const G = 6.674e-11;
    private const M_TERRE = 5.972e24;
    private const R_TERRE_KM = 6371.0;
    private const M_JUPITER_EN_TERRES = 317.83;

    public function __construct(private DonneesService $donnees)
    {
    }

    /** @return list<array{id: string, nom: string, type: string, parent: ?string}> */
    public function astres(): array
    {
        $sys = $this->donnees->jeu('systeme');
        $out = [['id' => $sys->STAR->id, 'nom' => $sys->STAR->name, 'type' => 'Étoile', 'parent' => null]];
        foreach ($sys->PLANETS as $p) {
            $out[] = ['id' => $p->id, 'nom' => $p->name, 'type' => ($p->kind ?? '') === 'gas' ? 'Planète gazeuse' : 'Planète tellurique', 'parent' => null];
            foreach ($p->moons ?? [] as $m) {
                $out[] = ['id' => $m->id, 'nom' => $m->name, 'type' => 'Lune', 'parent' => $p->name];
            }
        }
        $out[] = ['id' => 'ceinture-principale', 'nom' => $sys->BELT->name, 'type' => 'Ceinture d\'astéroïdes', 'parent' => null];
        $out[] = ['id' => 'ceinture-froide', 'nom' => $sys->COLD_BELT->name, 'type' => 'Ceinture froide', 'parent' => null];

        return $out;
    }

    /** @return array<string, mixed>|null */
    public function astre(string $id): ?array
    {
        $sys = $this->donnees->jeu('systeme');
        $lien = fn (string $nom): array => $this->lieesAuCorps($nom);

        if ($id === $sys->STAR->id) {
            $s = $sys->STAR;

            return ['type' => 'Étoile (G0V)', 'donnees' => $s, 'calculs' => [
                'Masse' => $this->n($s->massMsun, 2).' M☉', 'Rayon' => $this->n($s->radiusRsun, 2).' R☉',
                'Température' => $s->teff.' K', 'Âge' => $this->n($s->ageGyr, 1).' Gyr',
                'Rotation' => $this->n($s->rotation->periodH / 24, 1).' jours',
            ], 'bord' => $sys->SYSTEM_EDGE_AU, 'parent' => null] + $lien($s->name);
        }
        if ($id === 'ceinture-principale' || $id === 'ceinture-froide') {
            $b = $id === 'ceinture-froide' ? $sys->COLD_BELT : $sys->BELT;

            return ['type' => $id === 'ceinture-froide' ? 'Ceinture froide' : 'Ceinture d\'astéroïdes', 'donnees' => $b, 'calculs' => [
                'De' => $this->n($b->aMin, 2).' UA', 'À' => $this->n($b->aMax, 2).' UA',
            ], 'parent' => null] + $lien($b->name);
        }
        foreach ($sys->PLANETS as $p) {
            if ($p->id === $id) {
                $a = $p->orbit->a;
                $anProp = sqrt($a ** 3 / $sys->STAR->massMsun);
                $mTerres = $this->masseTerres($p);
                $g = 9.80665 * $mTerres / (($p->radiusKm / self::R_TERRE_KM) ** 2);

                return ['type' => ($p->kind ?? '') === 'gas' ? 'Planète gazeuse' : 'Planète tellurique', 'donnees' => $p, 'calculs' => [
                    'Demi-grand axe' => $this->n($a, 3).' UA', 'Excentricité' => $this->n($p->orbit->e, 3),
                    'Période orbitale' => $this->n($anProp, 2).' ans ('.$this->n($anProp * 365.25, 0).' j)',
                    'Masse' => $this->n($mTerres, 2).' M⊕'.(isset($p->massJup) ? ' ('.$this->n($p->massJup, 2).' M♃)' : ''), 'Rayon' => $this->n($p->radiusKm / self::R_TERRE_KM, 2).' R⊕ ('.$this->n($p->radiusKm, 0).' km)',
                    'Gravité de surface' => $this->n($g / 9.80665, 2).' g',
                ], 'parent' => null, 'lunes' => $p->moons ?? []] + $lien($p->name);
            }
            foreach ($p->moons ?? [] as $m) {
                if ($m->id === $id) {
                    $aM = $m->orbit->a * 1000;
                    $jours = 2 * \M_PI * sqrt($aM ** 3 / (self::G * $this->masseTerres($p) * self::M_TERRE)) / 86400;
                    $masse = isset($m->massEarth) ? $m->massEarth * self::M_TERRE : $m->density * (4 / 3) * \M_PI * ($m->radiusKm * 1000) ** 3;
                    $densite = $masse / ((4 / 3) * \M_PI * ($m->radiusKm * 1000) ** 3);

                    return ['type' => 'Lune de '.$p->name, 'donnees' => $m, 'calculs' => [
                        'Demi-grand axe' => $this->n($m->orbit->a, 0).' km', 'Excentricité' => $this->n($m->orbit->e, 3),
                        'Période orbitale' => $this->n($jours, 2).' jours',
                        'Rayon' => $this->n($m->radiusKm, 0).' km', 'Densité' => $this->n($densite, 0).' kg/m³',
                        'Gravité de surface' => $this->n(self::G * $masse / ($m->radiusKm * 1000) ** 2, 3).' m/s²',
                    ], 'parent' => $p] + $lien($m->name);
                }
            }
        }

        return null;
    }

    /** @return list<\stdClass> */
    public function sites(): array
    {
        return $this->donnees->jeu('sites')->SITES;
    }

    /** @return array<string, mixed>|null */
    public function site(string $id): ?array
    {
        foreach ($this->sites() as $s) {
            if ($s->id === $id) {
                $perso = array_values(array_filter($this->personnages(), static fn ($p) => ($p->origine->site ?? null) === $id));
                $vest = array_values(array_filter($this->vestiges(), static fn ($v) => ($v->site ?? null) === $id));

                return ['site' => $s, 'personnages' => $perso, 'vestiges' => $vest, 'corps' => $this->idAstre($s->body), 'scene' => $this->ambiance($s) !== null];
            }
        }

        return null;
    }

    /** @return list<\stdClass> */
    public function personnages(): array
    {
        return $this->donnees->jeu('lore')->PERSONNAGES;
    }

    /** @return list<\stdClass> */
    public function vestiges(): array
    {
        return $this->donnees->jeu('lore')->VESTIGES;
    }

    /** @return array<string, mixed>|null */
    public function personnage(string $id): ?array
    {
        foreach ($this->personnages() as $p) {
            if ($p->id === $id) {
                $site = null;
                foreach ($this->sites() as $s) {
                    if ($s->id === ($p->origine->site ?? null)) {
                        $site = $s;
                    }
                }

                return ['perso' => $p, 'site' => $site, 'corps' => $this->idAstre($p->origine->corps ?? '')];
            }
        }

        return null;
    }

    /**
     * Ambiance d'un lieu pour écrire une scène (miroir PHP de ambianceFor, data/ambiances.js).
     *
     * @return array<string, mixed>|null
     */
    public function ambiance(\stdClass $site): ?array
    {
        $amb = $this->donnees->jeu('ambiances');
        $id = $site->id;
        $cle = str_starts_with($id, 'kebet') && $site->type !== 'orbit' ? 'kebet'
            : (str_starts_with($id, 'sethis') ? 'sethis' : (str_starts_with($id, 'roushan') ? 'roushan'
            : ($site->type === 'heliocentric' ? 'ceinture' : ($site->type === 'orbit' ? 'station' : 'base'))));
        $base = $amb->AMBIANCES_SITES->{$id} ?? $amb->AMBIANCES->{$cle} ?? null;
        if ($base === null) {
            return null;
        }

        return ['donnees' => $base, 'extra' => $amb->SITE_EXTRA->{$id} ?? [], 'cle' => isset($amb->AMBIANCES_SITES->{$id}) ? $id : $cle];
    }

    /** @return array<string, mixed>|null */
    public function scene(string $siteId): ?array
    {
        foreach ($this->sites() as $s) {
            if ($s->id === $siteId) {
                $a = $this->ambiance($s);

                return $a === null ? null : ['site' => $s] + $a;
            }
        }

        return null;
    }

    /** @return array{groupes: array<string, list<\stdClass>>, mois: list<string>} */
    public function lexique(): array
    {
        $groupes = [];
        foreach ($this->donnees->jeu('glossaire')->GLOSSAIRE as $e) {
            $groupes[$e->cat ?? 'Divers'][] = $e;
        }
        ksort($groupes);

        return ['groupes' => $groupes, 'mois' => $this->donnees->jeu('lore')->MOIS];
    }

    /** @return array{eres: list<array<string, mixed>>, evenements: list<array<string, mixed>>} */
    public function chronologie(): array
    {
        $c = $this->donnees->jeu('chronologie');
        $eres = array_map(fn ($e) => ['label' => $e->label, 'de' => $this->an($e->from), 'a' => $e->to >= 1e9 ? null : $this->an($e->to), 'hors' => $e->outside ?? false], $c->ERAS);
        $evt = array_map(fn ($e) => ['an' => $this->an($e->year), 'label' => $e->label, 'note' => $e->note, 'hors' => $e->outside ?? false], $c->EVENTS);

        return ['eres' => $eres, 'evenements' => $evt];
    }

    public function an(float|int $anneeInterne): string
    {
        return 'An '.str_replace('-', '−', (string) round($anneeInterne + self::AN_PRESENT));
    }

    /** @return array{sites: list<\stdClass>, personnages: list<\stdClass>, vestiges: list<\stdClass>} */
    private function lieesAuCorps(string $nom): array
    {
        $sites = array_values(array_filter($this->sites(), static fn ($s) => $s->body === $nom));
        $ids = array_map(static fn ($s) => $s->id, $sites);

        return [
            'sites' => $sites,
            'personnages' => array_values(array_filter($this->personnages(), static fn ($p) => ($p->origine->corps ?? null) === $nom || \in_array($p->origine->site ?? null, $ids, true))),
            'vestiges' => array_values(array_filter($this->vestiges(), static fn ($v) => ($v->corps ?? null) === $nom)),
        ];
    }

    private function idAstre(string $nom): ?string
    {
        foreach ($this->astres() as $a) {
            if ($a['nom'] === $nom) {
                return $a['id'];
            }
        }

        return null;
    }

    private function masseTerres(\stdClass $c): float
    {
        return isset($c->massEarth) ? (float) $c->massEarth : (float) ($c->massJup ?? 0) * self::M_JUPITER_EN_TERRES;
    }

    private function n(float|int $v, int $d): string
    {
        return number_format((float) $v, $d, ',', ' ');
    }
}
