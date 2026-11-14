<?php

declare(strict_types=1);

namespace App\Service;

/**
 * Températures des astres : face éclairée, face sombre, moyenne. Miroir PHP de front/src/physics/thermique.js
 * (modèle et constantes identiques) ; un test compare les deux sur tous les astres du canon (tests/fixtures/thermique.json).
 */
final class Thermique
{
    private const G = 2.959122082855911e-4; // UA³ / (M☉ · j²)
    private const AU_KM = 149597870.7;
    private const M_TERRE = 3.0034896e-6; // M☉
    private const M_JUPITER = 9.5479194e-4; // M☉
    private const R_SOLEIL_KM = 695700.0;
    private const M_SOLEIL_KG = 1.98847e30;
    private const T_FOND = 3.0;

    /**
     * @return array{mode: string, jour: float, nuit: float, moyenne: float, jourSolaire: ?float}
     */
    public function faces(\stdClass $etoile, \stdClass $corps, ?\stdClass $planete = null): array
    {
        if (!isset($planete) && ($corps->id ?? null) === $etoile->id) {
            return ['mode' => 'etoile', 'jour' => (float) $etoile->teff, 'nuit' => (float) $etoile->teff, 'moyenne' => (float) $etoile->teff, 'jourSolaire' => null];
        }
        $mere = $planete ?? $corps; // planète autour de l'étoile (le corps lui-même, ou la planète d'une lune)
        $hab = $corps->habitat ?? new \stdClass();
        $pression = (float) ($hab->pressureBar ?? 0);
        $serre = (float) ($hab->greenhouseK ?? 0);

        $eclipse = 0.0;
        if ($planete !== null && ($planete->kind ?? '') === 'gas') {
            $eclipse = asin(min(1.0, $planete->radiusKm / $corps->orbit->a)) / \M_PI;
        }
        $aKm = $mere->orbit->a * self::AU_KM;
        $teq = $etoile->teff * sqrt($etoile->radiusRsun * self::R_SOLEIL_KM / (2 * $aKm)) * (1 - ($corps->albedo ?? 0.3)) ** 0.25 * (1 - $eclipse) ** 0.25;

        if (($corps->kind ?? '') === 'gas') {
            $t1 = (float) ($hab->internalHeat ?? 1.5) * $teq;

            return ['mode' => 'geante', 'jour' => $t1, 'nuit' => $t1, 'moyenne' => $t1, 'jourSolaire' => null];
        }

        $solaire = $this->jourSolaire($etoile, $corps, $planete);
        $nuitJours = is_finite($solaire) ? $solaire / 2 : \INF;
        $f = min(0.9, max(0.15, 0.35 * ($nuitJours / 14.8) ** -0.25));
        $r = 1 + 14 * $pression;
        $moyenne = $teq + $serre;

        return [
            'mode' => 'solide',
            'jour' => $moyenne + (\M_SQRT2 * $teq - $teq) / $r,
            'nuit' => max(self::T_FOND, $moyenne - ($teq - $f * $teq) / $r),
            'moyenne' => $moyenne,
            'jourSolaire' => is_finite($solaire) ? $solaire : null,
        ];
    }

    private function masse(\stdClass $c): float
    {
        return match (true) {
            isset($c->massEarth) => $c->massEarth * self::M_TERRE,
            isset($c->massJup) => $c->massJup * self::M_JUPITER,
            default => $c->density * (4 / 3) * \M_PI * ($c->radiusKm * 1000) ** 3 / self::M_SOLEIL_KG,
        };
    }

    private function periodeAutourEtoile(\stdClass $etoile, \stdClass $planete): float
    {
        return 2 * \M_PI * sqrt($planete->orbit->a ** 3 / (self::G * ($etoile->massMsun + $this->masse($planete))));
    }

    private function jourSolaire(\stdClass $etoile, \stdClass $corps, ?\stdClass $planete): float
    {
        $mere = $planete ?? $corps;
        $an = $this->periodeAutourEtoile($etoile, $mere);
        if ($planete !== null) { // lune verrouillée sur sa planète
            $rot = 2 * \M_PI * sqrt(($corps->orbit->a / self::AU_KM) ** 3 / (self::G * ($this->masse($planete) + $this->masse($corps))));
        } elseif (isset($corps->rotation->periodH)) {
            $rot = $corps->rotation->periodH / 24;
        } elseif (isset($corps->rotation->spinOrbitRatio)) {
            $rot = $an / $corps->rotation->spinOrbitRatio;
        } else {
            $rot = 1.0;
        }
        $d = abs(1 / $rot - 1 / $an);

        return $d < 1e-9 ? \INF : 1 / $d;
    }
}
